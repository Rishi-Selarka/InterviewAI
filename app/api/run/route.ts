// app/api/run/route.ts
//
// Runs candidate code and returns { stdout, stderr, error }. Two backends:
//
//   • LOCAL (dev only) — when NODE_ENV !== 'production' AND
//     ALLOW_LOCAL_CODE_EXECUTION=true, it compiles/runs on this machine using the
//     installed toolchains. Fast and offline, but ⚠️ UNSANDBOXED — never enable on
//     a deployed/shared server.
//
//   • JUDGE0 (default / production) — posts to a Judge0 instance (a sandboxed,
//     multi-language execution service). This is what runs on the deployed app
//     (Vercel serverless can't compile/exec locally). Configure with:
//       JUDGE0_URL            (default: https://judge0-ce.p.rapidapi.com)
//       JUDGE0_RAPIDAPI_KEY   (your free RapidAPI key for Judge0 CE)
//     A self-hosted Judge0 needs only JUDGE0_URL (no key).

import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const runtime = 'nodejs';

const TIMEOUT_MS = 5000;
const COMPILE_TIMEOUT_MS = 15000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

type RunResult = { stdout: string; stderr: string; error: string | null };

// Judge0 (and our local runner) compile Java as `Main.java` and run the `Main`
// class, so the entry class MUST be named Main. Candidates paste snippets with
// any class name (e.g. `public class Solution`, `public class BinarySearch`),
// which would otherwise fail with "class X is public, should be declared in a
// file named X.java". This rewrites the relevant class name to Main so any valid
// Java just runs.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeJavaSource(code: string): string {
  const rename = (name: string) =>
    name === 'Main'
      ? code
      : code.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g'), 'Main');

  // 1) A public top-level class — Java allows only one, and its name drives the
  //    required filename. Rename it (and its constructor/`new` references) to Main.
  const pub = code.match(/\bpublic\s+class\s+([A-Za-z_$][\w$]*)/);
  if (pub) return rename(pub[1]);

  // 2) Already has a `Main` class — leave it alone.
  if (/\bclass\s+Main\b/.test(code)) return code;

  // 3) No public class: if some class declares `main`, rename the first class so
  //    `java Main` finds an entry point.
  if (/\bstatic\s+(?:final\s+)?void\s+main\b/.test(code)) {
    const first = code.match(/\bclass\s+([A-Za-z_$][\w$]*)/);
    if (first) return rename(first[1]);
  }

  return code;
}

function localExecutionEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_LOCAL_CODE_EXECUTION === 'true'
  );
}

// ─── Judge0 (sandboxed, used in production) ──────────────────────────────────

const JUDGE0_URL = (process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com').replace(/\/$/, '');
const JUDGE0_KEY = process.env.JUDGE0_RAPIDAPI_KEY || '';

// Judge0 CE language ids (stable on the CE distribution).
const JUDGE0_IDS: Record<string, number> = {
  javascript: 63, // Node.js
  python: 71, // Python 3
  java: 62, // Java (OpenJDK)
  c: 50, // C (GCC)
  cpp: 54, // C++ (GCC)
};

async function runViaJudge0(language: string, code: string): Promise<RunResult> {
  const id = JUDGE0_IDS[language];
  if (!id) return { stdout: '', stderr: '', error: `Unsupported language: ${language}` };

  const usingRapidApi = JUDGE0_URL.includes('rapidapi');
  if (usingRapidApi && !JUDGE0_KEY) {
    return {
      stdout: '',
      stderr: '',
      error:
        'Code execution is not configured on the server. Add JUDGE0_RAPIDAPI_KEY ' +
        '(free from RapidAPI → Judge0 CE) to the deployment environment.',
    };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUDGE0_KEY) {
    headers['X-RapidAPI-Key'] = JUDGE0_KEY;
    headers['X-RapidAPI-Host'] = new URL(JUDGE0_URL).host;
  }

  let res: Response;
  try {
    res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source_code: code, language_id: id }),
    });
  } catch {
    return { stdout: '', stderr: '', error: 'Code execution service is unreachable.' };
  }
  if (!res.ok) {
    return { stdout: '', stderr: '', error: `Execution service error (${res.status}).` };
  }

  const d = (await res.json()) as {
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    message?: string | null;
    status?: { id: number; description: string };
  };

  const statusId = d.status?.id ?? 0;
  if (statusId === 6) {
    // Compilation error.
    return { stdout: '', stderr: d.compile_output ?? '', error: 'Compilation failed.' };
  }
  if (statusId === 5) {
    return { stdout: d.stdout ?? '', stderr: d.stderr ?? '', error: 'Execution timed out.' };
  }
  return {
    stdout: d.stdout ?? '',
    stderr: d.stderr ?? d.compile_output ?? d.message ?? '',
    error: null,
  };
}

// ─── Local (dev only, unsandboxed) ───────────────────────────────────────────

const RUNTIME_MISSING = 'RUNTIME_MISSING';

function isRuntimeMissing(code: string | number | undefined, stderr: string): boolean {
  if (code === 'ENOENT') return true;
  if (code === 9009 && /not found|not recognized/i.test(stderr)) return true;
  return false;
}

type Step = { cmd: string; args: string[] };
type LocalConfig = { filename: string; compile?: Step; run: Step; notInstalledMessage: string };

function localConfig(language: string, dir: string): LocalConfig | null {
  const out = path.join(dir, 'program.out');
  switch (language) {
    case 'javascript':
      return { filename: 'main.js', run: { cmd: 'node', args: [path.join(dir, 'main.js')] }, notInstalledMessage: 'Node.js is not installed.' };
    case 'python':
      return { filename: 'main.py', run: { cmd: 'python3', args: [path.join(dir, 'main.py')] }, notInstalledMessage: 'Python 3 is not installed.' };
    case 'java':
      return { filename: 'Main.java', compile: { cmd: 'javac', args: [path.join(dir, 'Main.java')] }, run: { cmd: 'java', args: ['-cp', dir, 'Main'] }, notInstalledMessage: 'Java (JDK) is not installed.' };
    case 'c':
      return { filename: 'main.c', compile: { cmd: 'cc', args: [path.join(dir, 'main.c'), '-o', out] }, run: { cmd: out, args: [] }, notInstalledMessage: 'A C compiler is not installed.' };
    case 'cpp':
      return { filename: 'main.cpp', compile: { cmd: 'c++', args: [path.join(dir, 'main.cpp'), '-o', out] }, run: { cmd: out, args: [] }, notInstalledMessage: 'A C++ compiler is not installed.' };
    default:
      return null;
  }
}

function execStep(step: Step, cwd: string, timeout: number): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(step.cmd, step.args, { timeout, maxBuffer: MAX_OUTPUT_BYTES, cwd }, (err, stdout, stderr) => {
      if (err) {
        const e = err as NodeJS.ErrnoException & { code?: string | number; killed?: boolean; signal?: string };
        if (isRuntimeMissing(e.code, stderr)) return resolve({ stdout, stderr, error: RUNTIME_MISSING });
        if (e.killed && e.signal === 'SIGTERM') return resolve({ stdout, stderr, error: `Execution timed out after ${timeout / 1000}s.` });
        return resolve({ stdout, stderr, error: stderr || 'Process exited with an error.' });
      }
      resolve({ stdout, stderr, error: null });
    });
  });
}

async function runLocal(language: string, code: string): Promise<RunResult> {
  const dir = await mkdtemp(path.join(tmpdir(), 'interview-run-'));
  const config = localConfig(language, dir);
  if (!config) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    return { stdout: '', stderr: '', error: `Unsupported language: ${language}` };
  }
  try {
    await writeFile(path.join(dir, config.filename), code, 'utf8');
    if (config.compile) {
      const compiled = await execStep(config.compile, dir, COMPILE_TIMEOUT_MS);
      if (compiled.error === RUNTIME_MISSING) return { stdout: '', stderr: '', error: config.notInstalledMessage };
      if (compiled.error) return { stdout: '', stderr: compiled.stderr, error: 'Compilation failed.' };
    }
    const result = await execStep(config.run, dir, TIMEOUT_MS);
    if (result.error === RUNTIME_MISSING) return { stdout: '', stderr: '', error: config.notInstalledMessage };
    if (result.error && result.error === result.stderr) result.error = null;
    return result;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { language?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ stdout: '', stderr: '', error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { language, code } = body;
  if (typeof language !== 'string' || typeof code !== 'string') {
    return Response.json(
      { stdout: '', stderr: '', error: 'Request must include string "language" and "code".' },
      { status: 400 },
    );
  }

  // Java entry class must be `Main` for the compiler/runner — normalize any
  // pasted class name so valid Java just works.
  const finalCode = language === 'java' ? normalizeJavaSource(code) : code;

  try {
    const result = localExecutionEnabled()
      ? await runLocal(language, finalCode)
      : await runViaJudge0(language, finalCode);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ stdout: '', stderr: '', error: message }, { status: 500 });
  }
}

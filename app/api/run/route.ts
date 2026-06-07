// app/api/run/route.ts
//
// Runs candidate code and returns { stdout, stderr, error }. Two backends:
//
//   • LOCAL (dev only) — when NODE_ENV !== 'production' AND
//     ALLOW_LOCAL_CODE_EXECUTION=true, it compiles/runs on this machine using the
//     installed toolchains. Fast and offline, but ⚠️ UNSANDBOXED — never enable on
//     a deployed/shared server.
//
//   • PISTON (default / production) — posts to the free public Piston API
//     (emkc.org), a sandboxed multi-language execution service. This is what runs
//     on the deployed app (Vercel serverless can't compile/exec locally anyway).

import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const runtime = 'nodejs';

const TIMEOUT_MS = 5000;
const COMPILE_TIMEOUT_MS = 15000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

type RunResult = { stdout: string; stderr: string; error: string | null };

function localExecutionEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_LOCAL_CODE_EXECUTION === 'true'
  );
}

// ─── Piston (sandboxed, used in production) ──────────────────────────────────

const PISTON = 'https://emkc.org/api/v2/piston';

// Our language id -> Piston language + source filename.
const PISTON_LANG: Record<string, { lang: string; file: string }> = {
  javascript: { lang: 'javascript', file: 'main.js' },
  python: { lang: 'python', file: 'main.py' },
  java: { lang: 'java', file: 'Main.java' },
  c: { lang: 'c', file: 'main.c' },
  cpp: { lang: 'c++', file: 'main.cpp' },
};

type Runtime = { language: string; version: string; aliases?: string[] };
let runtimesCache: Runtime[] | null = null;

async function pistonRuntimes(): Promise<Runtime[]> {
  if (!runtimesCache) {
    const res = await fetch(`${PISTON}/runtimes`);
    if (!res.ok) throw new Error(`Piston runtimes ${res.status}`);
    runtimesCache = (await res.json()) as Runtime[];
  }
  return runtimesCache;
}

async function runViaPiston(language: string, code: string): Promise<RunResult> {
  const map = PISTON_LANG[language];
  if (!map) return { stdout: '', stderr: '', error: `Unsupported language: ${language}` };

  let version: string;
  try {
    const runtimes = await pistonRuntimes();
    const rt = runtimes.find(
      (r) => r.language === map.lang || r.aliases?.includes(map.lang),
    );
    if (!rt) return { stdout: '', stderr: '', error: `${language} is not available right now.` };
    version = rt.version;
  } catch {
    return { stdout: '', stderr: '', error: 'Code execution service is unreachable.' };
  }

  const res = await fetch(`${PISTON}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: map.lang,
      version,
      files: [{ name: map.file, content: code }],
      run_timeout: TIMEOUT_MS,
      compile_timeout: COMPILE_TIMEOUT_MS,
    }),
  });
  if (!res.ok) {
    return { stdout: '', stderr: '', error: `Execution service error (${res.status}).` };
  }
  const data = (await res.json()) as {
    run?: { stdout?: string; stderr?: string; signal?: string | null };
    compile?: { code?: number; stderr?: string };
  };

  // Surface a compile failure (C/C++/Java) clearly.
  if (data.compile && data.compile.code && data.compile.code !== 0) {
    return { stdout: '', stderr: data.compile.stderr ?? '', error: 'Compilation failed.' };
  }
  const run = data.run ?? {};
  return {
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? '',
    error: run.signal ? `Execution terminated (${run.signal}).` : null,
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

  try {
    const result = localExecutionEnabled()
      ? await runLocal(language, code)
      : await runViaPiston(language, code);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ stdout: '', stderr: '', error: message }, { status: 500 });
  }
}

// app/api/run/route.ts
//
// ⚠️ UNSANDBOXED CODE EXECUTION — LOCAL DEVELOPMENT ONLY ⚠️
//
// This route runs user-submitted code directly on the server using the language
// runtimes/compilers installed on this machine (node / python / javac+java /
// cc / c++). The submitted code executes with the FULL privileges of the server
// process — there is no Docker container, VM, or external sandboxing service.
// NEVER expose this endpoint to untrusted users or deploy it to a shared/production
// environment.

import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// We rely on Node.js APIs (child_process, fs, os), so force the Node runtime.
export const runtime = 'nodejs';

const TIMEOUT_MS = 5000;
const COMPILE_TIMEOUT_MS = 15000; // compilers can be slower than execution
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MB cap on captured stdout/stderr.

// Hard safety gate — see file header. Runs ONLY when NOT in production AND
// ALLOW_LOCAL_CODE_EXECUTION=true.
function localExecutionEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_LOCAL_CODE_EXECUTION === 'true'
  );
}

type RunResult = { stdout: string; stderr: string; error: string | null };

const RUNTIME_MISSING = 'RUNTIME_MISSING';

function isRuntimeMissing(code: string | number | undefined, stderr: string): boolean {
  if (code === 'ENOENT') return true;
  if (code === 9009 && /not found|not recognized/i.test(stderr)) return true;
  return false;
}

type Step = { cmd: string; args: string[] };

type RuntimeConfig = {
  /** Source filename written into the temp dir (fixed name where it matters, e.g. Java). */
  filename: string;
  /** Optional compile step; if it fails the compiler output is shown as the error. */
  compile?: Step;
  /** Command to run (the program, or the compiled binary). */
  run: Step;
  notInstalledMessage: string;
};

// `out` is the compiled binary path (in the temp dir) for compiled languages.
function configFor(language: string, dir: string): RuntimeConfig | null {
  const out = path.join(dir, 'program.out');
  switch (language) {
    case 'javascript':
      return {
        filename: 'main.js',
        run: { cmd: 'node', args: [path.join(dir, 'main.js')] },
        notInstalledMessage: 'Node.js is not installed on this machine.',
      };
    case 'python':
      return {
        filename: 'main.py',
        run: { cmd: 'python3', args: [path.join(dir, 'main.py')] },
        notInstalledMessage: 'Python 3 is not installed on this machine (try: brew install python3).',
      };
    case 'java':
      // The public class must be named Main (see the starter template).
      return {
        filename: 'Main.java',
        compile: { cmd: 'javac', args: [path.join(dir, 'Main.java')] },
        run: { cmd: 'java', args: ['-cp', dir, 'Main'] },
        notInstalledMessage:
          'Java (JDK) is not installed on this machine. Install a JDK (e.g. brew install openjdk) to run Java.',
      };
    case 'c':
      return {
        filename: 'main.c',
        compile: { cmd: 'cc', args: [path.join(dir, 'main.c'), '-o', out] },
        run: { cmd: out, args: [] },
        notInstalledMessage:
          'A C compiler is not installed. On macOS run: xcode-select --install',
      };
    case 'cpp':
      return {
        filename: 'main.cpp',
        compile: { cmd: 'c++', args: [path.join(dir, 'main.cpp'), '-o', out] },
        run: { cmd: out, args: [] },
        notInstalledMessage:
          'A C++ compiler is not installed. On macOS run: xcode-select --install',
      };
    default:
      return null;
  }
}

/** Run one command (compile or execute), resolving (never rejecting) with a RunResult. */
function execStep(step: Step, cwd: string, timeout: number): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      step.cmd,
      step.args,
      { timeout, maxBuffer: MAX_OUTPUT_BYTES, cwd },
      (err, stdout, stderr) => {
        if (err) {
          const e = err as NodeJS.ErrnoException & {
            code?: string | number;
            killed?: boolean;
            signal?: string;
          };
          if (isRuntimeMissing(e.code, stderr)) {
            resolve({ stdout, stderr, error: RUNTIME_MISSING });
            return;
          }
          if (e.killed && e.signal === 'SIGTERM') {
            resolve({
              stdout,
              stderr,
              error: `Execution timed out after ${timeout / 1000} seconds.`,
            });
            return;
          }
          // Non-zero exit: the program/compiler ran but errored. Details are in
          // stderr; signal failure so a compile error halts before running.
          resolve({ stdout, stderr, error: stderr || 'Process exited with an error.' });
          return;
        }
        resolve({ stdout, stderr, error: null });
      },
    );
  });
}

export async function POST(request: Request) {
  if (!localExecutionEnabled()) {
    return Response.json(
      {
        stdout: '',
        stderr: '',
        error:
          'Code execution is disabled. This unsandboxed runner only works in ' +
          'local development with ALLOW_LOCAL_CODE_EXECUTION=true set in .env.local.',
      },
      { status: 503 },
    );
  }

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

  // One temp dir per run holds the source, any binary, and (for Java) .class files.
  const dir = await mkdtemp(path.join(tmpdir(), 'interview-run-'));
  const config = configFor(language, dir);
  if (!config) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    return Response.json(
      { stdout: '', stderr: '', error: `Unsupported language: ${language}` },
      { status: 400 },
    );
  }

  try {
    await writeFile(path.join(dir, config.filename), code, 'utf8');

    // Compile step (compiled languages only).
    if (config.compile) {
      const compiled = await execStep(config.compile, dir, COMPILE_TIMEOUT_MS);
      if (compiled.error === RUNTIME_MISSING) {
        return Response.json({ stdout: '', stderr: '', error: config.notInstalledMessage });
      }
      if (compiled.error) {
        // Surface the compiler diagnostics as the output.
        return Response.json({ stdout: '', stderr: compiled.stderr, error: 'Compilation failed.' });
      }
    }

    // Run step.
    const result = await execStep(config.run, dir, TIMEOUT_MS);
    if (result.error === RUNTIME_MISSING) {
      return Response.json({ stdout: '', stderr: '', error: config.notInstalledMessage });
    }
    // For a clean non-zero exit we already put stderr in error; normalize so the
    // UI shows stdout+stderr without a duplicate generic message.
    if (result.error && result.error === result.stderr) result.error = null;
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ stdout: '', stderr: '', error: message }, { status: 500 });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

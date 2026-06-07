// app/api/run/route.ts
//
// ⚠️ UNSANDBOXED CODE EXECUTION — LOCAL DEVELOPMENT ONLY ⚠️
//
// This route runs user-submitted code directly on the server using the
// language runtimes installed on this machine (node / python). The submitted
// code executes with the FULL privileges of the server process — there is no
// Docker container, VM, or external sandboxing service. NEVER expose this
// endpoint to untrusted users or deploy it to a shared/production environment.

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// We rely on Node.js APIs (child_process, fs, os), so force the Node runtime.
export const runtime = 'nodejs';

const TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MB cap on captured stdout/stderr.

// Hard safety gate. This endpoint runs arbitrary user code with no sandbox, so it
// must stay inert anywhere that isn't an explicitly opted-in local dev machine.
// It executes ONLY when NOT in production AND the developer has set
// ALLOW_LOCAL_CODE_EXECUTION=true in .env.local. A deployed build
// (NODE_ENV === 'production') can never run code through this route, even if the
// flag is somehow set — defense in depth against accidentally shipping it.
function localExecutionEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_LOCAL_CODE_EXECUTION === 'true'
  );
}

type RunResult = { stdout: string; stderr: string; error: string | null };

// Sentinel error used internally to signal the runtime binary is unavailable,
// so POST() can map it to a friendly per-language message.
const RUNTIME_MISSING = 'RUNTIME_MISSING';

/**
 * Decide whether a failed spawn means the runtime is not installed.
 * - ENOENT: the binary genuinely does not exist on PATH.
 * - Windows exit code 9009 + a "not found / not recognized" message: this is the
 *   Microsoft Store `python`/`node` app-execution-alias stub, which isn't a real
 *   install. We pair the code with the message to avoid misreading a user
 *   program that merely exits 9009 on its own.
 */
function isRuntimeMissing(code: string | number | undefined, stderr: string): boolean {
  if (code === 'ENOENT') return true;
  if (code === 9009 && /not found|not recognized/i.test(stderr)) return true;
  return false;
}

type RuntimeConfig = {
  command: string;
  extension: string;
  notInstalledMessage: string;
};

const RUNTIMES: Record<string, RuntimeConfig> = {
  javascript: {
    command: 'node',
    extension: 'js',
    notInstalledMessage: 'Node.js is not installed on this machine.',
  },
  python: {
    command: 'python',
    extension: 'py',
    notInstalledMessage: 'Python is not installed on this machine.',
  },
};

/**
 * Execute a file with the given runtime command, capturing stdout/stderr and
 * enforcing a wall-clock timeout. Resolves (never rejects) with a RunResult.
 * The special sentinel error 'ENOENT' signals the runtime binary was not found
 * so the caller can map it to a friendly per-language message.
 */
function runFile(command: string, filePath: string): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      [filePath],
      { timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES },
      (err, stdout, stderr) => {
        if (err) {
          const e = err as NodeJS.ErrnoException & {
            code?: string | number;
            killed?: boolean;
            signal?: string;
          };

          // Runtime binary not installed on this machine.
          if (isRuntimeMissing(e.code, stderr)) {
            resolve({ stdout, stderr, error: RUNTIME_MISSING });
            return;
          }

          // Killed by the timeout.
          if (e.killed && e.signal === 'SIGTERM') {
            resolve({
              stdout,
              stderr,
              error: `Execution timed out after ${TIMEOUT_MS / 1000} seconds.`,
            });
            return;
          }

          // Non-zero exit code: the program ran but errored. The details are
          // already in stderr, so surface that without an extra system error.
          resolve({ stdout, stderr, error: null });
          return;
        }

        resolve({ stdout, stderr, error: null });
      },
    );
  });
}

export async function POST(request: Request) {
  // Refuse to execute anywhere this hasn't been explicitly enabled for local dev.
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
    return Response.json(
      { stdout: '', stderr: '', error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const { language, code } = body;

  if (typeof language !== 'string' || typeof code !== 'string') {
    return Response.json(
      { stdout: '', stderr: '', error: 'Request must include string "language" and "code".' },
      { status: 400 },
    );
  }

  const config = RUNTIMES[language];
  if (!config) {
    return Response.json(
      { stdout: '', stderr: '', error: `Unsupported language: ${language}` },
      { status: 400 },
    );
  }

  const filePath = path.join(tmpdir(), `interview-run-${randomUUID()}.${config.extension}`);

  try {
    await writeFile(filePath, code, 'utf8');

    const result = await runFile(config.command, filePath);
    if (result.error === RUNTIME_MISSING) {
      // Don't leak the raw stub/spawn message; show the friendly one.
      result.stderr = '';
      result.error = config.notInstalledMessage;
    }

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ stdout: '', stderr: '', error: message }, { status: 500 });
  } finally {
    // Always clean up the temp file, regardless of how execution ended.
    await rm(filePath, { force: true }).catch(() => {});
  }
}

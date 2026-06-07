'use client';

// Center column of the room: language selector + shared editor + Run + output.
// Language, run output, and the "running" flag all live in Liveblocks Storage so
// both participants stay in sync. The editor text itself syncs via Yjs.

import { useState, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import { useStorage, useMutation } from '@liveblocks/react';
import type { EditorApi } from './editorApi';

// y-monaco touches `window` at import time, so this module must never be
// evaluated on the server. Load it client-side only.
const CollaborativeEditor = dynamic(() => import('./CollaborativeEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      Loading editor…
    </div>
  ),
});
import type { Role, SupportedLanguage } from '@/src/features/room/liveblocks.config';
import { getProblem } from '@/src/features/problems/problems';

type RunResult = { stdout?: string; stderr?: string; error?: string | null };

// Merge the server's stdout/stderr/error into one human-readable block.
function formatResult(data: RunResult): string {
  const parts: string[] = [];
  if (data.stdout && data.stdout.trim()) parts.push(data.stdout.replace(/\s+$/, ''));
  if (data.stderr && data.stderr.trim()) parts.push(data.stderr.replace(/\s+$/, ''));
  if (data.error) parts.push('Error: ' + data.error);
  return parts.length > 0 ? parts.join('\n') : '(no output)';
}

interface Props {
  role: Role;
  name: string;
  apiRef: RefObject<EditorApi | null>;
}

export default function EditorPanel({ role, name, apiRef }: Props) {
  const language = useStorage((root) => root.language);
  const output = useStorage((root) => root.output);
  const running = useStorage((root) => root.running);
  const activeProblemId = useStorage((root) => root.activeProblemId);

  // Local flag so the button shows "Running…" on the clicker's side immediately.
  const [localRunning, setLocalRunning] = useState(false);

  const setLanguage = useMutation(({ storage }, value: SupportedLanguage) => {
    storage.set('language', value);
  }, []);

  const setOutput = useMutation(({ storage }, value: string) => {
    storage.set('output', value);
  }, []);

  const setRunning = useMutation(({ storage }, value: boolean) => {
    storage.set('running', value);
  }, []);

  // Storage may still be loading on the very first frame.
  if (!language || activeProblemId == null) {
    return <div className="flex-1 bg-zinc-950" />;
  }

  const handleRun = async () => {
    const code = apiRef.current?.getCode() ?? '';
    setLocalRunning(true);
    setRunning(true);
    setOutput('Running…');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code }),
      });
      const data: RunResult = await res.json();
      setOutput(formatResult(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOutput('Failed to reach the execution server: ' + message);
    } finally {
      setLocalRunning(false);
      setRunning(false);
    }
  };

  const busy = running || localRunning;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Language
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
        </label>

        <button
          onClick={handleRun}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Running…' : '▶ Run'}
        </button>
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1">
        <CollaborativeEditor
          language={language}
          role={role}
          name={name}
          apiRef={apiRef}
          initialCode={getProblem(activeProblemId).starter[language]}
        />
      </div>

      {/* Output */}
      <div className="flex flex-col border-t border-zinc-800">
        <div className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Output
        </div>
        <pre
          data-testid="run-output"
          className="max-h-44 min-h-20 overflow-auto whitespace-pre-wrap bg-black px-4 pb-4 font-mono text-sm text-zinc-200"
        >
          {output && output.length > 0 ? output : 'Run the code to see output here.'}
        </pre>
      </div>
    </div>
  );
}

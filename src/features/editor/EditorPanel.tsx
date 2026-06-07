'use client';

// Center column of the room: language selector + shared editor + Run + output.
// Language, run output, and the "running" flag all live in Liveblocks Storage so
// both participants stay in sync. The editor text itself syncs via Yjs.

import { useState, useEffect, useRef, type RefObject } from 'react';
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
import { getProblem, starterFor } from '@/src/features/problems/problems';
import { LANGUAGES } from './languages';

type RunResult = { stdout?: string; stderr?: string; error?: string | null };

// Merge the server's stdout/stderr/error into one human-readable block.
function formatResult(data: RunResult): string {
  const parts: string[] = [];
  if (data.stdout && data.stdout.trim()) parts.push(data.stdout.replace(/\s+$/, ''));
  if (data.stderr && data.stderr.trim()) parts.push(data.stderr.replace(/\s+$/, ''));
  if (data.error) parts.push('Error: ' + data.error);
  return parts.length > 0 ? parts.join('\n') : '(no output)';
}

const OUTPUT_HEIGHT_MIN = 80;
const OUTPUT_HEIGHT_MAX = 480;
const OUTPUT_HEIGHT_DEFAULT = 176;

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

  // Resizable output panel state.
  const [outputHeight, setOutputHeight] = useState(OUTPUT_HEIGHT_DEFAULT);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(OUTPUT_HEIGHT_DEFAULT);

  const setLanguage = useMutation(({ storage }, value: SupportedLanguage) => {
    storage.set('language', value);
  }, []);

  const setOutput = useMutation(({ storage }, value: string) => {
    storage.set('output', value);
  }, []);

  const setRunning = useMutation(({ storage }, value: boolean) => {
    storage.set('running', value);
  }, []);

  // Drag-to-resize: attach window-level listeners once so they work even when
  // the pointer leaves the handle. Clean up on unmount.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      // Dragging UP (negative delta) increases output height; dragging DOWN shrinks it.
      const delta = dragStartY.current - e.clientY;
      const next = Math.min(
        OUTPUT_HEIGHT_MAX,
        Math.max(OUTPUT_HEIGHT_MIN, dragStartHeight.current + delta),
      );
      setOutputHeight(next);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = outputHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

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
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={handleRun}
          // Disable ONLY on this client's in-flight run (prevents double-submit).
          // Do NOT gate on the shared `running` flag: if a peer disconnects
          // mid-run, that flag stays true in persistent Liveblocks Storage and
          // would otherwise disable Run for everyone for the rest of the session.
          disabled={localRunning}
          className="rounded-lg bg-brand px-5 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Running…' : '▶ Run Code'}
        </button>
      </div>

      {/* Editor — takes remaining space above the output panel */}
      <div className="min-h-0 flex-1">
        <CollaborativeEditor
          language={language}
          role={role}
          name={name}
          apiRef={apiRef}
          initialCode={starterFor(getProblem(activeProblemId), language)}
        />
      </div>

      {/* Drag handle — separates editor from output */}
      <div
        onMouseDown={handleDragStart}
        className="group flex h-2 cursor-row-resize items-center justify-center border-t border-zinc-800 bg-zinc-950 hover:bg-zinc-800 transition-colors"
        title="Drag to resize output"
        aria-hidden="true"
      >
        {/* Visual grip dots */}
        <div className="flex gap-0.5 opacity-40 group-hover:opacity-80 transition-opacity">
          <span className="h-1 w-1 rounded-full bg-zinc-400" />
          <span className="h-1 w-1 rounded-full bg-zinc-400" />
          <span className="h-1 w-1 rounded-full bg-zinc-400" />
        </div>
      </div>

      {/* Output — height controlled by drag */}
      <div className="flex flex-col border-t border-zinc-800" style={{ height: outputHeight }}>
        <div className="shrink-0 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Output
        </div>
        <pre
          data-testid="run-output"
          className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-black px-4 pb-4 font-mono text-sm text-zinc-200"
        >
          {output && output.length > 0 ? output : 'Run the code to see output here.'}
        </pre>
      </div>
    </div>
  );
}

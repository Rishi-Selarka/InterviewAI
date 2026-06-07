'use client';

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import '@/src/features/editor/setupMonaco'; // self-host Monaco (no CDN)
import Logo from '@/src/features/brand/Logo';
import { LANGUAGES, LANGUAGE_TEMPLATES } from '@/src/features/editor/languages';
import type { SupportedLanguage } from '@/src/features/room/liveblocks.config';

type Language = SupportedLanguage;
type RunResult = { stdout?: string; stderr?: string; error?: string | null };

function formatResult(data: RunResult): string {
  const parts: string[] = [];
  if (data.stdout && data.stdout.trim()) parts.push(data.stdout.replace(/\s+$/, ''));
  if (data.stderr && data.stderr.trim()) parts.push(data.stderr.replace(/\s+$/, ''));
  if (data.error) parts.push('Error: ' + data.error);
  return parts.length > 0 ? parts.join('\n') : '(no output)';
}

const OUT_MIN = 80;
const OUT_MAX = 520;

export default function CodingPad() {
  const [language, setLanguage] = useState<Language>('javascript');
  const [code, setCode] = useState<string>(LANGUAGE_TEMPLATES.javascript);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Resizable output panel.
  const [outputHeight, setOutputHeight] = useState(180);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(180);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY; // drag up = taller
      setOutputHeight(Math.min(OUT_MAX, Math.max(OUT_MIN, startH.current + delta)));
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = outputHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleLanguageChange = (next: Language) => {
    setLanguage(next);
    setCode(LANGUAGE_TEMPLATES[next]); // load boilerplate for the chosen language
    setOutput('');
  };

  const handleRun = async () => {
    setIsRunning(true);
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
      setIsRunning(false);
    }
  };

  return (
    <div data-theme="dark" className="flex h-[100dvh] flex-col bg-ink text-zinc-100">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-2.5">
        <div className="flex items-center gap-3">
          <Logo href="/" textClassName="text-base" markClassName="h-7 w-7" />
          <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted">Coding Pad</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Language</span>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as Language)}
                className="cursor-pointer appearance-none rounded-lg border border-line bg-surface py-1.5 pl-3 pr-9 text-sm font-medium text-zinc-100 outline-none transition-colors hover:bg-surface2 focus:border-brand"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="rounded-lg bg-brand px-5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning ? 'Running…' : '▶ Run Code'}
          </button>
        </div>
      </header>

      {/* Editor fills the remaining space */}
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value ?? '')}
          loading={<div className="p-4 text-sm text-muted">Loading editor…</div>}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
          }}
        />
      </div>

      {/* Drag handle to resize the output */}
      <div
        onMouseDown={startDrag}
        title="Drag to resize output"
        className="group flex h-2.5 shrink-0 cursor-row-resize items-center justify-center border-t border-line bg-ink2 transition-colors hover:bg-surface2"
      >
        <div className="flex gap-1 opacity-50 transition-opacity group-hover:opacity-90">
          <span className="h-1 w-1 rounded-full bg-muted" />
          <span className="h-1 w-1 rounded-full bg-muted" />
          <span className="h-1 w-1 rounded-full bg-muted" />
        </div>
      </div>

      {/* Output (resizable height) */}
      <div className="flex shrink-0 flex-col border-t border-line" style={{ height: outputHeight }}>
        <div className="shrink-0 px-5 py-1.5 text-xs font-medium uppercase tracking-wide text-faint">
          Output
        </div>
        <pre className="flex-1 overflow-auto whitespace-pre-wrap bg-black px-5 pb-4 font-mono text-sm text-zinc-200">
          {output || 'Run your code to see output here.'}
        </pre>
      </div>
    </div>
  );
}

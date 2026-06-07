'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import '@/src/features/editor/setupMonaco'; // self-host Monaco (no CDN)
import Logo from '@/src/features/brand/Logo';
import { LANGUAGES, LANGUAGE_TEMPLATES } from '@/src/features/editor/languages';
import type { SupportedLanguage } from '@/src/features/room/liveblocks.config';

type Language = SupportedLanguage;

type RunResult = { stdout?: string; stderr?: string; error?: string | null };

/**
 * Combine the server's stdout/stderr/error into a single human-readable string
 * for the output box.
 */
function formatResult(data: RunResult): string {
  const parts: string[] = [];
  if (data.stdout && data.stdout.trim()) parts.push(data.stdout.replace(/\s+$/, ''));
  if (data.stderr && data.stderr.trim()) parts.push(data.stderr.replace(/\s+$/, ''));
  if (data.error) parts.push('Error: ' + data.error);
  return parts.length > 0 ? parts.join('\n') : '(no output)';
}

export default function CodingPad() {
  const [language, setLanguage] = useState<Language>('javascript');
  const [code, setCode] = useState<string>(LANGUAGE_TEMPLATES.javascript);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleLanguageChange = (next: Language) => {
    setLanguage(next);
    setCode(LANGUAGE_TEMPLATES[next]);
    setOutput('');
  };

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Running...');
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
    <div data-theme="dark" className="flex flex-1 flex-col gap-4 bg-ink p-6 text-zinc-100">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo href="/" textClassName="text-base" markClassName="h-7 w-7" />
          <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted">Coding Pad</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Language
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-brand"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-line">
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

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="rounded-lg bg-gradient-to-r from-brand2 to-brand px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-opacity hover:opacity-90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning ? 'Running...' : '▶ Run Code'}
          </button>
          <span className="text-xs uppercase tracking-wide text-faint">Output</span>
        </div>
        <pre className="max-h-56 min-h-24 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-black p-4 font-mono text-sm text-zinc-200">
          {output || 'Run your code to see output here.'}
        </pre>
      </div>
    </div>
  );
}

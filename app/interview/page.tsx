'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';

type Language = 'javascript' | 'python';

const STARTER_CODE: Record<Language, string> = {
  javascript: `// Write some JavaScript and hit Run.
function greet(name) {
  console.log("Hello, " + name + "!");
  return name.length;
}

greet("world");`,
  python: `# Write some Python and hit Run.
def greet(name):
    print(f"Hello, {name}!")
    return len(name)

greet("world")`,
};

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

export default function InterviewPage() {
  const [language, setLanguage] = useState<Language>('javascript');
  const [code, setCode] = useState<string>(STARTER_CODE.javascript);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleLanguageChange = (next: Language) => {
    setLanguage(next);
    setCode(STARTER_CODE[next]);
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
    <div className="flex flex-1 flex-col gap-4 bg-zinc-950 p-6 text-zinc-100">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Interview Pad</h1>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Language
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-800">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value ?? '')}
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
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Output
          </span>
        </div>
        <pre className="max-h-56 min-h-24 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black p-4 font-mono text-sm text-zinc-200">
          {output || 'Run your code to see output here.'}
        </pre>
      </div>
    </div>
  );
}

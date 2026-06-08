'use client';

// Interviewer-only "AI second judge". Reads the candidate's current code from the
// shared editor + the active problem, asks the AI for an unbiased assessment, and
// shows its rubric scores, summary, strengths/concerns, and follow-up questions.

import { useState, type RefObject } from 'react';
import { useStorage } from '@liveblocks/react';
import { getProblem } from '@/src/features/problems/problems';
import { languageLabel } from '@/src/features/editor/languages';
import type { EditorApi } from '@/src/features/editor/editorApi';

interface AIResult {
  problemSolving: number;
  codeQuality: number;
  debugging: number;
  efficiency: number;
  communication: number;
  overall: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  followUpQuestions: string[];
}

const ROWS: { key: keyof AIResult; label: string }[] = [
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'codeQuality', label: 'Code Quality' },
  { key: 'debugging', label: 'Debugging' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'communication', label: 'Communication' },
];

export default function AIEvaluationPanel({ apiRef }: { apiRef: RefObject<EditorApi | null> }) {
  const activeProblemId = useStorage((root) => root.activeProblemId);
  const language = useStorage((root) => root.language);

  const [result, setResult] = useState<AIResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const code = apiRef.current?.getCode() ?? '';
    if (!code.trim()) {
      setError('No code in the editor yet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const problem = activeProblemId ? getProblem(activeProblemId) : null;
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemTitle: problem?.title ?? 'Coding task',
          problemDescription: problem?.description ?? '',
          language: language ?? 'unknown',
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'AI evaluation failed.');
        return;
      }
      setResult(data as AIResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          AI Second Judge
        </h3>
        <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brandbright">
          {languageLabel(language ?? 'javascript')}
        </span>
      </div>

      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-gradient-to-r from-brand2 to-brand px-3 py-2 text-sm font-semibold text-onbrand shadow-lg shadow-brand/20 transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? 'Analyzing the solution…' : '✨ Evaluate with AI'}
      </button>

      {error && <p className="text-center text-xs text-rose-400">{error}</p>}

      {result && (
        <div className="rounded-md border border-brand/30 bg-brand/5 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              AI Assessment
            </span>
            <span className="text-sm">
              <span className="text-zinc-400">Overall </span>
              <span className="text-lg font-bold text-brandbright">{result.overall}</span>
              <span className="text-zinc-500"> / 5</span>
            </span>
          </div>

          <ul className="space-y-1 text-sm">
            {ROWS.map((r) => (
              <li key={r.key} className="flex justify-between">
                <span className="text-zinc-400">{r.label}</span>
                <span className="font-medium text-zinc-100">{result[r.key] as number}</span>
              </li>
            ))}
          </ul>

          {result.summary && (
            <p className="mt-2 border-t border-zinc-800 pt-2 text-sm text-zinc-300">
              {result.summary}
            </p>
          )}

          {result.strengths.length > 0 && (
            <Section title="Strengths" items={result.strengths} color="text-emerald-300" />
          )}
          {result.concerns.length > 0 && (
            <Section title="Concerns" items={result.concerns} color="text-amber-300" />
          )}
          {result.followUpQuestions.length > 0 && (
            <Section title="Suggested follow-ups" items={result.followUpQuestions} color="text-sky-300" />
          )}

          <p className="mt-2 text-center text-[10px] text-faint">
            AI suggestion — a second opinion, not a verdict.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="mt-2">
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${color}`}>{title}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-zinc-300">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

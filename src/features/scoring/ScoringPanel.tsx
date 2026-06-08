'use client';

// Interviewer-only scoring panel. Rendered ONLY when role === 'interviewer', so
// the candidate never sees it. On submit it computes a summary (per-criterion
// scores + average + notes) and shows it on screen.
//
// On submit it shows the on-screen summary AND persists the evaluation to the
// database (the evaluations table, via /api/evaluations — RLS enforces that only
// the owning interviewer can write it). It is never synced to the candidate.

import { useState } from 'react';
import { RUBRIC, type RubricScores } from './rubric';

const SCALE = [1, 2, 3, 4, 5];

// Maps our rubric keys to the evaluations table column names.
const COLUMN: Record<string, string> = {
  problemSolving: 'problem_solving',
  codeQuality: 'code_quality',
  debugging: 'debugging',
  efficiency: 'efficiency',
  communication: 'communication',
};

interface Summary {
  scores: RubricScores;
  average: number;
  notes: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ScoringPanel({
  interviewId,
  guest,
}: {
  interviewId: string;
  guest?: boolean;
}) {
  // Default every criterion to 3 (neutral).
  const [scores, setScores] = useState<RubricScores>(() =>
    Object.fromEntries(RUBRIC.map((c) => [c.key, 3])),
  );
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const setScore = (key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
    setSummary(null); // invalidate a stale summary once edits resume
    setSaveState('idle');
  };

  const handleSubmit = async () => {
    const values = RUBRIC.map((c) => scores[c.key]);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    setSummary({ scores: { ...scores }, average, notes });

    // No-login demo: there's no database to write to, so just show the summary.
    if (guest) {
      setSaveState('idle');
      return;
    }

    // Persist to the database.
    setSaveState('saving');
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = { interviewId, notes };
      for (const c of RUBRIC) payload[COLUMN[c.key]] = scores[c.key];
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || 'Could not save.');
        setSaveState('error');
        return;
      }
      setSaveState('saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setSaveState('error');
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Evaluation
        </h3>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Interviewer only
        </span>
      </div>

      <div className="space-y-2.5">
        {RUBRIC.map((c) => (
          <div key={c.key}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-200" title={c.hint}>
                {c.label}
              </span>
              <span className="text-sm font-semibold text-emerald-400">
                {scores[c.key]}
              </span>
            </div>
            <div className="mt-1 flex gap-1">
              {SCALE.map((n) => (
                <button
                  key={n}
                  onClick={() => setScore(c.key, n)}
                  className={`h-7 flex-1 rounded text-xs font-medium transition-colors ${
                    scores[c.key] === n
                      ? 'bg-gradient-to-r from-brand2 to-brand text-onbrand'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                  aria-label={`${c.label}: ${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSummary(null);
            setSaveState('idle');
          }}
          rows={3}
          placeholder="Observations, strengths, concerns…"
          className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={saveState === 'saving'}
        className="rounded-lg bg-gradient-to-r from-brand2 to-brand px-3 py-2 text-sm font-semibold text-onbrand shadow-lg shadow-brand/20 transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saveState === 'saving' ? 'Saving…' : 'Submit Evaluation'}
      </button>

      {saveState === 'saved' && (
        <p className="text-center text-xs text-emerald-400">✓ Evaluation saved.</p>
      )}
      {saveState === 'error' && (
        <p className="text-center text-xs text-rose-400">Could not save: {saveError}</p>
      )}

      {summary && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Summary
            </span>
            <span className="text-sm">
              <span className="text-zinc-400">Average </span>
              <span className="text-lg font-bold text-emerald-400">
                {summary.average.toFixed(1)}
              </span>
              <span className="text-zinc-500"> / 5</span>
            </span>
          </div>
          <ul className="space-y-1 text-sm">
            {RUBRIC.map((c) => (
              <li key={c.key} className="flex justify-between">
                <span className="text-zinc-400">{c.label}</span>
                <span className="font-medium text-zinc-100">{summary.scores[c.key]}</span>
              </li>
            ))}
          </ul>
          {summary.notes.trim() && (
            <p className="mt-2 whitespace-pre-wrap border-t border-zinc-800 pt-2 text-sm text-zinc-300">
              {summary.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

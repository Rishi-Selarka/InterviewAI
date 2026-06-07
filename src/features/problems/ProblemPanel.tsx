'use client';

// Left column: the active problem statement, synced to both participants via
// Liveblocks Storage. The interviewer can switch the active problem and load its
// starter code into the shared editor; the candidate sees a read-only view.

import { type RefObject } from 'react';
import { useStorage, useMutation } from '@liveblocks/react';
import { PROBLEMS, getProblem } from './problems';
import type { EditorApi } from '@/src/features/editor/editorApi';
import type { Role } from '@/src/features/room/liveblocks.config';

const CATEGORY_STYLES: Record<string, string> = {
  Debug: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Optimize: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Secure: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

interface Props {
  role: Role;
  apiRef: RefObject<EditorApi | null>;
}

export default function ProblemPanel({ role, apiRef }: Props) {
  const activeProblemId = useStorage((root) => root.activeProblemId);
  const language = useStorage((root) => root.language);

  const setActiveProblem = useMutation(({ storage }, id: string) => {
    storage.set('activeProblemId', id);
  }, []);

  if (activeProblemId == null || !language) {
    return <div className="h-full bg-zinc-900" />;
  }

  const problem = getProblem(activeProblemId);
  const isInterviewer = role === 'interviewer';

  const handleLoadStarter = () => {
    const existing = apiRef.current?.getCode() ?? '';
    if (
      existing.trim().length > 0 &&
      !window.confirm(
        'Replace the current editor contents with this problem’s starter code? ' +
          'This affects both participants.',
      )
    ) {
      return;
    }
    apiRef.current?.loadCode(problem.starter[language]);
  };

  return (
    <div className="flex h-full flex-col bg-zinc-900 text-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Problem
        </h2>
        {isInterviewer && (
          <select
            value={activeProblemId}
            onChange={(e) => setActiveProblem(e.target.value)}
            className="max-w-[12rem] truncate rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-zinc-500"
            title="Switch the active problem"
          >
            {PROBLEMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              CATEGORY_STYLES[problem.category] ?? 'border-zinc-600 text-zinc-300'
            }`}
          >
            {problem.category}
          </span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
            {problem.difficulty}
          </span>
        </div>

        <h1 className="mb-3 text-lg font-semibold leading-snug text-zinc-50">
          {problem.title}
        </h1>

        <p className="mb-4 text-sm leading-relaxed text-zinc-300">
          {problem.description}
        </p>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Expected behaviour
        </h3>
        <ul className="space-y-2">
          {problem.examples.map((ex, i) => (
            <li
              key={i}
              className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5 text-sm"
            >
              <code className="text-zinc-200">{ex.label}</code>
              <span className="text-zinc-500"> → </span>
              <span className="text-emerald-400">{ex.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {isInterviewer && (
        <div className="border-t border-zinc-800 p-3">
          <button
            onClick={handleLoadStarter}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
            title="Load this problem's starter code into the shared editor"
          >
            Load starter code into editor
          </button>
          <p className="mt-1.5 text-center text-[11px] text-zinc-500">
            Loads the {language === 'python' ? 'Python' : 'JavaScript'} version for everyone.
          </p>
        </div>
      )}
    </div>
  );
}

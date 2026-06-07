'use client';

// Left column: the active problem statement, synced to both participants via
// Liveblocks Storage. The interviewer can search for problems, switch the
// active problem, and see an interviewer-only guide. The candidate sees a
// read-only view of the active problem — no search box, no guide.

import { type RefObject, useState, useMemo } from 'react';
import { useStorage, useMutation } from '@liveblocks/react';
import { PROBLEMS, getProblem, starterFor } from './problems';
import { languageLabel } from '@/src/features/editor/languages';
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

  // Interviewer-only local state
  const [searchQuery, setSearchQuery] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const setActiveProblem = useMutation(({ storage }, id: string) => {
    storage.set('activeProblemId', id);
  }, []);

  // ── Search filtering (interviewer only). Must run before any early return so
  //    hooks are called in the same order every render. ──────────────────────
  const filteredProblems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return PROBLEMS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.topics.some((t) => t.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  if (activeProblemId == null || !language) {
    return <div className="h-full bg-surface" />;
  }

  const problem = getProblem(activeProblemId);
  const isInterviewer = role === 'interviewer';
  const showResults = searchQuery.trim().length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectProblem = (id: string) => {
    setActiveProblem(id);
    setSearchQuery('');
    setGuideOpen(false);
  };

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
    apiRef.current?.loadCode(starterFor(problem, language));
  };

  return (
    <div className="flex h-full flex-col bg-zinc-900 text-zinc-200">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Problem
        </h2>
        {isInterviewer && (
          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400 border border-orange-500/20">
            Interviewer view
          </span>
        )}
      </div>

      {/* ── Interviewer: search box ─────────────────────────────────────────── */}
      {isInterviewer && (
        <div className="relative border-b border-zinc-800 px-3 py-2.5">
          <input
            type="search"
            placeholder="Search by title or topic…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500/60 transition-colors"
          />

          {/* Dropdown results */}
          {showResults && (
            <div className="absolute left-3 right-3 top-full z-10 mt-0.5 rounded-md border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
              {filteredProblems.length === 0 ? (
                <p className="px-3 py-2 text-xs text-zinc-500">No problems match.</p>
              ) : (
                <ul>
                  {filteredProblems.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => handleSelectProblem(p.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800 ${
                          p.id === activeProblemId ? 'bg-zinc-800' : ''
                        }`}
                      >
                        <span
                          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                            CATEGORY_STYLES[p.category] ?? 'border-zinc-600 text-zinc-300'
                          }`}
                        >
                          {p.category}
                        </span>
                        <span className="truncate text-zinc-100">{p.title}</span>
                        <span className="ml-auto shrink-0 text-zinc-500">{p.difficulty}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Problem statement (scrollable) ─────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {/* Category + difficulty badges */}
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

        {/* Topics (interviewer only — avoids hinting the candidate) */}
        {isInterviewer && problem.topics.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {problem.topics.map((t) => (
              <span
                key={t}
                className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
              >
                {t}
              </span>
            ))}
          </div>
        )}

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

        {/* ── Interviewer-only guide ──────────────────────────────────────── */}
        {isInterviewer && (
          <div className="mt-5">
            <button
              onClick={() => setGuideOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-md border border-orange-500/25 bg-orange-500/8 px-3 py-2 text-xs font-semibold text-orange-400 transition-colors hover:bg-orange-500/15"
              aria-expanded={guideOpen}
            >
              <span>Interviewer guide</span>
              <svg
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${guideOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {guideOpen && (
              <div className="mt-2 space-y-4 rounded-md border border-orange-500/20 bg-zinc-950 p-3 text-xs">
                <GuideSection
                  title="What to check"
                  color="text-emerald-400"
                  items={problem.guide.whatToCheck}
                />
                <GuideSection
                  title="Common mistakes"
                  color="text-amber-400"
                  items={problem.guide.commonMistakes}
                />
                <GuideSection
                  title="Cross-questions"
                  color="text-sky-400"
                  items={problem.guide.crossQuestions}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Interviewer: load starter code footer ──────────────────────────── */}
      {isInterviewer && (
        <div className="border-t border-zinc-800 p-3">
          <button
            onClick={handleLoadStarter}
            className="w-full rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-300 transition-colors hover:bg-orange-500/20 hover:text-orange-200"
            title="Load this problem's starter code into the shared editor"
          >
            Load starter code into editor
          </button>
          <p className="mt-1.5 text-center text-[11px] text-zinc-500">
            Loads the {languageLabel(language)} version for everyone.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function GuideSection({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div>
      <p className={`mb-1.5 font-semibold uppercase tracking-wide ${color}`}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-zinc-300 leading-relaxed">
            <span className={`mt-0.5 shrink-0 ${color}`}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

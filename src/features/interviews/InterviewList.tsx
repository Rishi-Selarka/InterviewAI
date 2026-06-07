'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Interview } from '@/src/features/interviews/server/interviews';

type FilterTab = 'all' | 'active' | 'ended' | 'created';

const STATUS_STYLES: Record<string, string> = {
  created: 'bg-zinc-500/15 text-fg',
  active: 'bg-emerald-500/15 text-emerald-300',
  ended: 'bg-brand/15 text-brandbright',
};

function interviewDisplayName(iv: Interview): string {
  return iv.title?.trim() || `Interview ${iv.room_id}`;
}

export default function InterviewList({ interviews }: { interviews: Interview[] }) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const counts: Record<FilterTab, number> = {
    all: interviews.length,
    active: interviews.filter((i) => i.status === 'active').length,
    ended: interviews.filter((i) => i.status === 'ended').length,
    created: interviews.filter((i) => i.status === 'created').length,
  };

  const filtered =
    activeTab === 'all' ? interviews : interviews.filter((i) => i.status === activeTab);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'ended', label: 'Ended' },
    { key: 'created', label: 'Created' },
  ];

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-brand/15 text-brandbright'
                : 'text-muted hover:bg-surface2 hover:text-fg'
            }`}
          >
            {label}
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                activeTab === key ? 'bg-brand/20 text-brandbright' : 'bg-surface text-faint'
              }`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card border-dashed p-10 text-center">
          <p className="text-sm text-muted">
            {activeTab === 'all'
              ? <>No interviews yet. Click <strong className="text-fg">New interview</strong> to create one.</>
              : `No ${activeTab} interviews.`}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((iv) => (
            <li
              key={iv.id}
              className="card card-hover flex items-center justify-between px-4 py-3.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-strong">
                    {interviewDisplayName(iv)}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[iv.status] ?? ''}`}
                  >
                    {iv.status}
                  </span>
                  {iv.candidate_id && (
                    <span className="hidden shrink-0 text-xs text-faint sm:inline">
                      candidate joined
                    </span>
                  )}
                </div>
                <span className="mt-0.5 block text-xs text-faint">
                  {new Date(iv.created_at).toLocaleString()}
                </span>
              </div>
              <div className="ml-4 flex shrink-0 gap-2">
                <Link href={`/interviews/${iv.id}`} className="btn-ghost px-3.5 py-1.5 text-sm">
                  Details
                </Link>
                <Link href={`/room/${iv.room_id}`} className="btn-primary px-3.5 py-1.5 text-sm">
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

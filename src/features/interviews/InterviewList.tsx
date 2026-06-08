'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Interview } from '@/src/features/interviews/server/interviews';

type FilterTab = 'all' | 'scheduled' | 'active' | 'ended' | 'created';

const STATUS_STYLES: Record<string, string> = {
  created: 'bg-zinc-500/15 text-fg',
  scheduled: 'bg-brand/15 text-brandbright',
  active: 'bg-emerald-500/15 text-emerald-300',
  ended: 'bg-zinc-500/15 text-muted',
};

function interviewDisplayName(iv: Interview): string {
  return iv.title?.trim() || `Interview ${iv.room_id}`;
}

function fmtSchedule(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InterviewList({ interviews }: { interviews: Interview[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [closingId, setClosingId] = useState<string | null>(null);

  const counts: Record<FilterTab, number> = {
    all: interviews.length,
    scheduled: interviews.filter((i) => i.status === 'scheduled').length,
    active: interviews.filter((i) => i.status === 'active').length,
    ended: interviews.filter((i) => i.status === 'ended').length,
    created: interviews.filter((i) => i.status === 'created').length,
  };

  const filtered =
    activeTab === 'all' ? interviews : interviews.filter((i) => i.status === activeTab);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'active', label: 'Active' },
    { key: 'ended', label: 'Ended' },
    { key: 'created', label: 'Created' },
  ];

  // Close (end) an interview straight from its row — useful if a session is stuck
  // active/created after an error and should no longer count as open.
  async function closeInterview(id: string, name: string) {
    if (!window.confirm(`Close "${name}"? This marks the interview as ended.`)) return;
    setClosingId(id);
    try {
      const res = await fetch('/api/interviews/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || 'Could not close the interview.');
      } else {
        router.refresh(); // re-fetch the list so status flips to "ended"
      }
    } catch {
      window.alert('Could not reach the server. Please try again.');
    } finally {
      setClosingId(null);
    }
  }

  return (
    <div>
      {/* Filter cards — clickable count cards that filter the list below. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tabs.map(({ key, label }) => {
          const selected = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-pressed={selected}
              className={`card card-hover flex flex-col gap-1 p-4 text-left transition-colors ${
                selected ? 'border-brand bg-brand/10' : ''
              }`}
            >
              <span
                className={`text-xs font-medium uppercase tracking-wide ${
                  selected ? 'text-brandbright' : 'text-faint'
                }`}
              >
                {label}
              </span>
              <span
                className={`text-2xl font-bold tabular-nums ${
                  selected ? 'text-brandbright' : 'text-strong'
                }`}
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
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
          {filtered.map((iv) => {
            const name = interviewDisplayName(iv);
            const closing = closingId === iv.id;
            return (
              <li
                key={iv.id}
                className="card card-hover flex items-center justify-between px-4 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-strong">{name}</span>
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
                    {iv.status === 'scheduled' && iv.scheduled_at
                      ? `Scheduled for ${fmtSchedule(iv.scheduled_at)}`
                      : new Date(iv.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <Link href={`/interviews/${iv.id}`} className="btn-ghost px-3.5 py-1.5 text-sm">
                    Details
                  </Link>
                  {iv.status !== 'ended' && (
                    <Link href={`/room/${iv.room_id}`} className="btn-primary px-3.5 py-1.5 text-sm">
                      Open
                    </Link>
                  )}
                  {iv.status !== 'ended' && (
                    <button
                      type="button"
                      onClick={() => closeInterview(iv.id, name)}
                      disabled={closing}
                      className="rounded-xl border border-line px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-60"
                    >
                      {closing ? 'Closing…' : 'Close'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

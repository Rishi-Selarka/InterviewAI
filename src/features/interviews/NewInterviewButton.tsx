'use client';

// Creates a new interview via the API, then shows the shareable candidate invite
// link and a button to enter the room as the interviewer.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewInterviewButton() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState(''); // datetime-local value
  const [roomId, setRoomId] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState<string | null>(null);
  const [createdScheduled, setCreatedScheduled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink =
    roomId && typeof window !== 'undefined'
      ? `${window.location.origin}/room/${roomId}`
      : '';

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      // datetime-local has no timezone; convert to a real ISO instant.
      const scheduledIso = scheduledAt ? new Date(scheduledAt).toISOString() : undefined;
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, scheduledAt: scheduledIso }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create interview.');
        return;
      }
      setRoomId(data.roomId);
      setCreatedTitle(title.trim() || null);
      setCreatedScheduled(data.status === 'scheduled');
      router.refresh(); // refresh the list behind the panel
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      window.prompt('Copy this invite link:', inviteLink);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => {
    setRoomId(null);
    setCreatedTitle(null);
    setCreatedScheduled(false);
    setTitle('');
    setScheduledAt('');
  };

  const displayName = createdTitle || roomId;

  return (
    <>
      {/* Trigger stays put in the header; the result shows as a centered popup. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="interview-title" className="text-xs text-muted">
            Interview name (optional)
          </label>
          <input
            id="interview-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && create()}
            placeholder="e.g. Software Developer"
            className="input w-56 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="interview-schedule" className="text-xs text-muted">
            Schedule (optional)
          </label>
          <input
            id="interview-schedule"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="input w-56 text-sm [color-scheme:dark]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={create} disabled={busy} className="btn-primary">
            {busy ? 'Creating…' : scheduledAt ? '＋ Schedule' : '＋ New interview'}
          </button>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      </div>

      {/* Centered popup with the invite link + enter-room CTA. */}
      {roomId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={reset}
        >
          <div
            className="card w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold text-strong">
                <span className="text-brandbright">{displayName}</span>{' '}
                {createdScheduled ? 'scheduled' : 'created'}
              </p>
              <button
                onClick={reset}
                aria-label="Close"
                className="btn-ghost rounded-md p-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              {createdScheduled
                ? 'Candidates will see this on their dashboard. Share the link too:'
                : 'Share this link with your candidate:'}
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-xl border border-line bg-ink2 px-3 py-2 font-mono text-xs text-fg"
              />
              <button onClick={copy} className="btn-ghost px-4 py-2">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => router.push(`/room/${roomId}`)}
                className="btn-primary flex-1 px-4 py-2"
              >
                Enter room →
              </button>
              <button onClick={reset} className="btn-ghost px-4 py-2">
                New interview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

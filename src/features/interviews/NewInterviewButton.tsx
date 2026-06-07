'use client';

// Creates a new interview via the API, then shows the shareable candidate invite
// link and a button to enter the room as the interviewer.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewInterviewButton() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState<string | null>(null);
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
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create interview.');
        return;
      }
      setRoomId(data.roomId);
      setCreatedTitle(title.trim() || null);
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
    setTitle('');
  };

  if (roomId) {
    const displayName = createdTitle || roomId;
    return (
      <div className="card w-full border-brand/30 bg-brand/5 p-4 sm:max-w-md">
        <p className="text-sm font-medium text-strong">
          <span className="text-brandbright">{displayName}</span> created. Share this link with
          your candidate:
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
        <div className="mt-3 flex gap-2">
          <button onClick={() => router.push(`/room/${roomId}`)} className="btn-primary px-4 py-2">
            Enter room →
          </button>
          <button onClick={reset} className="btn-ghost px-4 py-2">
            New interview
          </button>
        </div>
      </div>
    );
  }

  return (
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
          placeholder="e.g. Frontend screen — Aman"
          className="input w-64 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <button onClick={create} disabled={busy} className="btn-primary">
          {busy ? 'Creating…' : '+ New interview'}
        </button>
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </div>
  );
}

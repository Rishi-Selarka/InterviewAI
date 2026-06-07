'use client';

// Creates a new interview via the API, then shows the shareable candidate invite
// link and a button to enter the room as the interviewer.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewInterviewButton() {
  const router = useRouter();
  const [roomId, setRoomId] = useState<string | null>(null);
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
      const res = await fetch('/api/interviews', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create interview.');
        return;
      }
      setRoomId(data.roomId);
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

  if (roomId) {
    return (
      <div className="card w-full border-brand/30 bg-brand/5 p-4 sm:max-w-md">
        <p className="text-sm font-medium text-strong">
          Interview <span className="font-mono text-brandbright">{roomId}</span> created. Share
          this link with your candidate:
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
          <button onClick={() => setRoomId(null)} className="btn-ghost px-4 py-2">
            New interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={create} disabled={busy} className="btn-primary">
        {busy ? 'Creating…' : '+ New interview'}
      </button>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  );
}

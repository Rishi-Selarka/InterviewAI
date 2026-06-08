'use client';

// Minimal top bar: brand, live presence, copy-invite, and (interviewer) end.

import { useState } from 'react';
import PresenceList from './PresenceList';
import Logo from '@/src/features/brand/Logo';

interface Props {
  roomId: string;
  /** Interviewer-only: ends the session for both participants. */
  onEndInterview?: () => void;
  // role kept for call-site compatibility; presence already shows the role.
  role?: string;
}

export default function TopBar({ roomId, onEndInterview }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this invite link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // The handler (RoomLayout) owns the confirm + save/transcribe flow.
  const onEnd = () => onEndInterview?.();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink2 px-4 py-2.5">
      <Logo href="/" textClassName="text-base" markClassName="h-7 w-7" />

      <div className="flex items-center gap-3">
        <PresenceList />
        <button
          onClick={handleCopy}
          className="rounded-xl border border-line2 bg-surface px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-surface2"
        >
          {copied ? '✓ Copied' : 'Invite link'}
        </button>
        {onEndInterview && (
          <button
            onClick={onEnd}
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
          >
            End interview
          </button>
        )}
      </div>
    </header>
  );
}

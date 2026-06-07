'use client';

// Top bar: room title/id, a copy-invite-link button, and live presence.

import { useState } from 'react';
import PresenceList from './PresenceList';
import type { Role } from './liveblocks.config';

interface Props {
  roomId: string;
  role: Role;
}

export default function TopBar({ roomId, role }: Props) {
  const [copied, setCopied] = useState(false);

  // The invite link always points at the candidate role, regardless of who copies
  // it — you invite people to be the candidate.
  const handleCopy = async () => {
    const url = `${window.location.origin}/room/${roomId}?role=candidate`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can fail on insecure origins; fall back to a prompt.
      window.prompt('Copy this invite link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          IntelliInterview
        </span>
        <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Room {roomId}
        </span>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
          You: {role === 'interviewer' ? 'Interviewer' : 'Candidate'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <PresenceList />
        <button
          onClick={handleCopy}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {copied ? '✓ Copied' : 'Copy invite link'}
        </button>
      </div>
    </header>
  );
}

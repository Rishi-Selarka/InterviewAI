'use client';

// No-login guest entry to a room. Reads the guest's display name from
// localStorage (set during onboarding on the landing page); if it's missing,
// shows a small "enter your name" gate. Then mounts the live room. No Supabase,
// no auth — this is the demo path.

import { useEffect, useState } from 'react';
import RoomClient from './RoomClient';
import Logo from '@/src/features/brand/Logo';
import type { Role } from './liveblocks.config';

export const GUEST_NAME_KEY = 'intelli_guest_name';

export default function GuestRoom({ roomId, role }: { roomId: string; role: Role }) {
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage is browser-only, so we must read it after mount (not during
    // render / SSR). Syncing this external value into state on mount is the
    // intended use here, hence the rule suppression.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(localStorage.getItem(GUEST_NAME_KEY)?.trim() || null);
    setReady(true);
  }, []);

  // Avoid a flash of the name gate before localStorage is read.
  if (!ready) {
    return (
      <div className="flex h-[100dvh] items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (!name) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const n = draft.trim();
      if (!n) return;
      localStorage.setItem(GUEST_NAME_KEY, n);
      setName(n);
    };
    return (
      <div className="flex h-[100dvh] items-center justify-center px-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <Logo href="/" textClassName="text-xl" markClassName="h-9 w-9" />
          </div>
          <div className="card p-7 shadow-2xl shadow-black/40">
            <h1 className="text-xl font-bold text-white">Join the interview</h1>
            <p className="mb-5 mt-1 text-sm text-muted">
              You&apos;re joining as the{' '}
              <span className="font-medium text-brandbright">{role}</span>. Enter your
              name to continue.
            </p>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Your name"
              className="input"
            />
            <button type="submit" disabled={!draft.trim()} className="btn-primary mt-3 w-full">
              Enter room →
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-faint">Room code: {roomId}</p>
        </form>
      </div>
    );
  }

  return (
    <RoomClient roomId={roomId} role={role} name={name} interviewId={roomId} guest />
  );
}

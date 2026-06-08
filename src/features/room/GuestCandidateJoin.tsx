'use client';

// Candidate entry point — NO sign-in required. The candidate opens the invite
// link, picks a display name so the interviewer knows who's joining, and enters
// the room as a guest. Identity is name-only; nothing candidate-side is persisted
// (the interviewer owns the recording/scoring/report).

import { useState } from 'react';
import RoomClient from './RoomClient';
import Logo from '@/src/features/brand/Logo';

interface Props {
  roomId: string;
  interviewId: string;
  interviewerId: string;
  /** Prefilled if the visitor happens to already be signed in. */
  defaultName?: string;
}

export default function GuestCandidateJoin({
  roomId,
  interviewId,
  interviewerId,
  defaultName = '',
}: Props) {
  const [name, setName] = useState(defaultName);
  const [joined, setJoined] = useState(false);

  if (joined) {
    return (
      <RoomClient
        roomId={roomId}
        role="candidate"
        name={name.trim() || 'Candidate'}
        interviewId={interviewId}
        interviewerId={interviewerId}
        guest
      />
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) setJoined(true);
  };

  return (
    <div
      data-theme="dark"
      className="flex h-[100dvh] flex-col items-center justify-center bg-ink px-6 text-center"
    >
      <div className="mb-8">
        <Logo href={null} textClassName="text-xl" markClassName="h-9 w-9" />
      </div>
      <form
        onSubmit={submit}
        className="card w-full max-w-sm p-7 text-left shadow-2xl shadow-black/40"
      >
        <h1 className="text-xl font-bold text-white">Join the interview</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enter your name so the interviewer knows who&apos;s joining. No account needed.
        </p>

        <label htmlFor="guest-name" className="mt-5 block text-xs font-medium text-muted">
          Your name
        </label>
        <input
          id="guest-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aman Gupta"
          maxLength={60}
          className="input mt-1.5 w-full"
        />

        <button type="submit" disabled={!name.trim()} className="btn-primary mt-5 w-full disabled:opacity-60">
          Join interview →
        </button>

        <p className="mt-3 text-center text-[11px] text-faint">
          You&apos;ll join with camera &amp; mic. Use headphones to avoid echo.
        </p>
      </form>
    </div>
  );
}

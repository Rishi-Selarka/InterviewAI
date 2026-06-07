'use client';

// Shown to both participants once the interviewer ends the session. No database
// needed — a clean wrap-up with a way to start a fresh interview or go home.

import { useRouter } from 'next/navigation';
import Logo from '@/src/features/brand/Logo';
import type { Role } from './liveblocks.config';

export default function SessionEnded({ role }: { role: Role }) {
  const router = useRouter();

  return (
    <div data-theme="dark" className="flex h-[100dvh] flex-col items-center justify-center gap-6 bg-ink px-6 text-center">
      <Logo href="/" textClassName="text-xl" markClassName="h-9 w-9" />
      <div className="card max-w-md p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Interview ended</h1>
        <p className="mt-2 text-sm text-muted">
          {role === 'interviewer'
            ? 'The session is complete. You can start a fresh interview or head home.'
            : 'Thanks for participating — the interviewer has ended the session.'}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {role === 'interviewer' && (
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary"
            >
              Start new interview
            </button>
          )}
          <button onClick={() => router.push('/')} className="btn-ghost">
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

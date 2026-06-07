// Live interview room (authenticated). The user must be logged in; their role is
// derived from the DB, not the URL:
//   - the interview's owner            -> interviewer
//   - anyone else (first to arrive)    -> claims the open candidate seat
//   - if the seat is already taken      -> shown a "room is full" message
// This replaces the old no-login ?role= demo path.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionProfile } from '@/src/features/auth/profile';
import {
  getInterviewByRoomId,
  claimCandidate,
  markActive,
} from '@/src/features/interviews/server/interviews';
import RoomClient from '@/src/features/room/RoomClient';
import Logo from '@/src/features/brand/Logo';
import type { Role } from '@/src/features/room/liveblocks.config';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  // Must be signed in. Send guests to login, then straight back to this room.
  const session = await getSessionProfile();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/room/${roomId}`)}`);
  }

  const interview = await getInterviewByRoomId(roomId);
  if (!interview) {
    return (
      <RoomMessage
        title="Room not found"
        body="This invite link is invalid or the interview was deleted."
      />
    );
  }

  let role: Role;
  if (interview.interviewer_id === session.userId) {
    role = 'interviewer';
    await markActive(interview); // first open => status active + started_at
  } else {
    // Not the owner -> try to take the candidate seat (idempotent for the same user).
    const claimed = await claimCandidate(interview, session.userId);
    if (claimed && claimed.candidate_id === session.userId) {
      role = 'candidate';
    } else {
      return (
        <RoomMessage
          title="This room is full"
          body="This interview already has a candidate. Check with your interviewer for the right link."
        />
      );
    }
  }

  const name =
    session.profile.full_name?.trim() ||
    (role === 'interviewer' ? 'Interviewer' : 'Candidate');

  return (
    <RoomClient roomId={roomId} role={role} name={name} interviewId={interview.id} />
  );
}

function RoomMessage({ title, body }: { title: string; body: string }) {
  return (
    <div data-theme="dark" className="flex h-[100dvh] flex-col items-center justify-center bg-ink px-6 text-center">
      <div className="mb-8">
        <Logo href="/" textClassName="text-xl" markClassName="h-9 w-9" />
      </div>
      <div className="card max-w-sm p-7 shadow-2xl shadow-black/40">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <Link href="/dashboard" className="btn-primary mt-5 inline-block px-4 py-2">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

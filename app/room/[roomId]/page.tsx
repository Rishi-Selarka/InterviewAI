// Live interview room route. Role is derived from the DATABASE (never a URL
// param): the interview owner is the interviewer; the first other authenticated
// visitor claims the candidate seat. Unauthenticated visitors are sent to log in.

import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/src/features/auth/profile';
import {
  getInterviewByRoomId,
  claimCandidate,
  markActive,
} from '@/src/features/interviews/server/interviews';
import RoomClient from '@/src/features/room/RoomClient';
import type { Role } from '@/src/features/room/liveblocks.config';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  // Must be logged in; send them to login and back here afterwards.
  const session = await getSessionProfile();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/room/${roomId}`)}`);
  }

  const interview = await getInterviewByRoomId(roomId);
  if (!interview) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 p-6 text-center text-sm text-zinc-300">
        This interview room doesn&apos;t exist. Ask your interviewer for a valid
        invite link.
      </div>
    );
  }

  const { userId, profile } = session;

  // Derive the role for THIS interview from the DB.
  let role: Role;
  if (interview.interviewer_id === userId) {
    role = 'interviewer';
    await markActive(interview); // first open => active + started_at
  } else if (interview.candidate_id === userId) {
    role = 'candidate';
  } else if (!interview.candidate_id) {
    await claimCandidate(interview, userId); // claim the open candidate seat
    role = 'candidate';
  } else {
    // Someone else already holds both seats.
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 p-6 text-center text-sm text-zinc-300">
        This interview already has an interviewer and a candidate. You&apos;re not
        a participant in this room.
      </div>
    );
  }

  return (
    <RoomClient
      roomId={roomId}
      role={role}
      name={profile.full_name || (role === 'interviewer' ? 'Interviewer' : 'Candidate')}
      interviewId={interview.id}
    />
  );
}

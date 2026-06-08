// Live interview room. Role is derived from the DB, not the URL:
//   - the interview's authenticated owner -> interviewer (full, persisted)
//   - everyone else                        -> guest candidate (name-only, no login)
// The candidate never has to sign in: they pick a display name and join. Only the
// interviewer is authenticated, since they own the recording/scoring/report.

import Link from 'next/link';
import { getSessionProfile } from '@/src/features/auth/profile';
import {
  getInterviewByRoomId,
  markActive,
} from '@/src/features/interviews/server/interviews';
import RoomClient from '@/src/features/room/RoomClient';
import GuestCandidateJoin from '@/src/features/room/GuestCandidateJoin';
import Logo from '@/src/features/brand/Logo';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  const interview = await getInterviewByRoomId(roomId);
  if (!interview) {
    return (
      <RoomMessage
        title="Room not found"
        body="This invite link is invalid or the interview was deleted."
        cta={{ href: '/', label: 'Go to home' }}
      />
    );
  }

  if (interview.status === 'ended') {
    return (
      <RoomMessage
        title="This interview has ended"
        body="The session is over. Ask your interviewer for a new link if you need to reconnect."
        cta={{ href: '/', label: 'Go to home' }}
      />
    );
  }

  const session = await getSessionProfile();

  // Interviewer = the authenticated owner of this interview.
  if (session && interview.interviewer_id === session.userId) {
    await markActive(interview); // first open => status active + started_at
    const name = session.profile.full_name?.trim() || 'Interviewer';
    return (
      <RoomClient
        roomId={roomId}
        role="interviewer"
        name={name}
        interviewId={interview.id}
        interviewerId={interview.interviewer_id}
      />
    );
  }

  // Everyone else joins as a guest candidate — no sign-in. Opening the link means
  // the session is starting, so flip it active now (the interviewer can Close it
  // from the dashboard if it was opened by mistake).
  await markActive(interview);

  return (
    <GuestCandidateJoin
      roomId={roomId}
      interviewId={interview.id}
      interviewerId={interview.interviewer_id}
      defaultName={session?.profile.full_name?.trim() ?? ''}
    />
  );
}

function RoomMessage({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div data-theme="dark" className="flex h-[100dvh] flex-col items-center justify-center bg-ink px-6 text-center">
      <div className="mb-8">
        <Logo href="/" textClassName="text-xl" markClassName="h-9 w-9" />
      </div>
      <div className="card max-w-sm p-7 shadow-2xl shadow-black/40">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <Link href={cta.href} className="btn-primary mt-5 inline-block px-4 py-2">
          {cta.label}
        </Link>
      </div>
    </div>
  );
}

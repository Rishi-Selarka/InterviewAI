'use client';

// Client entry point for a room. Sets up the Liveblocks client + room, seeds the
// shared Storage, then renders the room UI once everything has synced.

import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
} from '@liveblocks/react';
import RoomLayout from './RoomLayout';
import { LIVEBLOCKS_PUBLIC_KEY, type Role } from './liveblocks.config';
import { DEFAULT_PROBLEM_ID } from '@/src/features/problems/problems';

interface Props {
  roomId: string;
  role: Role;
  name: string;
  interviewId: string;
  /** The interview owner's user id — lets the candidate view the interviewer card. */
  interviewerId?: string;
  /** No-login demo mode: skip DB-backed persistence (scoring/recording/proctoring stats). */
  guest?: boolean;
}

function Loading() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-sm text-zinc-400">
      Connecting to the interview room…
    </div>
  );
}

export default function RoomClient({ roomId, role, name, interviewId, interviewerId, guest }: Props) {
  if (!LIVEBLOCKS_PUBLIC_KEY) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 p-6 text-center text-sm text-rose-300">
        Missing NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY. Add it to .env.local and restart
        the dev server.
      </div>
    );
  }

  return (
    <LiveblocksProvider publicApiKey={LIVEBLOCKS_PUBLIC_KEY}>
      <RoomProvider
        id={roomId}
        initialPresence={{ role, name }}
        initialStorage={{
          activeProblemId: DEFAULT_PROBLEM_ID,
          language: 'javascript',
          output: '',
          running: false,
          ended: false,
        }}
      >
        <ClientSideSuspense fallback={<Loading />}>
          <RoomLayout
            roomId={roomId}
            role={role}
            name={name}
            interviewId={interviewId}
            interviewerId={interviewerId}
            guest={guest}
          />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

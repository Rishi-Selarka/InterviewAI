'use client';

// Shows who is connected to the room, their role, and live connection status,
// using Liveblocks presence (self + others) and the room connection status.

import { useSelf, useOthers, useStatus } from '@liveblocks/react';
import type { Role } from './liveblocks.config';

function roleLabel(role: Role) {
  return role === 'interviewer' ? 'Interviewer' : 'Candidate';
}

function Dot({ color }: { color: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export default function PresenceList() {
  const self = useSelf();
  const others = useOthers();
  // Overall connection status of THIS client to the room.
  const status = useStatus();
  const connected = status === 'connected';

  return (
    <div className="flex items-center gap-3">
      {/* Self */}
      {self && (
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800">
          <Dot color={connected ? 'bg-emerald-500' : 'bg-amber-500'} />
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {self.presence.name} (you)
          </span>
          <span className="text-zinc-400">· {roleLabel(self.presence.role)}</span>
        </div>
      )}

      {/* Others */}
      {others.map((o) => (
        <div
          key={o.connectionId}
          className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800"
        >
          <Dot color="bg-emerald-500" />
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {o.presence.name}
          </span>
          <span className="text-zinc-400">· {roleLabel(o.presence.role)}</span>
        </div>
      ))}

      {others.length === 0 && (
        <span className="text-xs text-zinc-400">Waiting for the other participant…</span>
      )}
    </div>
  );
}

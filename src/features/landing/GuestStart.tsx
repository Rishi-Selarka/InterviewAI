'use client';

// Landing onboarding. "Host" sends you to the dashboard (which prompts login if
// needed) where interviewers create interviews and get an invite link. "Join"
// takes a room code or pasted invite link straight to the room, where the
// candidate joins as a guest (name only — no sign-in required).

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Accept either a bare room code or a pasted invite link and pull out the code.
function parseRoomCode(input: string): string {
  const v = input.trim();
  const match = v.match(/\/room\/([^/?#]+)/);
  return (match ? match[1] : v).trim();
}

export default function GuestStart() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const join = () => {
    const room = parseRoomCode(code);
    if (!room) return setError('Enter the room code or invite link to join.');
    router.push(`/room/${room}`);
  };

  return (
    <div className="card p-5">
      <button
        onClick={() => router.push('/dashboard')}
        className="btn-primary w-full"
      >
        Host a live interview →
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" /> or join one <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="Room code or invite link"
          className="input flex-1"
          onKeyDown={(e) => e.key === 'Enter' && join()}
        />
        <button onClick={join} className="btn-ghost shrink-0">
          Join
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      <p className="mt-3 text-center text-[11px] text-faint">
        Hosting needs a quick sign-in. Joining a room needs only the link — no account.
      </p>
    </div>
  );
}

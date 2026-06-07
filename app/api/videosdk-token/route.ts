// app/api/videosdk-token/route.ts
//
// Server-side VideoSDK auth. Returns a short-lived token (signed with the secret)
// plus the stable VideoSDK meeting id for this room. The API key/secret stay
// server-side and are never sent to the browser.
//
// Two modes:
//   • Authenticated interviews — the meeting id is read from / created in the
//     Supabase `interviews` table (so it persists across restarts).
//   • Guest demo — when there's no usable interview row (no Supabase / placeholder
//     creds / unknown room), we create a VideoSDK meeting once per roomId and keep
//     it in an in-memory cache so BOTH participants in the same room join the same
//     meeting. This needs no database, which is what the no-login demo uses.

import { credentialsConfigured, signToken, createVideoSdkMeeting } from '@/src/features/video/server/videosdk';
import { ensureMeetingId } from '@/src/features/interviews/server/interviews';

// jsonwebtoken + fetch to VideoSDK need the Node runtime.
export const runtime = 'nodejs';

// roomId -> a PROMISE of its meetingId, for the guest/no-database path. We cache
// the promise (not the resolved value) so two participants requesting a token for
// the same room at the same time share ONE meeting creation instead of racing and
// each creating their own meeting (which would put them in separate calls).
// In-memory, so it lives as long as the server process (fine for a local demo).
const guestMeetings = new Map<string, Promise<string>>();

// Heuristic: is Supabase actually configured (vs. the placeholder demo values)?
function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return Boolean(url) && Boolean(key) && !url.includes('placeholder') && !key.includes('placeholder');
}

async function resolveMeetingId(roomId: string): Promise<string> {
  // Prefer the database-backed id for real interviews; tolerate any failure and
  // fall through to the guest cache so the demo never breaks on a DB hiccup.
  if (supabaseConfigured()) {
    try {
      const dbId = await ensureMeetingId(roomId);
      if (dbId) return dbId;
    } catch {
      /* fall through to guest cache */
    }
  }
  let pending = guestMeetings.get(roomId);
  if (!pending) {
    pending = createVideoSdkMeeting();
    guestMeetings.set(roomId, pending);
    // If creation fails, drop it so a later request can retry.
    pending.catch(() => guestMeetings.delete(roomId));
  }
  return pending;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return Response.json({ error: 'Missing roomId.' }, { status: 400 });
  }

  if (!credentialsConfigured()) {
    return Response.json(
      {
        error:
          'VideoSDK credentials are not configured. Add VIDEOSDK_API_KEY and ' +
          'VIDEOSDK_SECRET_KEY to .env.local and restart the dev server.',
      },
      { status: 500 },
    );
  }

  try {
    const meetingId = await resolveMeetingId(roomId);
    // Scope the client token to this specific meeting.
    const token = signToken({ roomId: meetingId });
    return Response.json({ token, meetingId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}

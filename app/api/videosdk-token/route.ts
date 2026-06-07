// app/api/videosdk-token/route.ts
//
// Server-side VideoSDK auth. Returns a short-lived token (signed with the secret)
// plus the stable VideoSDK meeting id for this interview room. The meeting id is
// read from (or created in) the interviews table. The API key/secret stay
// server-side and are never sent to the browser.

import { credentialsConfigured, signToken } from '@/src/features/video/server/videosdk';
import { ensureMeetingId } from '@/src/features/interviews/server/interviews';

// jsonwebtoken + fetch to VideoSDK need the Node runtime.
export const runtime = 'nodejs';

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
    const meetingId = await ensureMeetingId(roomId);
    if (!meetingId) {
      return Response.json({ error: 'Unknown interview room.' }, { status: 404 });
    }
    // Scope the client token to this specific meeting.
    const token = signToken({ roomId: meetingId });
    return Response.json({ token, meetingId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}

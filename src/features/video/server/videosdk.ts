import 'server-only';

// Server-side VideoSDK.live helpers. The API key + secret NEVER leave the server.
//
//   1. signToken()         — mint a short-lived HS256 auth token.
//   2. createVideoSdkMeeting() — create a new VideoSDK meeting, return its id.
//
// The roomId -> meeting id MAPPING now lives in the interviews table in Supabase
// (see src/features/interviews/server/interviews.ts) instead of a local cache.

import jwt from 'jsonwebtoken';

const API_KEY = process.env.VIDEOSDK_API_KEY ?? '';
const SECRET = process.env.VIDEOSDK_SECRET_KEY ?? '';

const VIDEOSDK_API = 'https://api.videosdk.live/v2';

export function credentialsConfigured(): boolean {
  return Boolean(API_KEY && SECRET);
}

/**
 * Sign a VideoSDK auth token. Scope it to a specific meeting (`roomId`) when
 * known, so the token can only be used for that meeting.
 */
export function signToken(opts?: { roomId?: string; participantId?: string }): string {
  const payload: Record<string, unknown> = {
    apikey: API_KEY,
    // allow_join: join meetings; allow_mod: toggle mic/cam (incl. our own).
    permissions: ['allow_join', 'allow_mod'],
    version: 2,
  };
  if (opts?.roomId) payload.roomId = opts.roomId;
  if (opts?.participantId) payload.participantId = opts.participantId;

  return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '120m' });
}

/** Create a brand-new VideoSDK meeting and return its id. */
export async function createVideoSdkMeeting(): Promise<string> {
  const token = signToken();
  const res = await fetch(`${VIDEOSDK_API}/rooms`, {
    method: 'POST',
    headers: { authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error(`VideoSDK create-room failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { roomId?: string };
  if (!data.roomId) throw new Error('VideoSDK create-room returned no roomId.');
  return data.roomId;
}

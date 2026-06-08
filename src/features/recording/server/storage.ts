import 'server-only';

// Server-only helpers for the private "recordings" Storage bucket. All access
// uses the service-role admin client (bypasses RLS); never import this client
// in browser code. Playback uses short-lived SIGNED urls.

import { createAdminClient } from '@/src/features/auth/supabase/admin';

export const RECORDINGS_BUCKET = 'recordings';

type Role = 'interviewer' | 'candidate';

function extFor(contentType: string): string {
  if (contentType.includes('mp4')) return 'mp4';
  if (contentType.includes('ogg')) return 'ogg';
  return 'webm';
}

/** Create the private recordings bucket if it doesn't already exist. */
export async function ensureRecordingsBucket(): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(RECORDINGS_BUCKET);
  if (data) return;
  await admin.storage.createBucket(RECORDINGS_BUCKET, { public: false });
}

/** Upload one role's audio. Returns the stored object path. */
export async function uploadRecording(
  interviewId: string,
  role: Role,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  await ensureRecordingsBucket();
  const admin = createAdminClient();
  const path = `${interviewId}/${role}.${extFor(contentType)}`;
  const { error } = await admin.storage
    .from(RECORDINGS_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`upload ${role}: ${error.message}`);
  return path;
}

/** Download a stored recording's raw bytes (for server-side transcription). */
export async function downloadRecording(
  path: string | null,
): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(RECORDINGS_BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: await data.arrayBuffer(), mime: data.type || 'audio/webm' };
}

/** Create a short-lived signed URL for a stored recording path. */
export async function signRecording(
  path: string | null,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

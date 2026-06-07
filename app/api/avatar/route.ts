// Upload a profile avatar image to the public "avatars" Storage bucket and set it
// on the user's profile. Replaces pasting a raw image URL.

import { getSessionProfile } from '@/src/features/auth/profile';
import { createAdminClient } from '@/src/features/auth/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

const BUCKET = 'avatars';
const MAX_BYTES = 5 * 1024 * 1024;

function extFor(type: string): string {
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  return 'jpg';
}

export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: 'No image uploaded.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return Response.json({ error: 'Please upload an image file.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'Image is too large (max 5 MB).' }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const { data: bucket } = await admin.storage.getBucket(BUCKET);
    if (!bucket) await admin.storage.createBucket(BUCKET, { public: true });

    const path = `${session.userId}/avatar.${extFor(file.type)}`;
    const buf = await file.arrayBuffer();
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (upErr) return Response.json({ error: upErr.message }, { status: 502 });

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    // Cache-bust so the new image shows immediately after re-upload.
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    await admin.from('profiles').update({ avatar_url: url }).eq('id', session.userId);
    return Response.json({ url });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

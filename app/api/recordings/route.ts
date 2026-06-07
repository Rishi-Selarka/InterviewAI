// Upload the two interview audio recordings to the PRIVATE "recordings" bucket
// using the service role (server-only), and store their paths on the interview.
// Only the owning interviewer may upload.

import { getSessionProfile } from '@/src/features/auth/profile';
import { getInterviewById, setAudioPaths } from '@/src/features/interviews/server/interviews';
import { uploadRecording } from '@/src/features/recording/server/storage';

export const runtime = 'nodejs';
// Audio blobs can be a few MB; allow a larger body.
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: 'Expected multipart form data.' }, { status: 400 });

  const interviewId = form.get('interviewId');
  if (typeof interviewId !== 'string') {
    return Response.json({ error: 'Missing interviewId.' }, { status: 400 });
  }

  const interview = await getInterviewById(interviewId);
  if (!interview) return Response.json({ error: 'Interview not found.' }, { status: 404 });
  if (interview.interviewer_id !== session.userId) {
    return Response.json({ error: 'Only the interviewer can upload recordings.' }, { status: 403 });
  }

  const paths: { interviewer_audio_path?: string; candidate_audio_path?: string } = {};
  try {
    for (const role of ['interviewer', 'candidate'] as const) {
      const file = form.get(role);
      if (file && file instanceof Blob && file.size > 0) {
        const buf = await file.arrayBuffer();
        const contentType = file.type || 'audio/webm';
        const path = await uploadRecording(interviewId, role, buf, contentType);
        if (role === 'interviewer') paths.interviewer_audio_path = path;
        else paths.candidate_audio_path = path;
      }
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  if (Object.keys(paths).length > 0) await setAudioPaths(interviewId, paths);
  return Response.json({ ok: true, ...paths });
}

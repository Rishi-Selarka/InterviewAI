import 'server-only';

// Server-side interview data access. Reads/writes the interviews table and owns
// the roomId -> VideoSDK meeting id mapping (now persisted in the DB).
//
// We use the privileged admin client for the candidate-claim and meeting-id
// creation paths, because a not-yet-claimed candidate cannot SELECT/UPDATE the
// interview under RLS. All admin use is server-only and narrowly scoped.

import { createAdminClient } from '@/src/features/auth/supabase/admin';
import {
  createVideoSdkMeeting,
  credentialsConfigured,
} from '@/src/features/video/server/videosdk';

export interface Interview {
  id: string;
  room_id: string;
  interviewer_id: string;
  candidate_id: string | null;
  videosdk_meeting_id: string | null;
  active_problem_id: string | null;
  status: 'created' | 'active' | 'ended';
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  interviewer_audio_path: string | null;
  candidate_audio_path: string | null;
}

function shortRoomId(): string {
  return globalThis.crypto.randomUUID().split('-')[0];
}

/** Create an interview owned by `interviewerId`, minting a room id + meeting id. */
export async function createInterview(interviewerId: string): Promise<Interview> {
  const admin = createAdminClient();

  const meetingId = credentialsConfigured() ? await createVideoSdkMeeting() : null;

  // Retry once on the (extremely unlikely) room_id collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const room_id = shortRoomId();
    const { data, error } = await admin
      .from('interviews')
      .insert({
        room_id,
        interviewer_id: interviewerId,
        videosdk_meeting_id: meetingId,
        status: 'created',
      })
      .select('*')
      .single();

    if (!error && data) return data as Interview;
    if (error && error.code !== '23505') throw new Error(error.message); // not a unique violation
  }
  throw new Error('Could not allocate a unique room id.');
}

/** Fetch an interview by our room id (admin read, bypassing RLS). */
export async function getInterviewByRoomId(roomId: string): Promise<Interview | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('interviews')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();
  return (data as Interview) ?? null;
}

/** Fetch an interview by its id (admin read, bypassing RLS). */
export async function getInterviewById(id: string): Promise<Interview | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('interviews').select('*').eq('id', id).maybeSingle();
  return (data as Interview) ?? null;
}

/** Store the uploaded audio object paths on the interview. */
export async function setAudioPaths(
  id: string,
  paths: { interviewer_audio_path?: string; candidate_audio_path?: string },
): Promise<void> {
  const admin = createAdminClient();
  await admin.from('interviews').update(paths).eq('id', id);
}

/** List interviews owned by an interviewer, newest first. */
export async function listInterviewsForInterviewer(interviewerId: string): Promise<Interview[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('interviews')
    .select('*')
    .eq('interviewer_id', interviewerId)
    .order('created_at', { ascending: false });
  return (data as Interview[]) ?? [];
}

/**
 * Claim a candidate seat if it's still open. Idempotent for the same user.
 * Returns the CURRENT interview state (never stale): if this user won the seat
 * the row has `candidate_id === userId`; if another user won the race it has
 * their id; `null` only if the interview no longer exists. The caller must check
 * `result.candidate_id === userId` before treating this user as the candidate.
 */
export async function claimCandidate(
  interview: Interview,
  userId: string,
): Promise<Interview | null> {
  if (interview.candidate_id) return interview;
  const admin = createAdminClient();
  const { data } = await admin
    .from('interviews')
    .update({ candidate_id: userId })
    .eq('id', interview.id)
    .is('candidate_id', null) // guard against a race: only claim if still open
    .select('*')
    .maybeSingle();
  if (data) return data as Interview; // we won the seat
  // We lost the race (or it was already claimed) — return the authoritative
  // current state so the caller can see who actually holds the seat.
  return getInterviewById(interview.id);
}

/** Mark an interview active + stamp started_at the first time. */
export async function markActive(interview: Interview): Promise<void> {
  if (interview.status === 'ended') return;
  const admin = createAdminClient();
  await admin
    .from('interviews')
    .update({
      status: 'active',
      started_at: interview.started_at ?? new Date().toISOString(),
    })
    .eq('id', interview.id);
}

/**
 * Ensure the interview has a VideoSDK meeting id, creating one if missing.
 * Returns the meeting id. Used by the token route.
 */
export async function ensureMeetingId(roomId: string): Promise<string | null> {
  const interview = await getInterviewByRoomId(roomId);
  if (!interview) return null;
  if (interview.videosdk_meeting_id) return interview.videosdk_meeting_id;
  if (!credentialsConfigured()) return null;

  const meetingId = await createVideoSdkMeeting();
  const admin = createAdminClient();
  await admin
    .from('interviews')
    .update({ videosdk_meeting_id: meetingId })
    .eq('id', interview.id);
  return meetingId;
}

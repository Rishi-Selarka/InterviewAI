'use client';

// Interviewer-side reader: pulls the candidate's broadcast proctoring state out of
// Liveblocks presence. In this 1:1 interview there is a single candidate, so we
// just find the other participant whose role is 'candidate'.

import { useOthers, shallow } from '@liveblocks/react';
import { DEFAULT_PROCTORING, type ProctoringState } from '@/src/features/room/liveblocks.config';

export function useCandidateProctoring(): ProctoringState {
  // `shallow` keeps this from re-rendering every time the selector builds a new
  // object with unchanged contents.
  return useOthers((others) => {
    const candidate = others.find((o) => o.presence.role === 'candidate');
    return candidate?.presence.proctoring ?? DEFAULT_PROCTORING;
  }, shallow);
}

/**
 * Fuller candidate status for the interviewer: whether a candidate is currently
 * connected, their name, and their proctoring signals. `connected` lets the UI
 * distinguish "candidate present & focused" from "candidate not in the room" —
 * otherwise an absent candidate misleadingly reads as "Focused".
 */
export interface CandidateStatus {
  connected: boolean;
  name: string | null;
  proctoring: ProctoringState;
}

export function useCandidateStatus(): CandidateStatus {
  return useOthers((others) => {
    const candidate = others.find((o) => o.presence.role === 'candidate');
    return {
      connected: !!candidate,
      name: candidate?.presence.name ?? null,
      proctoring: candidate?.presence.proctoring ?? DEFAULT_PROCTORING,
    };
  }, shallow);
}

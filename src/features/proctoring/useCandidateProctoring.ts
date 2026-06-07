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

// Liveblocks configuration for IntelliInterview.
//
// We authenticate from the browser with the PUBLIC key (NEXT_PUBLIC_*). That is
// sufficient for this pass: presence carries each participant's role + name, and
// the shared editor/problem/output state lives in Liveblocks Storage + Yjs.
//
// LATER (see src/features/auth): swap the public key for a server-side auth route
// that mints tokens from LIVEBLOCKS_SECRET_KEY once we have real accounts/roles.

export type Role = 'interviewer' | 'candidate';

// These ids double as Monaco language ids (javascript/python/java/c/cpp are all
// valid Monaco languages), so no mapping is needed for the editor.
export type SupportedLanguage = 'javascript' | 'python' | 'java' | 'c' | 'cpp';

// The browser-usable public key. Throwing early gives a clear error instead of a
// confusing "missing room" failure deep inside Liveblocks.
export const LIVEBLOCKS_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY ?? '';

// Augment Liveblocks' global types so every hook (useStorage, useMyPresence, …)
// is fully typed across the app. This is the v3 recommended typing approach.
/**
 * Assistive proctoring signal the candidate broadcasts about itself. It is
 * NON-PUNITIVE: it only informs the interviewer and never blocks the candidate.
 */
export type ProctoringState = {
  /** True while the candidate currently appears to be looking away. */
  lookingAway: boolean;
  /** How many distinct look-away events have occurred this session. */
  lookAwayCount: number;
  /** Candidate's interview tab/window is currently hidden or unfocused. */
  tabHidden: boolean;
  /** How many times the candidate switched away from the interview tab/window. */
  tabSwitchCount: number;
  /** More than one face is currently visible in the candidate's camera. */
  multipleFaces: boolean;
  /** No face is currently visible (camera off / left frame). */
  noFace: boolean;
};

/** Default proctoring state — every field defined so readers never hit undefined. */
export const DEFAULT_PROCTORING: ProctoringState = {
  lookingAway: false,
  lookAwayCount: 0,
  tabHidden: false,
  tabSwitchCount: 0,
  multipleFaces: false,
  noFace: false,
};

declare global {
  interface Liveblocks {
    // Per-connection state, broadcast to everyone in the room.
    Presence: {
      role: Role;
      name: string;
      // Only the candidate sets this (assistive proctoring). Optional so the
      // interviewer and the initial presence don't need to provide it.
      proctoring?: ProctoringState;
    };

    // Shared, persistent room document (the editor text itself is a Yjs doc,
    // not stored here — see src/features/editor/CollaborativeEditor.tsx).
    Storage: {
      activeProblemId: string;
      // The candidate only sees the problem once the interviewer has selected/
      // published one — until then the interviewer's browsing stays private.
      problemPublished: boolean;
      language: SupportedLanguage;
      // Latest run output, synced so both participants see the same result.
      output: string;
      // True while a run is in flight (so the other side sees "Running…").
      running: boolean;
      // True once the interviewer ends the session — both sides show the end screen.
      ended: boolean;
    };
  }
}

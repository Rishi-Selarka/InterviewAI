# proctoring

Assistive, **non-punitive** "looked away" camera signal via **MediaPipe Tasks
Vision FaceLandmarker** (`@mediapipe/tasks-vision`, browser/client-side).

Implemented (Milestone 4):
- `CandidateProctor.tsx` — runs ONLY for the candidate. Reads frames from the
  EXISTING local camera track (via `useParticipant` — no second `getUserMedia`),
  runs FaceLandmarker ~5 fps, debounces a "looking away" signal, and broadcasts
  `{ lookingAway, lookAwayCount }` through Liveblocks **presence**.
- `headPose.ts` — pure math: yaw/pitch from the facial transformation matrix, and
  the per-frame away decision (also treats "no face" as away).
- `config.ts` — tunable constants (debounce, detect interval, yaw/pitch
  thresholds, wasm/model URLs).
- `useCandidateProctoring.ts` — interviewer-side reader of the candidate's
  presence signal.

Display: the interviewer's candidate tile gets a calm amber border while
`lookingAway` is true plus a neutral "Looked away: N times" indicator
(`ParticipantTile`). The candidate is NEVER blocked or warned — their own tile
only shows a subtle "Attention check active" hint.

It NEVER warns, blocks, or interrupts the candidate; the look-away frequency is
just context for the interviewer to weigh at scoring time.

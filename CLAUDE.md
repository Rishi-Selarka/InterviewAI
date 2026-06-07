@AGENTS.md
# IntelliInterview — Project Context for Claude Code

## What we're building
An Intervue-style live technical interview platform. Core experience: a live
room where an interviewer and candidate are on video together, share one
live-syncing code editor that runs real code, the session is recorded and
transcribed, and a structured scored report is produced afterward.

## Differentiators (our unique value)
1. AI interviewer mode: an AI can conduct the live interview and ask adaptive
   follow-up questions about the candidate's reasoning, bugs, and efficiency.
2. AI as an unbiased second judge: after the interview, an AI reads the
   transcript and produces its own fair score; HR compares it to the
   interviewer's score to catch large gaps or bias.
3. Smart questions: focus on debugging, optimizing, and securing code, not
   plain coding.
4. Assistive proctoring: a non-punitive "looked away" camera signal that
   informs the interviewer; never blocks the candidate.

## Tech stack
- Framework: Next.js (App Router, TypeScript, Tailwind)
- Live code sync: Liveblocks + Yjs + Monaco
- Video/audio: VideoSDK.live (@videosdk.live/react-sdk; token signed server-side)
- Code execution: Judge0 (via a server API route; key stays server-side)
- Database / Auth / File storage: Supabase
- AI (interviewer, transcript judge, reports): Anthropic Claude API (server-side)
- Transcription: post-interview (Whisper or Deepgram) — added later
- Camera attention: MediaPipe Face Landmarker (browser, client-side)

## Conventions
- Keep features modular: one folder per feature under src/.
- All secret keys live in .env.local, used ONLY in server-side API routes.
- Editor/room components are client components ('use client').
- Prefer clear, readable code over clever code.

## Build roadmap (build and test ONE milestone at a time)
1. Coding workspace (solo): /interview — Monaco + language dropdown + Run,
   wired to real Judge0 execution for multiple languages.
2. Live room: two users join by link and see each other's code update live;
   add a problem-statement panel.
3. Video/audio in the room (VideoSDK.live).
4. Accounts + roles + sessions (Supabase auth): interviewer vs candidate;
   create interview; generate join link; store sessions.
5. Recording + transcript pipeline: record audio, store it, transcribe later.
6. Scoring + report: interviewer fills a 5-point rubric; generate a report.
7. AI layer: AI report+score from transcript; HR comparison view; camera
   look-away signal; soft AI-content flag on transcript.
8. AI interviewer mode: AI conducts the interview with adaptive follow-ups.

## Current status

### Built & working (verified)
- **Milestone 1 — solo coding pad** (`/interview`): Monaco editor, JS/Python
  dropdown, Run wired to local execution.
- **Code execution API** (`app/api/run/route.ts`): runs JS via `node` and Python
  via `python`, 5s timeout, temp-file cleanup, friendly "not installed" message.
  ⚠️ Unsandboxed, local-dev only.
- **Landing page** (`/`): routes to signup/login or the dashboard.
- **Milestone 2 — live interview room** (`/room/[roomId]`):
  - Shared Monaco editor syncing live via **Liveblocks + Yjs + y-monaco**
    (current official integration), with remote cursors.
  - Synced (via Liveblocks Storage): active problem, language, and run output.
  - Problem panel with 4 built-in "smart" problems (debug / optimize / secure);
    interviewer can switch the active problem and load its starter code.
  - Top bar with room id, copy-invite-link, and live presence (role + status).
  - Interviewer-only 5-point scoring rubric + notes + on-screen summary
    (candidate never sees it).
- **Milestone 3 — live video & audio** (`src/features/video`, VideoSDK.live):
  - `app/api/videosdk-token` signs a short-lived HS256 token server-side and maps
    each interview roomId to a stable VideoSDK meeting id (create-once + cache);
    API key/secret never reach the browser.
  - Custom video panel embedded in the room's right column (not a prebuilt UI):
    participant tiles built from raw `webcamStream`/`micStream` tracks, mic/camera
    toggles, leave + rejoin, and connecting/waiting states. Auto-joins on entry.
  - React Strict Mode is disabled (`next.config.ts`) because the VideoSDK join
    double-fires under Strict Mode's double effect invocation.
- **Milestone 4 — assistive proctoring** (`src/features/proctoring`, MediaPipe
  Tasks Vision FaceLandmarker), NON-PUNITIVE:
  - Runs ONLY for the candidate; reads frames from the EXISTING local camera track
    (via `useParticipant` — no second getUserMedia), ~5 fps.
  - "Looking away" = no face detected OR head yaw/pitch beyond tunable thresholds
    (`config.ts`), debounced ~1.5s so brief glances don't count.
  - Candidate broadcasts `{ lookingAway, lookAwayCount }` via Liveblocks
    **presence**; interviewer reads it and shows a calm amber border + neutral
    "Looked away: N times" on the candidate tile. The candidate is never blocked
    or warned — only a subtle "Attention check active" hint.
- **Milestone 5 — accounts, roles & persistence** (Supabase + `@supabase/ssr`):
  - Email/password `/signup` (full name + interviewer/candidate role) and `/login`;
    session refreshed via `middleware.ts`. A DB trigger creates the profile row.
  - Schema in `supabase/schema.sql` (apply with `node scripts/apply-schema.mjs`,
    needs `SUPABASE_DB_URL`): `profiles`, `interviews`, `evaluations`,
    `proctoring_stats`, **RLS on every table** (interviewer owns their interviews;
    candidate reads their own; `hr` role reads all — for the future HR view).
  - Interviewer `/dashboard` lists + creates interviews (mints room_id + VideoSDK
    meeting id, stored in the DB). The `?role=` URL param is GONE — role is
    derived from the DB per interview; an unclaimed interview claims the first
    other authenticated visitor as the candidate.
  - The VideoSDK meeting id now lives in `interviews.videosdk_meeting_id` (no more
    JSON cache). "Submit Evaluation" inserts into `evaluations`; look-away count is
    upserted to `proctoring_stats` (periodically + on end); interview status moves
    created → active (started_at) → ended (ended_at).
  - `SUPABASE_SERVICE_ROLE_KEY` is used ONLY in server-only modules
    (`src/features/auth/supabase/admin.ts`, guarded by `server-only`).
- Feature modules live under `src/features/*`; routes stay in root `app/`
  (this project uses `app/`, not `src/app/`).

Tested end-to-end with two real browser clients (`scripts/live-*.mjs`, Playwright,
now creating + logging in real interviewer/candidate users via `scripts/lib/setup.mjs`):
editor sync, presence, run output, problem/language sync, load-starter,
interviewer-only scoring, two-way video, proctoring, PLUS persistence (evaluation
row, proctoring_stats row, interview ended with timestamps all verified in the DB).
`npm run build` and `npm run lint` are clean.

### Stubbed (folders + README only, NOT implemented)
- `src/features/transcription` — recording + Whisper/Deepgram.
- `src/features/ai` — AI interviewer, AI transcript judge + HR comparison
  (the `hr` role + its read RLS exist; the comparison UI does not).
- Secure server-side execution engine (Judge0) to replace the local runner.
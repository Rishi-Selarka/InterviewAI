# auth (STUB)

Accounts, roles, and session persistence via **Supabase** (Auth + Postgres).

Will add real interviewer/candidate accounts (today the role is just a URL query
param), interview creation, durable join links, and persistence of sessions,
evaluations, transcripts, and reports. A later pass also moves code execution to a
secure server-side engine (self-hosted **Judge0**) instead of the current
unsandboxed local runner.

TODO: replace the `?role=` query param with authenticated roles; persist scoring
submissions (currently shown on-screen only) and rooms.

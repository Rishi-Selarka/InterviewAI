-- ============================================================================
-- IntelliInterview — DEMO SEED DATA  (supabase/seed-demo.sql)
-- ============================================================================
--
-- WHAT THIS DOES
--   Populates the database with realistic, presentation-ready demo data:
--     * 2 demo auth users you can actually log in with (interviewer + candidate)
--     * Their profiles (names, headlines, bios, social links)
--     * 6 interviews owned by the demo interviewer:
--         - 3 COMPLETED (ended)  -> each with a full transcript + scored
--           evaluation + proctoring stats
--         - 2 SCHEDULED (future) -> awaiting a candidate
--         - 1 ACTIVE   (live now)
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL Editor and run it.
--   (It touches auth.* and uses pgcrypto's crypt()/gen_salt(), both of which
--    are available in the SQL Editor.)
--
-- DEMO LOGINS  (both passwords are the same)
--   Interviewer : interviewer@ivue.demo   /   Demo1234!     (Priya Sharma)
--   Candidate   : candidate@ivue.demo     /   Demo1234!     (Arjun Mehta)
--
-- IDEMPOTENT / SAFE TO RE-RUN
--   Every insert uses fixed UUIDs + ON CONFLICT guards, so re-running this file
--   will NOT create duplicates and will NOT error. Re-running simply refreshes
--   the demo rows to their canonical values.
-- ============================================================================

-- pgcrypto gives us crypt() + gen_salt() for the password hash and gen_random_uuid().
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 0) Schema safety net
--    The base schema.sql ships an interviews.status check of
--    ('created','active','ended') with no scheduled_at column. This demo needs
--    a 'scheduled' status + scheduled_at. Add them idempotently so this file
--    works whether or not schema.sql has been updated yet.
-- ----------------------------------------------------------------------------
alter table public.interviews
  add column if not exists scheduled_at timestamptz;

do $$
begin
  -- Drop the old status check (whatever it's named) and recreate it to include
  -- 'scheduled'. We look it up by the column it references to stay robust.
  if exists (
    select 1
    from information_schema.constraint_column_usage ccu
    join information_schema.table_constraints tc
      on tc.constraint_name = ccu.constraint_name
     and tc.constraint_schema = ccu.constraint_schema
    where ccu.table_schema = 'public'
      and ccu.table_name = 'interviews'
      and ccu.column_name = 'status'
      and tc.constraint_type = 'CHECK'
  ) then
    execute (
      select 'alter table public.interviews drop constraint ' || quote_ident(tc.constraint_name)
      from information_schema.constraint_column_usage ccu
      join information_schema.table_constraints tc
        on tc.constraint_name = ccu.constraint_name
       and tc.constraint_schema = ccu.constraint_schema
      where ccu.table_schema = 'public'
        and ccu.table_name = 'interviews'
        and ccu.column_name = 'status'
        and tc.constraint_type = 'CHECK'
      limit 1
    );
  end if;

  alter table public.interviews
    add constraint interviews_status_check
    check (status in ('created', 'active', 'ended', 'scheduled'));
exception
  when duplicate_object then null;  -- constraint already exists with that name
end $$;

-- ============================================================================
-- 1) DEMO AUTH USERS
--    Fixed UUIDs so everything downstream is stable + idempotent.
--      Interviewer (Priya Sharma) : 11111111-1111-1111-1111-111111111111
--      Candidate   (Arjun Mehta)  : 22222222-2222-2222-2222-222222222222
-- ============================================================================

-- 1a) auth.users
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'interviewer@ivue.demo',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Priya Sharma', 'role', 'interviewer'),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'candidate@ivue.demo',
    crypt('Demo1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Arjun Mehta', 'role', 'candidate'),
    now(),
    now()
  )
on conflict (id) do nothing;

-- 1b) auth.identities
--     Required for email/password login on current Supabase. provider_id must
--     be set (it equals the user id as text for the 'email' provider) and there
--     is a unique index on (provider, provider_id), so we guard on that.
insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  created_at,
  updated_at,
  last_sign_in_at
)
values
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'email',
    jsonb_build_object(
      'sub', '11111111-1111-1111-1111-111111111111',
      'email', 'interviewer@ivue.demo'
    ),
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'email',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222222',
      'email', 'candidate@ivue.demo'
    ),
    now(),
    now(),
    now()
  )
on conflict (provider, provider_id) do nothing;

-- ============================================================================
-- 2) PROFILES
--    The handle_new_user() trigger may already have created a bare profile row
--    when the users above were inserted. Upsert to fill in the rich demo fields.
-- ============================================================================
insert into public.profiles (
  id, full_name, role, username, headline, bio, work_experience,
  linkedin_url, github_url, website_url, avatar_url
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Priya Sharma',
    'interviewer',
    'priyasharma',
    'Staff Software Engineer & Technical Interviewer',
    'Staff engineer focused on web platform and developer tooling. I run technical interviews centered on debugging, optimization, and secure coding rather than rote algorithm puzzles.',
    'Staff Software Engineer @ Acme (2021–present) · Senior SWE @ FlowPay (2017–2021) · SWE @ Nimbus (2014–2017)',
    'https://www.linkedin.com/in/priyasharma',
    'https://github.com/priyasharma',
    'https://priyasharma.dev',
    ''
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Arjun Mehta',
    'candidate',
    'arjunmehta',
    'Full-Stack Engineer — React, Node, TypeScript',
    'Product-minded full-stack engineer who enjoys untangling tricky bugs and tightening up performance. Comfortable across the stack from React UIs to SQL-backed APIs.',
    'Software Engineer @ BrightCart (2020–present) · Junior Developer @ CodeForge (2018–2020)',
    'https://www.linkedin.com/in/arjunmehta',
    'https://github.com/arjunmehta',
    'https://arjunmehta.io',
    ''
  )
on conflict (id) do update set
  full_name       = excluded.full_name,
  role            = excluded.role,
  username        = excluded.username,
  headline        = excluded.headline,
  bio             = excluded.bio,
  work_experience = excluded.work_experience,
  linkedin_url    = excluded.linkedin_url,
  github_url      = excluded.github_url,
  website_url     = excluded.website_url,
  avatar_url      = excluded.avatar_url;

-- ============================================================================
-- 3) INTERVIEWS
--    Fixed UUIDs; all owned by the demo interviewer (Priya).
--      Completed : aaaaaaa1.. / aaaaaaa2.. / aaaaaaa3..
--      Scheduled : bbbbbbb1.. / bbbbbbb2..
--      Active    : ccccccc1..
-- ============================================================================
insert into public.interviews (
  id, room_id, interviewer_id, candidate_id, videosdk_meeting_id,
  active_problem_id, title, status, scheduled_at,
  created_at, started_at, ended_at
)
values
  -- ---- 3 COMPLETED (ended) ------------------------------------------------
  (
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'demo-fe01',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'ivue-demo-meeting-fe01',
    'debug-react-list',
    'Senior Frontend Engineer — React',
    'ended',
    null,
    now() - interval '7 days',
    now() - interval '7 days' + interval '5 minutes',
    now() - interval '7 days' + interval '52 minutes'
  ),
  (
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'demo-be02',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'ivue-demo-meeting-be02',
    'optimize-query',
    'Backend Engineer — Node/SQL',
    'ended',
    null,
    now() - interval '4 days',
    now() - interval '4 days' + interval '3 minutes',
    now() - interval '4 days' + interval '48 minutes'
  ),
  (
    'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    'demo-fs03',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'ivue-demo-meeting-fs03',
    'secure-login',
    'Full-Stack Screen — Debugging',
    'ended',
    null,
    now() - interval '2 days',
    now() - interval '2 days' + interval '6 minutes',
    now() - interval '2 days' + interval '50 minutes'
  ),

  -- ---- 2 SCHEDULED (future, no candidate yet) -----------------------------
  (
    'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'demo-pe04',
    '11111111-1111-1111-1111-111111111111',
    null,
    'ivue-demo-meeting-pe04',
    null,
    'Platform Engineer — System Design',
    'scheduled',
    now() + interval '2 days',
    now() - interval '1 day',
    null,
    null
  ),
  (
    'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'demo-de05',
    '11111111-1111-1111-1111-111111111111',
    null,
    'ivue-demo-meeting-de05',
    null,
    'Data Engineer — SQL & Pipelines',
    'scheduled',
    now() + interval '5 days',
    now() - interval '1 day',
    null,
    null
  ),

  -- ---- 1 ACTIVE (live now) ------------------------------------------------
  (
    'ccccccc1-cccc-cccc-cccc-ccccccccccc1',
    'demo-me06',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'ivue-demo-meeting-me06',
    'debug-react-list',
    'Mobile Engineer — Live Coding',
    'active',
    null,
    now() - interval '20 minutes',
    now() - interval '18 minutes',
    null
  )
on conflict (id) do nothing;

-- ============================================================================
-- 4) TRANSCRIPTS  (one per completed interview)
--    content = ordered [{role,text,start,end}] segments (seconds).
--    full_text = flattened "role: text" lines.
-- ============================================================================

-- 4a) Frontend / React — debugging an off-by-one in a paginated list ----------
insert into public.transcripts (interview_id, content, full_text)
values (
  'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  $json$[
    {"role":"interviewer","text":"Hi Arjun, thanks for joining. I'm Priya, I work on the web platform team. How are you doing today?","start":0,"end":7},
    {"role":"candidate","text":"Doing well, thanks Priya. A little caffeinated but ready to go.","start":7,"end":12},
    {"role":"interviewer","text":"Perfect. So today is debugging-focused. I've dropped a small React component into the editor that renders a paginated list. Users are reporting the last item on each page goes missing. Take a look and talk me through what you see.","start":12,"end":27},
    {"role":"candidate","text":"Sure. Okay, so it slices the array with items.slice(page * pageSize, page * pageSize + pageSize - 1). That minus one looks suspicious — slice's end index is already exclusive, so subtracting one drops the last element of every page.","start":27,"end":48},
    {"role":"interviewer","text":"Nice, you spotted it quickly. So what's the fix?","start":48,"end":52},
    {"role":"candidate","text":"Just remove the minus one: slice(page * pageSize, page * pageSize + pageSize). The end bound is exclusive so that gives you exactly pageSize items.","start":52,"end":63},
    {"role":"interviewer","text":"Good. Now, on the very last page you might have fewer items than pageSize. Does your fix still hold?","start":63,"end":71},
    {"role":"candidate","text":"It does — slice clamps to the array length, so if there are only three items left it returns three without throwing. No extra bounds check needed.","start":71,"end":83},
    {"role":"interviewer","text":"Right. I also see the list uses the array index as the React key. Any concern there?","start":83,"end":90},
    {"role":"candidate","text":"Yeah, index-as-key is risky when the list reorders or filters — React can reuse the wrong DOM node and you get stale or flickering rows. I'd key on a stable item.id instead.","start":90,"end":104},
    {"role":"interviewer","text":"Great. Let's say the list grows to fifty thousand rows. What would you reach for?","start":104,"end":111},
    {"role":"candidate","text":"I'd virtualize it — only render the rows in the viewport, with something like react-window. That keeps the DOM node count flat regardless of dataset size.","start":111,"end":124},
    {"role":"interviewer","text":"Exactly the direction I was hoping for. Let's run the fixed version against the tests.","start":124,"end":131},
    {"role":"candidate","text":"Running it now... all the pagination tests pass, and the last-item case is green. The off-by-one was the whole bug.","start":131,"end":142},
    {"role":"interviewer","text":"Clean work. That's a wrap on this one — appreciate the clear narration as you went.","start":142,"end":150},
    {"role":"candidate","text":"Thanks Priya, this was a fun one to debug.","start":150,"end":155}
  ]$json$::jsonb,
  $txt$interviewer: Hi Arjun, thanks for joining. I'm Priya, I work on the web platform team. How are you doing today?
candidate: Doing well, thanks Priya. A little caffeinated but ready to go.
interviewer: Perfect. So today is debugging-focused. I've dropped a small React component into the editor that renders a paginated list. Users are reporting the last item on each page goes missing. Take a look and talk me through what you see.
candidate: Sure. Okay, so it slices the array with items.slice(page * pageSize, page * pageSize + pageSize - 1). That minus one looks suspicious — slice's end index is already exclusive, so subtracting one drops the last element of every page.
interviewer: Nice, you spotted it quickly. So what's the fix?
candidate: Just remove the minus one: slice(page * pageSize, page * pageSize + pageSize). The end bound is exclusive so that gives you exactly pageSize items.
interviewer: Good. Now, on the very last page you might have fewer items than pageSize. Does your fix still hold?
candidate: It does — slice clamps to the array length, so if there are only three items left it returns three without throwing. No extra bounds check needed.
interviewer: Right. I also see the list uses the array index as the React key. Any concern there?
candidate: Yeah, index-as-key is risky when the list reorders or filters — React can reuse the wrong DOM node and you get stale or flickering rows. I'd key on a stable item.id instead.
interviewer: Great. Let's say the list grows to fifty thousand rows. What would you reach for?
candidate: I'd virtualize it — only render the rows in the viewport, with something like react-window. That keeps the DOM node count flat regardless of dataset size.
interviewer: Exactly the direction I was hoping for. Let's run the fixed version against the tests.
candidate: Running it now... all the pagination tests pass, and the last-item case is green. The off-by-one was the whole bug.
interviewer: Clean work. That's a wrap on this one — appreciate the clear narration as you went.
candidate: Thanks Priya, this was a fun one to debug.$txt$
)
on conflict (interview_id) do update set
  content   = excluded.content,
  full_text = excluded.full_text;

-- 4b) Backend / SQL — optimizing an O(n^2) lookup to O(n) ---------------------
insert into public.transcripts (interview_id, content, full_text)
values (
  'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  $json$[
    {"role":"interviewer","text":"Hey Arjun, good to see you again. Today's about performance. There's a Node endpoint in the editor that joins orders to users in application code and it's timing out on production-sized data. Walk me through it.","start":0,"end":15},
    {"role":"candidate","text":"Let me read it. So for each order it loops over the full users array to find the matching user — that's a nested loop, O(n times m). With large tables that blows up fast.","start":15,"end":30},
    {"role":"interviewer","text":"Right. How would you bring that down?","start":30,"end":34},
    {"role":"candidate","text":"Build a Map from userId to user in one pass, then look each order's user up by key. That turns the inner scan into O(1), so the whole thing is O(n plus m) — effectively linear.","start":34,"end":49},
    {"role":"interviewer","text":"Good. Let me push back though — should this join even be happening in Node?","start":49,"end":56},
    {"role":"candidate","text":"Honestly no. If both tables live in the same database I'd do a single SQL JOIN and let the query planner use the index on users.id. That avoids pulling every user row over the wire just to match them in memory.","start":56,"end":72},
    {"role":"interviewer","text":"Exactly. Suppose we go the SQL route — what would you check to make sure it's actually fast?","start":72,"end":80},
    {"role":"candidate","text":"I'd run EXPLAIN ANALYZE and confirm it's using an index scan on the join key, not a sequential scan. And I'd make sure there's an index on orders.user_id, since that's the foreign key we're joining on.","start":80,"end":96},
    {"role":"interviewer","text":"Nice. What if we still need it in Node for some reason — any memory concern with the Map approach?","start":96,"end":104},
    {"role":"candidate","text":"The Map holds all users in memory, so for truly huge tables I'd paginate or stream rather than loading everything. But for the dataset described, the Map is the right trade-off.","start":104,"end":119},
    {"role":"interviewer","text":"Let's apply the Map version and time it against the slow one.","start":119,"end":125},
    {"role":"candidate","text":"Done. The original took about 4.2 seconds on the test set, the Map version is around 40 milliseconds. Two orders of magnitude.","start":125,"end":138},
    {"role":"interviewer","text":"Great result. You reasoned about both the in-app fix and the better architectural one, which is what I wanted to see.","start":138,"end":148},
    {"role":"candidate","text":"Thanks — the SQL JOIN is what I'd actually ship, but it was good to show the Map fallback too.","start":148,"end":156}
  ]$json$::jsonb,
  $txt$interviewer: Hey Arjun, good to see you again. Today's about performance. There's a Node endpoint in the editor that joins orders to users in application code and it's timing out on production-sized data. Walk me through it.
candidate: Let me read it. So for each order it loops over the full users array to find the matching user — that's a nested loop, O(n times m). With large tables that blows up fast.
interviewer: Right. How would you bring that down?
candidate: Build a Map from userId to user in one pass, then look each order's user up by key. That turns the inner scan into O(1), so the whole thing is O(n plus m) — effectively linear.
interviewer: Good. Let me push back though — should this join even be happening in Node?
candidate: Honestly no. If both tables live in the same database I'd do a single SQL JOIN and let the query planner use the index on users.id. That avoids pulling every user row over the wire just to match them in memory.
interviewer: Exactly. Suppose we go the SQL route — what would you check to make sure it's actually fast?
candidate: I'd run EXPLAIN ANALYZE and confirm it's using an index scan on the join key, not a sequential scan. And I'd make sure there's an index on orders.user_id, since that's the foreign key we're joining on.
interviewer: Nice. What if we still need it in Node for some reason — any memory concern with the Map approach?
candidate: The Map holds all users in memory, so for truly huge tables I'd paginate or stream rather than loading everything. But for the dataset described, the Map is the right trade-off.
interviewer: Let's apply the Map version and time it against the slow one.
candidate: Done. The original took about 4.2 seconds on the test set, the Map version is around 40 milliseconds. Two orders of magnitude.
interviewer: Great result. You reasoned about both the in-app fix and the better architectural one, which is what I wanted to see.
candidate: Thanks — the SQL JOIN is what I'd actually ship, but it was good to show the Map fallback too.$txt$
)
on conflict (interview_id) do update set
  content   = excluded.content,
  full_text = excluded.full_text;

-- 4c) Full-stack / security — fixing a SQL-injection-prone login -------------
insert into public.transcripts (interview_id, content, full_text)
values (
  'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  $json$[
    {"role":"interviewer","text":"Hi Arjun. This round is about secure coding. There's a login handler in the editor. Have a read and tell me what jumps out.","start":0,"end":10},
    {"role":"candidate","text":"Okay... right away, the SQL query is built with string concatenation — it drops the email and password straight into the query text. That's a classic SQL injection hole.","start":10,"end":24},
    {"role":"interviewer","text":"Can you show me an input that exploits it?","start":24,"end":28},
    {"role":"candidate","text":"Sure. If I pass an email like ' OR '1'='1' --, the WHERE clause always evaluates true and the rest is commented out, so it returns the first user and logs me in without a valid password.","start":28,"end":45},
    {"role":"interviewer","text":"Yep. How do you fix it properly?","start":45,"end":49},
    {"role":"candidate","text":"Parameterized queries — pass the values as bound parameters with placeholders instead of concatenating. The driver sends them separately from the SQL, so input can never change the query structure.","start":49,"end":64},
    {"role":"interviewer","text":"Good. I also notice the password is compared directly. What's wrong there?","start":64,"end":71},
    {"role":"candidate","text":"It's comparing plaintext against a stored plaintext password — so passwords aren't hashed at all. They should be hashed with bcrypt or argon2, with a per-user salt, and verified with the library's compare function, not a plain equality check.","start":71,"end":88},
    {"role":"interviewer","text":"And why does the compare function matter beyond just hashing?","start":88,"end":94},
    {"role":"candidate","text":"Because a naive equality on the hash can leak timing information. bcrypt.compare does a constant-time comparison, which closes that timing side channel.","start":94,"end":107},
    {"role":"interviewer","text":"Strong answer. One more — the handler returns 'user not found' vs 'wrong password' separately. Concern?","start":107,"end":116},
    {"role":"candidate","text":"Yes, that's user enumeration — an attacker learns which emails are registered. I'd return a single generic 'invalid credentials' message for both cases.","start":116,"end":129},
    {"role":"interviewer","text":"Let's apply the parameterized query and the hash check and re-run the security tests.","start":129,"end":137},
    {"role":"candidate","text":"Applied. The injection test now fails to log in, and the hashed-password path passes. The enumeration one I noted but didn't get to fully refactor.","start":137,"end":150},
    {"role":"interviewer","text":"That's fine — you identified it clearly, which counts. Good session, thanks Arjun.","start":150,"end":158},
    {"role":"candidate","text":"Thanks Priya, appreciate the follow-ups.","start":158,"end":162}
  ]$json$::jsonb,
  $txt$interviewer: Hi Arjun. This round is about secure coding. There's a login handler in the editor. Have a read and tell me what jumps out.
candidate: Okay... right away, the SQL query is built with string concatenation — it drops the email and password straight into the query text. That's a classic SQL injection hole.
interviewer: Can you show me an input that exploits it?
candidate: Sure. If I pass an email like ' OR '1'='1' --, the WHERE clause always evaluates true and the rest is commented out, so it returns the first user and logs me in without a valid password.
interviewer: Yep. How do you fix it properly?
candidate: Parameterized queries — pass the values as bound parameters with placeholders instead of concatenating. The driver sends them separately from the SQL, so input can never change the query structure.
interviewer: Good. I also notice the password is compared directly. What's wrong there?
candidate: It's comparing plaintext against a stored plaintext password — so passwords aren't hashed at all. They should be hashed with bcrypt or argon2, with a per-user salt, and verified with the library's compare function, not a plain equality check.
interviewer: And why does the compare function matter beyond just hashing?
candidate: Because a naive equality on the hash can leak timing information. bcrypt.compare does a constant-time comparison, which closes that timing side channel.
interviewer: Strong answer. One more — the handler returns 'user not found' vs 'wrong password' separately. Concern?
candidate: Yes, that's user enumeration — an attacker learns which emails are registered. I'd return a single generic 'invalid credentials' message for both cases.
interviewer: Let's apply the parameterized query and the hash check and re-run the security tests.
candidate: Applied. The injection test now fails to log in, and the hashed-password path passes. The enumeration one I noted but didn't get to fully refactor.
interviewer: That's fine — you identified it clearly, which counts. Good session, thanks Arjun.
candidate: Thanks Priya, appreciate the follow-ups.$txt$
)
on conflict (interview_id) do update set
  content   = excluded.content,
  full_text = excluded.full_text;

-- ============================================================================
-- 5) EVALUATIONS  (one per completed interview; submitted by the interviewer)
--    Guarded against duplicates with WHERE NOT EXISTS so re-running is safe.
--    Varied profiles: strong (~4.4), mixed (~3.4), weaker (~2.6).
-- ============================================================================

-- 5a) Frontend — STRONG (avg 4.40)
insert into public.evaluations (
  interview_id, problem_solving, code_quality, debugging, efficiency,
  communication, average, notes, submitted_by
)
select
  'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  5, 4, 5, 4, 4, 4.40,
  'Spotted the off-by-one almost immediately and reasoned cleanly about keys and virtualization. Strong debugging instincts and clear narration throughout.',
  '11111111-1111-1111-1111-111111111111'
where not exists (
  select 1 from public.evaluations
  where interview_id = 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
);

-- 5b) Backend — MIXED (avg 3.40)
insert into public.evaluations (
  interview_id, problem_solving, code_quality, debugging, efficiency,
  communication, average, notes, submitted_by
)
select
  'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  3, 3, 3, 4, 4, 3.40,
  'Got to the linear-time fix and the SQL JOIN with a nudge. Solid on efficiency and communication; code organization and edge-case handling were a bit rough.',
  '11111111-1111-1111-1111-111111111111'
where not exists (
  select 1 from public.evaluations
  where interview_id = 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
);

-- 5c) Full-stack security — WEAKER (avg 2.60)
insert into public.evaluations (
  interview_id, problem_solving, code_quality, debugging, efficiency,
  communication, average, notes, submitted_by
)
select
  'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  3, 2, 3, 2, 3, 2.60,
  'Identified the injection and hashing issues but needed prompting and did not finish the refactor. Awareness is there; depth and follow-through need work.',
  '11111111-1111-1111-1111-111111111111'
where not exists (
  select 1 from public.evaluations
  where interview_id = 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
);

-- ============================================================================
-- 6) PROCTORING STATS  (one per completed interview; unique per interview_id)
-- ============================================================================
insert into public.proctoring_stats (interview_id, look_away_count, updated_at)
values
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 1, now() - interval '7 days' + interval '52 minutes'),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 4, now() - interval '4 days' + interval '48 minutes'),
  ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0, now() - interval '2 days' + interval '50 minutes')
on conflict (interview_id) do update set
  look_away_count = excluded.look_away_count,
  updated_at      = excluded.updated_at;

-- ============================================================================
-- Done. Re-running this whole file is safe and non-destructive.
-- Log in at the app with:
--   interviewer@ivue.demo / Demo1234!   (Priya Sharma, interviewer)
--   candidate@ivue.demo   / Demo1234!   (Arjun Mehta, candidate)
-- ============================================================================

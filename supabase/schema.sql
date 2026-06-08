-- IntelliInterview — Supabase schema (Milestone 5)
--
-- Run this in the Supabase SQL Editor. It is idempotent: safe to re-run.
--
-- Row Level Security is enabled on EVERY table. Access summary:
--   profiles          : a user reads/updates only their own row.
--   interviews        : interviewer (owner) read/write; candidate reads their own;
--                       hr reads all.
--   evaluations       : interviewer (owner) read/write; hr reads all.
--   proctoring_stats  : interviewer (owner) read/write; candidate reads their own;
--                       hr reads all.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'candidate'
    check (role in ('interviewer', 'candidate', 'hr')),
  created_at timestamptz not null default now()
);

-- Editable profile fields (everything a user can change in profile settings).
-- ADDITIVE + idempotent so re-running the file is safe on an existing DB.
alter table public.profiles
  add column if not exists username text not null default '',
  add column if not exists headline text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists work_experience text not null default '',
  add column if not exists linkedin_url text not null default '',
  add column if not exists github_url text not null default '',
  add column if not exists website_url text not null default '',
  add column if not exists avatar_url text not null default '';

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Allow a user to insert their own profile row (the trigger below normally does
-- this, but this keeps client-side creation possible too). The role is pinned to
-- the two non-privileged roles: a client can never self-insert `hr` (which would
-- grant all-interviews read access). hr is granted only via the service role.
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('interviewer', 'candidate'));

-- Helper: is the current user an HR user? SECURITY DEFINER avoids RLS recursion
-- when policies on other tables need to check the caller's role.
create or replace function public.is_hr()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'hr'
  );
$$;

-- Create a profile automatically when a new auth user signs up, pulling the
-- chosen full_name + role from the signup metadata.
--
-- SECURITY: signup metadata is fully client-controlled (the browser calls
-- auth.signUp({ data: { role } }) directly), so we must NOT trust it for the
-- privileged `hr` role. `hr` grants read access to EVERY interview/evaluation/
-- transcript via is_hr(), so it can only be granted manually (service role / SQL
-- editor). Self-signup may pick `interviewer` (only ever sees its own interviews)
-- or, for anything else, defaults to `candidate`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  derived_name text;
begin
  -- Name from Google (full_name/name), else the local part of the email.
  derived_name := coalesce(
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );

  insert into public.profiles (id, full_name, username, avatar_url, role)
  values (
    new.id,
    derived_name,
    -- A simple default handle from the email local part (user can change it).
    coalesce(lower(nullif(split_part(coalesce(new.email, ''), '@', 1), '')), ''),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture', ''),
    case
      when meta ->> 'role' = 'interviewer' then 'interviewer'
      else 'candidate' -- 'hr'/anything else => candidate; hr is granted manually
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SECURITY: the "profiles: update own" policy below lets a user update their own
-- row (so they can edit their full_name). Without a guard that same policy would
-- also let them run `update profiles set role = 'hr'` and self-promote to the
-- all-reading hr role. This BEFORE UPDATE trigger blocks any self-service change
-- that INVOLVES `hr` (the only cross-tenant role) unless it comes from a trusted
-- context: the service_role key (server admin client) or a direct DB connection
-- (SQL editor / migrations, which have no PostgREST JWT claims).
--
-- candidate <-> interviewer IS allowed for logged-in users: neither can read
-- another user's data, and OAuth (Google) sign-ups are created as 'candidate' but
-- may legitimately need to become an interviewer.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims text := current_setting('request.jwt.claims', true);
  jwt_role text := nullif(claims, '')::jsonb ->> 'role';
begin
  if (new.role = 'hr' or old.role = 'hr')
     and new.role is distinct from old.role
     and jwt_role is not null
     and jwt_role <> 'service_role'
  then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------------------------
-- interviews
-- ---------------------------------------------------------------------------
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  room_id text unique not null,
  interviewer_id uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid references public.profiles (id) on delete set null,
  videosdk_meeting_id text,
  active_problem_id text,
  status text not null default 'created'
    check (status in ('created', 'active', 'ended', 'scheduled')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- Human-friendly interview name (e.g. "Frontend screen — Aman"). Additive.
alter table public.interviews
  add column if not exists title text not null default '';

-- Scheduling: optional future start time + a 'scheduled' status. Additive +
-- idempotent: re-point the status CHECK on existing databases to allow 'scheduled'.
alter table public.interviews
  add column if not exists scheduled_at timestamptz;
alter table public.interviews drop constraint if exists interviews_status_check;
alter table public.interviews
  add constraint interviews_status_check
  check (status in ('created', 'active', 'ended', 'scheduled'));

alter table public.interviews enable row level security;

drop policy if exists "interviews: interviewer manages own" on public.interviews;
create policy "interviews: interviewer manages own"
  on public.interviews for all
  using (auth.uid() = interviewer_id)
  with check (auth.uid() = interviewer_id);

drop policy if exists "interviews: candidate reads own" on public.interviews;
create policy "interviews: candidate reads own"
  on public.interviews for select
  using (auth.uid() = candidate_id);

drop policy if exists "interviews: hr reads all" on public.interviews;
create policy "interviews: hr reads all"
  on public.interviews for select
  using (public.is_hr());

-- ---------------------------------------------------------------------------
-- evaluations
-- ---------------------------------------------------------------------------
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  problem_solving int not null check (problem_solving between 1 and 5),
  code_quality int not null check (code_quality between 1 and 5),
  debugging int not null check (debugging between 1 and 5),
  efficiency int not null check (efficiency between 1 and 5),
  communication int not null check (communication between 1 and 5),
  average numeric(3, 2) not null,
  notes text not null default '',
  submitted_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.evaluations enable row level security;

-- Interviewer who owns the interview can read/write its evaluations.
drop policy if exists "evaluations: interviewer of interview" on public.evaluations;
create policy "evaluations: interviewer of interview"
  on public.evaluations for all
  using (
    exists (
      select 1 from public.interviews i
      where i.id = evaluations.interview_id and i.interviewer_id = auth.uid()
    )
  )
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.interviews i
      where i.id = evaluations.interview_id and i.interviewer_id = auth.uid()
    )
  );

drop policy if exists "evaluations: hr reads all" on public.evaluations;
create policy "evaluations: hr reads all"
  on public.evaluations for select
  using (public.is_hr());

-- ---------------------------------------------------------------------------
-- proctoring_stats
-- ---------------------------------------------------------------------------
create table if not exists public.proctoring_stats (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews (id) on delete cascade,
  look_away_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.proctoring_stats enable row level security;

drop policy if exists "proctoring: interviewer of interview" on public.proctoring_stats;
create policy "proctoring: interviewer of interview"
  on public.proctoring_stats for all
  using (
    exists (
      select 1 from public.interviews i
      where i.id = proctoring_stats.interview_id and i.interviewer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.interviews i
      where i.id = proctoring_stats.interview_id and i.interviewer_id = auth.uid()
    )
  );

drop policy if exists "proctoring: candidate reads own" on public.proctoring_stats;
create policy "proctoring: candidate reads own"
  on public.proctoring_stats for select
  using (
    exists (
      select 1 from public.interviews i
      where i.id = proctoring_stats.interview_id and i.candidate_id = auth.uid()
    )
  );

drop policy if exists "proctoring: hr reads all" on public.proctoring_stats;
create policy "proctoring: hr reads all"
  on public.proctoring_stats for select
  using (public.is_hr());

-- ---------------------------------------------------------------------------
-- Milestone 6 — recordings + transcripts (ADDITIVE; safe to re-run)
-- ---------------------------------------------------------------------------

-- Audio recording object paths (in the private "recordings" Storage bucket).
alter table public.interviews
  add column if not exists interviewer_audio_path text,
  add column if not exists candidate_audio_path text;

-- One post-hoc transcript per interview. `content` is an ordered array of
-- { role, text, start, end } segments; `full_text` is the flattened text.
create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews (id) on delete cascade,
  content jsonb not null default '[]'::jsonb,
  full_text text not null default '',
  created_at timestamptz not null default now()
);

alter table public.transcripts enable row level security;

drop policy if exists "transcripts: interviewer of interview" on public.transcripts;
create policy "transcripts: interviewer of interview"
  on public.transcripts for all
  using (
    exists (
      select 1 from public.interviews i
      where i.id = transcripts.interview_id and i.interviewer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.interviews i
      where i.id = transcripts.interview_id and i.interviewer_id = auth.uid()
    )
  );

drop policy if exists "transcripts: candidate reads own" on public.transcripts;
create policy "transcripts: candidate reads own"
  on public.transcripts for select
  using (
    exists (
      select 1 from public.interviews i
      where i.id = transcripts.interview_id and i.candidate_id = auth.uid()
    )
  );

drop policy if exists "transcripts: hr reads all" on public.transcripts;
create policy "transcripts: hr reads all"
  on public.transcripts for select
  using (public.is_hr());

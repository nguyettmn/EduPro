-- EduPro backend — migration 0001: schema + row-level security + seed.
--
-- HOW TO APPLY (run once, in the Supabase dashboard SQL editor):
--   1. Create a free project at https://supabase.com/dashboard (any region).
--   2. Open SQL Editor -> New query, paste this whole file, Run.
--   3. The script is re-runnable: re-running it keeps data and refreshes
--      policies/functions. Seed rows use ON CONFLICT DO NOTHING.
--
-- WHAT LIVES HERE vs WHAT STAYS IN THE APP CODE:
--   In Postgres (mutable, per-user data): profiles, classes, memberships,
--   lessons (teacher copies + AI lessons), assignments, submissions,
--   proposals, repo items, exercise sets, HTML games, game results,
--   tutor data, space names.
--   Still static in the app code (read-only reference content): the
--   sample Pack (Toán 5 – Phân số), its 5 lessons and 59 questions, and
--   the 4 seed marketplace listings. They become DB rows only if/when
--   the standard-content library (Kho bài chuẩn / BGD branch) is built
--   out beyond the single sample Pack.
--
-- AUTH MODEL (see also 0002_registration_approval.sql, which supersedes
-- the signup part of this paragraph):
--   Supabase Auth (email + password) is the identity. Every auth user
--   gets exactly one `profiles` row (id = auth.users id), created by the
--   `handle_new_user` trigger from the signup/invite metadata. Open
--   registration is ON ("Allow new users" stays enabled): signup offers
--   Principal / Teacher / Student; a registering principal names a new
--   school and is active immediately, while a teacher/student who picks
--   an existing school starts 'pending' until approved/placed (see
--   0002). Teachers and students may also register with no school
--   (independent teachers / learners, active immediately). The
--   email-invite flow runs alongside: accounts created by managers
--   through the app's invite function (a Vercel server function using
--   the service-role key) skip approval, matching the product rule that
--   teachers add students by email and principals manage teacher
--   accounts. Students get a tutor_data row from the same trigger.
--
-- PERMISSION MODEL (mirrors src/permissions.ts):
--   Principal > Team Lead > Teacher > Student. There is NO Admin role
--   (user decision 2026-11-16): the "admin" is the person who edits the
--   source code. Principals self-register and create their own school
--   (see 0002); other system-wide fixes are done directly in the
--   database with the service role, never through the app. A manager sees everything of
--   the accounts they manage EXCEPT a student's Tutor Space contents (tutor_data + standalone games): for those, managers
--   only get the summary via the `get_tutor_summary` RPC. Nobody edits
--   or deletes someone else's original: UPDATE/DELETE on lessons,
--   games and exercise sets is owner-only. RLS enforces the coarse
--   scope; the app still enforces the fine rules (e.g. exactly who may
--   decide a proposal at its current stage).
--
-- The Gemini function (api/ai-soan-bai.ts) verifies the caller's JWT
-- against Supabase Auth (GET {SUPABASE_URL}/auth/v1/user with the
-- anon key + Bearer token) — no database access from that function.

-- ============ Tables ============

create table if not exists public.schools (
  id text primary key,
  name text not null
);

create table if not exists public.teams (
  id text primary key,
  school_id text not null references public.schools (id),
  name text not null
);

-- One row per auth user. Role/school/team assignment changes are
-- guarded by the protect_profile_assignment trigger (a principal may
-- reassign accounts within their own school only; creating principals
-- and cross-school moves are done with the service role).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('principal', 'lead', 'teacher', 'student')),
  school_id text references public.schools (id),
  team_id text references public.teams (id),
  teaching_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id text primary key,
  school_id text not null references public.schools (id),
  team_id text not null references public.teams (id),
  name text not null,
  grade integer not null,
  -- Nullable: seed classes exist before teacher accounts do.
  teacher_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Who belongs to a class: teachers (classes they teach) and students
-- (their own class). Replaces Account.classIds.
create table if not exists public.class_memberships (
  class_id text not null references public.classes (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('teacher', 'student')),
  primary key (class_id, profile_id)
);

-- Teacher copies + AI-composed lessons. Pack originals stay static in
-- the app code, so every row here has an owner.
create table if not exists public.lessons (
  id text primary key,
  title text not null,
  topic_ids text[] not null default '{}',
  color text not null default '#2563eb',
  sections jsonb not null default '[]'::jsonb,
  question_ids text[] not null default '{}',
  owner_id uuid not null references public.profiles (id),
  source_id text,
  html text,
  grade integer,
  subject text,
  topic text,
  outline text,
  role_sentence text,
  extra_requests text,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id text primary key,
  lesson_id text not null references public.lessons (id),
  title text not null,
  class_id text not null references public.classes (id),
  -- Empty array = whole class; otherwise only these students.
  student_ids uuid[] not null default '{}',
  created_by uuid not null references public.profiles (id),
  due_date date not null,
  attempts_allowed integer not null default 1,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id text primary key,
  assignment_id text not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id),
  answers jsonb not null default '{}'::jsonb,
  score integer not null,
  total integer not null,
  submitted_at timestamptz not null default now(),
  comment text,
  reviewed boolean not null default false,
  -- A resubmission replaces the previous one (matches the app reducer).
  unique (assignment_id, student_id)
);

create table if not exists public.proposals (
  id text primary key,
  kind text not null check (kind in ('lesson', 'game', 'questions')),
  title text not null,
  topic_id text not null,
  created_by uuid not null references public.profiles (id),
  created_by_name text not null,
  anonymous boolean not null default false,
  target_repo text not null check (target_repo in ('team', 'school')),
  school_id text not null references public.schools (id),
  team_id text references public.teams (id),
  stage text not null default 'teacher'
    check (stage in ('teacher', 'team', 'school', 'done')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reason text,
  lesson_copy_id text references public.lessons (id),
  game jsonb,
  question_ids text[],
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id)
);

create table if not exists public.repo_items (
  id text primary key,
  repo text not null check (repo in ('team', 'school')),
  kind text not null check (kind in ('lesson', 'game', 'questions')),
  title text not null,
  topic_id text not null,
  owner_name text not null,
  anonymous boolean not null default false,
  school_id text not null references public.schools (id),
  team_id text references public.teams (id),
  lesson_copy_id text references public.lessons (id),
  game jsonb,
  question_ids text[],
  approved_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_sets (
  id text primary key,
  lesson_id text not null references public.lessons (id) on delete cascade,
  title text not null,
  created_by uuid not null references public.profiles (id),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Single-file HTML games. lesson_id set = attached to a lesson (one
-- lesson can have many games); null = standalone in a Tutor Space.
create table if not exists public.html_games (
  id text primary key,
  title text not null,
  mechanic text not null,
  theme text not null,
  html_code text not null,
  owner_id uuid not null references public.profiles (id),
  lesson_id text references public.lessons (id) on delete cascade,
  seed text,
  grade integer,
  subject text,
  topic text,
  needs_internet boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.game_results (
  id text primary key,
  game_id text not null references public.html_games (id) on delete cascade,
  student_id uuid not null references public.profiles (id),
  won boolean not null default false,
  score integer not null default 0,
  stars integer not null default 0,
  duration_sec integer not null default 0,
  correct integer not null default 0,
  wrong integer not null default 0,
  skills jsonb not null default '[]'::jsonb,
  missed_skills text[] not null default '{}',
  played_at timestamptz not null default now()
);

-- Tutor Space contents: OWNER-ONLY. Managers never read this table;
-- they call get_tutor_summary() instead.
create table if not exists public.tutor_data (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  sessions integer not null default 0,
  weak_topics text[] not null default '{}',
  chat jsonb not null default '[]'::jsonb,
  self_games jsonb not null default '[]'::jsonb,
  review_question_ids text[] not null default '{}',
  mastered_ids text[] not null default '{}',
  best_scores jsonb not null default '{}'::jsonb
);

create table if not exists public.space_names (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  name text not null
);

-- ============ Indexes ============

create index if not exists idx_profiles_school on public.profiles (school_id);
create index if not exists idx_profiles_team on public.profiles (team_id);
create index if not exists idx_classes_school on public.classes (school_id);
create index if not exists idx_classes_team on public.classes (team_id);
create index if not exists idx_memberships_profile on public.class_memberships (profile_id);
create index if not exists idx_lessons_owner on public.lessons (owner_id);
create index if not exists idx_assignments_class on public.assignments (class_id);
create index if not exists idx_assignments_creator on public.assignments (created_by);
create index if not exists idx_submissions_assignment on public.submissions (assignment_id);
create index if not exists idx_submissions_student on public.submissions (student_id);
create index if not exists idx_proposals_school on public.proposals (school_id, stage, status);
create index if not exists idx_repo_items_scope on public.repo_items (school_id, team_id, repo);
create index if not exists idx_exercise_sets_lesson on public.exercise_sets (lesson_id);
create index if not exists idx_html_games_owner on public.html_games (owner_id);
create index if not exists idx_html_games_lesson on public.html_games (lesson_id);
create index if not exists idx_game_results_student on public.game_results (student_id);
create index if not exists idx_game_results_game on public.game_results (game_id);

-- ============ Scope helpers (SECURITY DEFINER: they read past RLS ============ 
-- so policies never recurse into themselves) ============

create or replace function public.my_role()
returns text
language sql security definer stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- managedAccounts() from src/permissions.ts, in SQL. Excludes self.
create or replace function public.manages(viewer uuid, target uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select case
    when viewer is null or target is null or viewer = target then false
    when (select role from public.profiles where id = viewer) = 'principal' then
      (select school_id from public.profiles where id = viewer) is not null
      and (select school_id from public.profiles where id = target)
        = (select school_id from public.profiles where id = viewer)
    when (select role from public.profiles where id = viewer) = 'lead' then
      exists (
        select 1 from public.profiles v, public.profiles t
        where v.id = viewer and t.id = target
          and t.school_id = v.school_id
          and (
            (t.role in ('teacher', 'lead') and t.team_id = v.team_id)
            or (
              t.role = 'student'
              and exists (
                select 1
                from public.profiles tch
                join public.class_memberships m1
                  on m1.profile_id = tch.id and m1.kind = 'teacher'
                join public.class_memberships m2
                  on m2.class_id = m1.class_id and m2.kind = 'student'
                where tch.role = 'teacher'
                  and tch.team_id = v.team_id
                  and m2.profile_id = target
              )
            )
          )
      )
    when (select role from public.profiles where id = viewer) = 'teacher' then
      (select role from public.profiles where id = target) = 'student'
      and exists (
        select 1
        from public.class_memberships m1
        join public.class_memberships m2 on m2.class_id = m1.class_id
        where m1.profile_id = viewer and m1.kind = 'teacher'
          and m2.profile_id = target and m2.kind = 'student'
      )
    else false
  end;
$$;

-- visibleClasses() from src/permissions.ts, in SQL.
create or replace function public.can_see_class(cid text, viewer uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select case
    when viewer is null then false
    when (select role from public.profiles where id = viewer) = 'principal' then
      (select school_id from public.classes where id = cid)
        = (select school_id from public.profiles where id = viewer)
    when (select role from public.profiles where id = viewer) = 'lead' then
      (select team_id from public.classes where id = cid)
        = (select team_id from public.profiles where id = viewer)
    else exists (
      select 1 from public.class_memberships
      where class_id = cid and profile_id = viewer
    )
  end;
$$;

-- Whether `viewer` may see assignment `aid`: its creator, a manager of
-- the creator, a teacher of the class, or a student it was assigned to
-- (whole class, or listed in student_ids).
create or replace function public.assignment_visible_to(aid text, viewer uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = aid
      and (
        a.created_by = viewer
        or public.manages(viewer, a.created_by)
        or exists (
          select 1 from public.class_memberships m
          where m.class_id = a.class_id and m.profile_id = viewer
            and (
              m.kind = 'teacher'
              or (
                m.kind = 'student'
                and (cardinality(a.student_ids) = 0 or viewer = any (a.student_ids))
              )
            )
        )
      )
  );
$$;

-- Whether `viewer` (staff only; students have no repo view) may browse
-- repo item `rid`: school repo = same school, team repo = same team.
create or replace function public.repo_visible_to(rid text, viewer uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from public.repo_items r, public.profiles v
    where r.id = rid and v.id = viewer
      and v.role <> 'student'
      and (
        (r.repo = 'school' and r.school_id = v.school_id)
        or (r.repo = 'team' and r.team_id = v.team_id)
      )
  );
$$;

-- Tutor Space SUMMARY for managers (sessions + weak topics + the count
-- of standalone games). Returns zero rows when the caller may not see
-- this student. Contents (chat, self games, review list) are never
-- returned here and are unreadable to managers in tutor_data.
create or replace function public.get_tutor_summary(p_student uuid)
returns table (sessions integer, weak_topics text[], self_game_count bigint)
language sql security definer stable
set search_path = public
as $$
  select t.sessions, t.weak_topics,
    (select count(*) from public.html_games g
      where g.owner_id = p_student and g.lesson_id is null)
  from public.tutor_data t
  where t.student_id = p_student
    and (auth.uid() = p_student or public.manages(auth.uid(), p_student));
$$;

-- ============ Auth trigger: profile (+ tutor row) for every new user ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  if v_role not in ('principal', 'lead', 'teacher', 'student') then
    v_role := 'student';
  end if;
  insert into public.profiles (id, email, name, role, school_id, team_id, teaching_profile)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    v_role,
    nullif(new.raw_user_meta_data ->> 'school_id', ''),
    nullif(new.raw_user_meta_data ->> 'team_id', ''),
    coalesce((new.raw_user_meta_data -> 'teaching_profile')::jsonb, '{}'::jsonb)
  );
  if v_role = 'student' then
    insert into public.tutor_data (student_id) values (new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role/school/team reassignment through the app: only a principal,
-- only within their own school, only to lead/teacher/student roles,
-- and never changing the school itself. Creating principals and
-- cross-school moves are done with the service role (there is no
-- Admin role). The invite function (service role, no auth context)
-- bypasses this trigger.
create or replace function public.protect_profile_assignment()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_school text;
begin
  if (old.role is distinct from new.role)
    or (old.school_id is distinct from new.school_id)
    or (old.team_id is distinct from new.team_id) then
    if auth.uid() is not null then
      select role, school_id into caller_role, caller_school
        from public.profiles where id = auth.uid();
      if caller_role is distinct from 'principal'
        or old.school_id is distinct from caller_school
        or new.school_id is distinct from caller_school
        or new.role not in ('lead', 'teacher', 'student') then
        raise exception 'only the school principal can reassign accounts within the school';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_assignment on public.profiles;
create trigger protect_profile_assignment
  before update on public.profiles
  for each row execute function public.protect_profile_assignment();

-- ============ Row-level security ============

alter table public.schools enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.lessons enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.proposals enable row level security;
alter table public.repo_items enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.html_games enable row level security;
alter table public.game_results enable row level security;
alter table public.tutor_data enable row level security;
alter table public.space_names enable row level security;

-- Schools / teams: reference data, readable by any signed-in user.
-- No write policy on purpose: schools and teams are managed with the
-- service role (there is no Admin role in the app).
drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools
  for select to authenticated using (auth.uid() is not null);
drop policy if exists schools_admin_write on public.schools;

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated using (auth.uid() is not null);
drop policy if exists teams_admin_write on public.teams;

-- Profiles: self + managed accounts. No INSERT policy on purpose:
-- rows are created only by the auth trigger / service role.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.manages(auth.uid(), id));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- A principal updates accounts of their own school (reassignment).
-- The protect_profile_assignment trigger is what actually permits
-- those field changes; this policy only lets the row through RLS.
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update_principal on public.profiles;
create policy profiles_update_principal on public.profiles
  for update to authenticated
  using (
    public.my_role() = 'principal'
    and school_id = (select school_id from public.profiles where id = auth.uid())
  )
  with check (
    public.my_role() = 'principal'
    and school_id = (select school_id from public.profiles where id = auth.uid())
  );

-- Classes: visible per visibleClasses(); created/edited by the owning
-- teacher, or by the school's principal.
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select to authenticated
  using (public.can_see_class(id, auth.uid()));
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes
  for insert to authenticated
  with check (
    public.my_role() in ('principal', 'lead', 'teacher')
    and (teacher_id = auth.uid() or public.my_role() = 'principal')
  );
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes
  for update to authenticated
  using (teacher_id = auth.uid() or public.my_role() = 'principal')
  with check (teacher_id = auth.uid() or public.my_role() = 'principal');
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes
  for delete to authenticated
  using (teacher_id = auth.uid() or public.my_role() = 'principal');

-- Memberships: readable by the member, class viewers and managers of
-- the member; written by the class teacher or the school principal
-- (covers "add student by email" + class creation).
drop policy if exists memberships_select on public.class_memberships;
create policy memberships_select on public.class_memberships
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.can_see_class(class_id, auth.uid())
    or public.manages(auth.uid(), profile_id)
  );
drop policy if exists memberships_insert on public.class_memberships;
create policy memberships_insert on public.class_memberships
  for insert to authenticated
  with check (
    exists (
      select 1 from public.classes c, public.profiles v
      where c.id = class_id and v.id = auth.uid()
        and (
          c.teacher_id = auth.uid()
          or (v.role = 'principal' and c.school_id = v.school_id)
        )
    )
  );
drop policy if exists memberships_delete on public.class_memberships;
create policy memberships_delete on public.class_memberships
  for delete to authenticated
  using (
    exists (
      select 1 from public.classes c, public.profiles v
      where c.id = class_id and v.id = auth.uid()
        and (
          c.teacher_id = auth.uid()
          or (v.role = 'principal' and c.school_id = v.school_id)
        )
    )
  );

-- Lessons: owner, managers of the owner, staff/students who can see an
-- assignment of the lesson, and repo browsers of an approved copy.
-- Writes are owner-only (never edit someone else's original).
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.manages(auth.uid(), owner_id)
    or exists (
      select 1 from public.assignments a
      where a.lesson_id = lessons.id
        and public.assignment_visible_to(a.id, auth.uid())
    )
    or exists (
      select 1 from public.repo_items r
      where r.lesson_copy_id = lessons.id
        and public.repo_visible_to(r.id, auth.uid())
    )
  );
drop policy if exists lessons_insert on public.lessons;
create policy lessons_insert on public.lessons
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.my_role() in ('principal', 'lead', 'teacher')
  );
drop policy if exists lessons_update on public.lessons;
create policy lessons_update on public.lessons
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
drop policy if exists lessons_delete on public.lessons;
create policy lessons_delete on public.lessons
  for delete to authenticated
  using (owner_id = auth.uid());

-- Assignments: creator, managers, class teachers, assigned students.
-- Created by principal/lead/teacher (ROLE_ACTIONS 'assign').
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select to authenticated
  using (public.assignment_visible_to(id, auth.uid()));
drop policy if exists assignments_insert on public.assignments;
create policy assignments_insert on public.assignments
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.my_role() in ('principal', 'lead', 'teacher')
  );
drop policy if exists assignments_update on public.assignments;
create policy assignments_update on public.assignments
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
drop policy if exists assignments_delete on public.assignments;
create policy assignments_delete on public.assignments
  for delete to authenticated
  using (created_by = auth.uid());

-- Submissions: the student, managers of the student, and the
-- assignment's creator (grading). Students submit only to assignments
-- visible to them.
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.manages(auth.uid(), student_id)
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.created_by = auth.uid()
    )
  );
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.assignment_visible_to(assignment_id, auth.uid())
  );
drop policy if exists submissions_update on public.submissions;
create policy submissions_update on public.submissions
  for update to authenticated
  using (
    student_id = auth.uid()
    or public.manages(auth.uid(), student_id)
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.created_by = auth.uid()
    )
  )
  with check (
    student_id = auth.uid()
    or public.manages(auth.uid(), student_id)
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.created_by = auth.uid()
    )
  );

-- Proposals: the creator, managers of the creator, and same-school
-- staff (the app enforces exactly who decides at each stage).
drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.manages(auth.uid(), created_by)
    or exists (
      select 1 from public.profiles v
      where v.id = auth.uid()
        and v.role in ('principal', 'lead', 'teacher')
        and v.school_id = proposals.school_id
    )
  );
drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals
  for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles v
      where v.id = auth.uid()
        and v.role in ('principal', 'lead', 'teacher')
        and v.school_id = proposals.school_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles v
      where v.id = auth.uid()
        and v.role in ('principal', 'lead', 'teacher')
        and v.school_id = proposals.school_id
    )
  );

-- Repo items: browsable by in-scope staff; inserted by the approver
-- (lead for team repo, principal for school repo).
drop policy if exists repo_items_select on public.repo_items;
create policy repo_items_select on public.repo_items
  for select to authenticated
  using (public.repo_visible_to(id, auth.uid()));
drop policy if exists repo_items_insert on public.repo_items;
create policy repo_items_insert on public.repo_items
  for insert to authenticated
  with check (
    (
      repo = 'school' and public.my_role() = 'principal'
      and school_id = (select school_id from public.profiles where id = auth.uid())
    )
    or (
      repo = 'team' and public.my_role() = 'lead'
      and team_id = (select team_id from public.profiles where id = auth.uid())
    )
  );

-- Exercise sets: creator, managers, and students/teachers who can see
-- an assignment of the lesson. Writes are creator-only.
drop policy if exists exercise_sets_select on public.exercise_sets;
create policy exercise_sets_select on public.exercise_sets
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.manages(auth.uid(), created_by)
    or exists (
      select 1 from public.assignments a
      where a.lesson_id = exercise_sets.lesson_id
        and public.assignment_visible_to(a.id, auth.uid())
    )
  );
drop policy if exists exercise_sets_insert on public.exercise_sets;
create policy exercise_sets_insert on public.exercise_sets
  for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists exercise_sets_update on public.exercise_sets;
create policy exercise_sets_update on public.exercise_sets
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
drop policy if exists exercise_sets_delete on public.exercise_sets;
create policy exercise_sets_delete on public.exercise_sets
  for delete to authenticated
  using (created_by = auth.uid());

-- HTML games: owner always; managers and assigned students ONLY for
-- lesson-attached games. Standalone (Tutor Space) games are
-- owner-only — managers get the count via get_tutor_summary().
drop policy if exists html_games_select on public.html_games;
create policy html_games_select on public.html_games
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      lesson_id is not null
      and (
        public.manages(auth.uid(), owner_id)
        or exists (
          select 1 from public.assignments a
          where a.lesson_id = html_games.lesson_id
            and public.assignment_visible_to(a.id, auth.uid())
        )
      )
    )
  );
drop policy if exists html_games_insert on public.html_games;
create policy html_games_insert on public.html_games
  for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists html_games_update on public.html_games;
create policy html_games_update on public.html_games
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
drop policy if exists html_games_delete on public.html_games;
create policy html_games_delete on public.html_games
  for delete to authenticated
  using (owner_id = auth.uid());

-- Game results: the student, and managers of the student. Insert is
-- self-only; results are never edited.
drop policy if exists game_results_select on public.game_results;
create policy game_results_select on public.game_results
  for select to authenticated
  using (student_id = auth.uid() or public.manages(auth.uid(), student_id));
drop policy if exists game_results_insert on public.game_results;
create policy game_results_insert on public.game_results
  for insert to authenticated
  with check (student_id = auth.uid());

-- Tutor data: owner-only, all operations. (Summary: get_tutor_summary.)
drop policy if exists tutor_data_select on public.tutor_data;
create policy tutor_data_select on public.tutor_data
  for select to authenticated
  using (student_id = auth.uid());
drop policy if exists tutor_data_insert on public.tutor_data;
create policy tutor_data_insert on public.tutor_data
  for insert to authenticated
  with check (student_id = auth.uid());
drop policy if exists tutor_data_update on public.tutor_data;
create policy tutor_data_update on public.tutor_data
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Space names: owner-only.
drop policy if exists space_names_select on public.space_names;
create policy space_names_select on public.space_names
  for select to authenticated
  using (student_id = auth.uid());
drop policy if exists space_names_insert on public.space_names;
create policy space_names_insert on public.space_names
  for insert to authenticated
  with check (student_id = auth.uid());
drop policy if exists space_names_update on public.space_names;
create policy space_names_update on public.space_names
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
drop policy if exists space_names_delete on public.space_names;
create policy space_names_delete on public.space_names
  for delete to authenticated
  using (student_id = auth.uid());

-- Helpers + summary RPC are callable by signed-in users.
grant execute on function public.my_role() to authenticated;
grant execute on function public.manages(uuid, uuid) to authenticated;
grant execute on function public.can_see_class(text, uuid) to authenticated;
grant execute on function public.assignment_visible_to(text, uuid) to authenticated;
grant execute on function public.repo_visible_to(text, uuid) to authenticated;
grant execute on function public.get_tutor_summary(uuid) to authenticated;

-- ============ Seed: schools, teams, classes (same ids as the demo) ============
-- teacher_id stays null until teacher accounts exist; the invite flow
-- (or a later UPDATE) fills it in. Profiles are NOT seeded here: they
-- are created by the auth trigger when accounts are invited.

insert into public.schools (id, name) values
  ('S1', 'Trường Tiểu học An Bình'),
  ('S2', 'Trường Tiểu học Bình Minh')
on conflict (id) do nothing;

insert into public.teams (id, school_id, name) values
  ('T1', 'S1', 'Tổ Toán 5'),
  ('T2', 'S1', 'Tổ Toán 6'),
  ('T3', 'S2', 'Tổ Toán')
on conflict (id) do nothing;

insert into public.classes (id, school_id, team_id, name, grade) values
  ('C5A', 'S1', 'T1', 'Lớp 5A', 5),
  ('C5B', 'S1', 'T1', 'Lớp 5B', 5),
  ('C6B', 'S1', 'T2', 'Lớp 6B', 6),
  ('C5C', 'S2', 'T3', 'Lớp 5C', 5)
on conflict (id) do nothing;

-- EduPro backend — migration 0002: open registration + approval + independent teachers.
--
-- Applies AFTER 0001_init.sql. Re-runnable (IF NOT EXISTS / OR REPLACE /
-- DROP IF EXISTS throughout).
--
-- DECISIONS (user, 2026-11-16):
--   * Open registration (Cách 2): signup offers Principal / Teacher /
--     Student. Team Lead is NOT offered at signup — a principal
--     promotes a teacher to lead later. Approval happens AFTER login
--     ("duyệt sau"): pending accounts can use their private workspace.
--   * A registering Principal names a NEW school (created by the auth
--     trigger) and is active immediately — nobody sits above a
--     principal to approve them. A principal can never claim an
--     existing school at signup.
--   * A registering Teacher picks a school (pending until that
--     school's principal approves) OR registers as an independent
--     teacher with no school (active immediately). A school teacher
--     may also teach outside classes in parallel, so a PENDING
--     teacher can already compose lessons, create games, create
--     classes and add students — those are all private (school_id
--     NULL) until approval. Approval unlocks only school-scoped
--     things: the school/team shared repo, school classes, and being
--     visible to / managed by the school.
--   * A registering Student picks a school (pending until placed in a
--     class) OR registers with no school (independent learner, active
--     immediately). Pending students get their private Tutor Space;
--     being added to a class flips them to active automatically.
--   * The email-invite flow is KEPT: invited accounts skip approval
--     (metadata invited=true -> status active, school/class set by the
--     inviter through the service role).
--
-- MECHANICS:
--   * profiles.status: 'pending' | 'active'. manages() ignores pending
--     accounts, so a pending teacher's lessons/games and a pending
--     student's tutor summary stay private until approval. The
--     profiles SELECT policy additionally lets same-school ACTIVE staff
--     see pending profiles (approval + placement lists).
--   * classes.school_id / team_id become nullable: NULL = the
--     teacher's own outside class, invisible to any principal/lead.
--     Only active members may create school classes (school_id = own
--     school). Principals may edit only classes of their own school.
--   * schools are readable by the anon role (id + name only — that is
--     the whole table), so the signup form can show the school picker
--     before the user has an account.
--   * The protect_profile_assignment trigger now also guards status:
--     only the school's principal may approve/reassign within the
--     school, plus the narrow placement rule below.
--   * activate_student_on_placement: adding a student to any class
--     flips pending -> active. The protect trigger allows that one
--     status-only change when the caller shares the class (teacher)
--     or is the school's principal.

-- ============ Status column ============

alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('pending', 'active'));

create index if not exists idx_profiles_status on public.profiles (status);

-- ============ Outside classes: nullable school/team ============

alter table public.classes alter column school_id drop not null;
alter table public.classes alter column team_id drop not null;

-- ============ Scope helpers: pending accounts are not managed yet ============
-- NOTE: policies on profiles must NEVER query profiles directly (that
-- recurses: 42P17). They go through these SECURITY DEFINER helpers,
-- which read past RLS, exactly like my_role() from 0001.

create or replace function public.my_school_id()
returns text
language sql security definer stable
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_status()
returns text
language sql security definer stable
set search_path = public
as $$
  select status from public.profiles where id = auth.uid();
$$;

grant execute on function public.my_school_id() to authenticated;
grant execute on function public.my_status() to authenticated;

create or replace function public.manages(viewer uuid, target uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select case
    when viewer is null or target is null or viewer = target then false
    when (select status from public.profiles where id = target) is distinct from 'active' then false
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

-- Outside classes (school_id/team_id NULL) are invisible to managers;
-- only the owning teacher and membership reveal them. The owner
-- branch FIRST: without it, a teacher cannot see a class they just
-- created (no membership row exists yet), which breaks INSERT ...
-- RETURNING (the Supabase client always returns the new row) and
-- makes the FIRST membership insert impossible (the membership
-- policy reads the class through this same visibility rule).
create or replace function public.can_see_class(cid text, viewer uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select case
    when viewer is null then false
    when (select teacher_id from public.classes where id = cid) = viewer then true
    when (select role from public.profiles where id = viewer) = 'principal' then
      (select school_id from public.classes where id = cid) is not null
      and (select school_id from public.classes where id = cid)
        = (select school_id from public.profiles where id = viewer)
    when (select role from public.profiles where id = viewer) = 'lead' then
      (select team_id from public.classes where id = cid) is not null
      and (select team_id from public.classes where id = cid)
        = (select team_id from public.profiles where id = viewer)
    else exists (
      select 1 from public.class_memberships
      where class_id = cid and profile_id = viewer
    )
  end;
$$;

-- Pending staff may not browse the shared repo before approval.
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
      and v.status = 'active'
      and (
        (r.repo = 'school' and r.school_id = v.school_id)
        or (r.repo = 'team' and r.team_id = v.team_id)
      )
  );
$$;

-- ============ Auth trigger: signup metadata -> profile + status ============
-- Metadata read from raw_user_meta_data:
--   name (text), role ('principal'|'teacher'|'student'; anything else,
--   including 'lead', coerces to 'student'), school_id (must exist),
--   team_id (must exist), school_name (principal creating a new
--   school), teaching_profile (jsonb), invited ('true' = created by a
--   manager's invite -> active immediately, skipping approval).

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  v_school_id text := nullif(new.raw_user_meta_data ->> 'school_id', '');
  v_team_id text := nullif(new.raw_user_meta_data ->> 'team_id', '');
  v_school_name text := nullif(new.raw_user_meta_data ->> 'school_name', '');
  v_invited boolean := (new.raw_user_meta_data ->> 'invited') = 'true';
  v_status text;
begin
  if v_role not in ('principal', 'teacher', 'student') then
    v_role := 'student';
  end if;
  if v_school_id is not null
    and not exists (select 1 from public.schools where id = v_school_id) then
    v_school_id := null;
  end if;
  if v_team_id is not null
    and not exists (select 1 from public.teams where id = v_team_id) then
    v_team_id := null;
  end if;
  -- A registering principal creates their own new school.
  if v_role = 'principal' and v_school_id is null and v_school_name is not null then
    v_school_id := 'SCH-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.schools (id, name) values (v_school_id, v_school_name);
  end if;
  if v_invited or v_role = 'principal' then
    v_status := 'active';
  elsif v_school_id is not null then
    v_status := 'pending';
  else
    v_status := 'active';
  end if;
  insert into public.profiles (id, email, name, role, school_id, team_id, teaching_profile, status)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    v_role,
    v_school_id,
    v_team_id,
    coalesce((new.raw_user_meta_data -> 'teaching_profile')::jsonb, '{}'::jsonb),
    v_status
  );
  if v_role = 'student' then
    insert into public.tutor_data (student_id) values (new.id);
  end if;
  return new;
end;
$$;

-- ============ Assignment guard: now also covers status ============
-- Only the school's principal may change role/school/team/status
-- within their own school (creating principals and cross-school moves
-- stay service-role operations). One narrow exception: a status-only
-- pending -> active change is also allowed when the caller shares a
-- class with the student (the placement trigger below) or is the
-- school's principal. The invite function (service role, no auth
-- context) bypasses this trigger.

create or replace function public.protect_profile_assignment()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_school text;
  status_only boolean;
begin
  if (old.role is distinct from new.role)
    or (old.school_id is distinct from new.school_id)
    or (old.team_id is distinct from new.team_id)
    or (old.status is distinct from new.status) then
    if auth.uid() is not null then
      select role, school_id into caller_role, caller_school
        from public.profiles where id = auth.uid();
      status_only :=
        (old.role is not distinct from new.role)
        and (old.school_id is not distinct from new.school_id)
        and (old.team_id is not distinct from new.team_id)
        and old.status = 'pending' and new.status = 'active';
      if status_only and (
        (caller_role = 'principal' and old.school_id is not distinct from caller_school)
        or exists (
          select 1
          from public.class_memberships m1
          join public.class_memberships m2 on m2.class_id = m1.class_id
          where m1.profile_id = auth.uid() and m1.kind = 'teacher'
            and m2.profile_id = new.id and m2.kind = 'student'
        )
      ) then
        return new;
      end if;
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

-- ============ Placement activates a pending student ============

create or replace function public.activate_student_on_placement()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.kind = 'student' then
    update public.profiles set status = 'active'
      where id = new.profile_id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists activate_student_on_placement on public.class_memberships;
create trigger activate_student_on_placement
  after insert on public.class_memberships
  for each row execute function public.activate_student_on_placement();

-- ============ Policy updates ============

-- Schools: readable by anyone (id + name only) so the signup form can
-- show the school picker before the user has an account. No write
-- policy on purpose: schools are created by the auth trigger (a
-- registering principal) or with the service role.
drop policy if exists schools_select_anon on public.schools;
create policy schools_select_anon on public.schools
  for select to anon using (true);

-- Profiles: self + managed accounts + pending accounts of the
-- viewer's own school (approval and placement lists, active staff
-- only). The principal/active branch uses only the row's own columns
-- (no manages() table read): during a pending -> active approval
-- UPDATE, manages() still sees the pre-update snapshot (pending) while
-- the row itself already reads active, so without this branch the
-- approved row satisfies NEITHER branch and the UPDATE ... RETURNING
-- fails. For plain SELECTs this branch is exactly the set manages()
-- already returns for a principal, so it changes nothing there.
-- No INSERT policy on purpose: rows are created only by the
-- auth trigger / service role.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or public.manages(auth.uid(), id)
    or (
      status = 'pending'
      and school_id = public.my_school_id()
      and public.my_role() in ('principal', 'lead', 'teacher')
      and public.my_status() = 'active'
    )
    or (
      status = 'active'
      and school_id = public.my_school_id()
      and public.my_role() = 'principal'
    )
  );

-- Classes: a school class (school_id set) may only be created by an
-- ACTIVE member of that school; anyone with the create role may
-- create an outside class (school_id NULL). Principals may edit only
-- classes of their own school.
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes
  for insert to authenticated
  with check (
    public.my_role() in ('principal', 'lead', 'teacher')
    and (teacher_id = auth.uid() or public.my_role() = 'principal')
    and (
      school_id is null
      or school_id = (
        select v.school_id from public.profiles v
        where v.id = auth.uid() and v.status = 'active'
      )
    )
  );
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes
  for update to authenticated
  using (
    teacher_id = auth.uid()
    or (
      public.my_role() = 'principal'
      and school_id = (select school_id from public.profiles where id = auth.uid())
    )
  )
  with check (
    (
      teacher_id = auth.uid()
      and (
        school_id is null
        or school_id = (
          select v.school_id from public.profiles v
          where v.id = auth.uid() and v.status = 'active'
        )
      )
    )
    or (
      public.my_role() = 'principal'
      and school_id = (select school_id from public.profiles where id = auth.uid())
    )
  );
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes
  for delete to authenticated
  using (
    teacher_id = auth.uid()
    or (
      public.my_role() = 'principal'
      and school_id = (select school_id from public.profiles where id = auth.uid())
    )
  );

-- Proposals: pending staff may neither browse nor decide school
-- proposals before approval (same-school-staff clauses require the
-- viewer to be active).
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
        and v.status = 'active'
        and v.school_id = proposals.school_id
    )
  );
drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles v
      where v.id = auth.uid()
        and v.role in ('principal', 'lead', 'teacher')
        and v.status = 'active'
        and v.school_id = proposals.school_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles v
      where v.id = auth.uid()
        and v.role in ('principal', 'lead', 'teacher')
        and v.status = 'active'
        and v.school_id = proposals.school_id
    )
  );

-- ============ RETURNING rule: creators must see their own new row ============
-- The Supabase client always reads back the row it just wrote
-- (INSERT/UPDATE ... RETURNING), and that read-back is gated by the
-- SELECT policy. A SELECT policy that ONLY consults a SECURITY
-- DEFINER function cannot see a just-inserted row: the function's
-- scan runs on the pre-write statement snapshot. So every SELECT
-- policy below ALSO carries a branch built from the row's OWN columns
-- (plus caller helpers), which the new tuple satisfies directly.
-- For plain SELECTs these branches are redundant with the functions
-- (same result on committed rows); for RETURNING they are the whole
-- fix. Tables whose SELECT policy already had such a branch
-- (lessons, submissions, proposals, exercise sets, games, game
-- results, tutor data, space names, memberships) need no change.

create or replace function public.my_team_id()
returns text
language sql security definer stable
set search_path = public
as $$
  select team_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.my_team_id() to authenticated;

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select to authenticated
  using (
    teacher_id = auth.uid()
    or public.can_see_class(id, auth.uid())
  );

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.assignment_visible_to(id, auth.uid())
  );

drop policy if exists repo_items_select on public.repo_items;
create policy repo_items_select on public.repo_items
  for select to authenticated
  using (
    (
      repo = 'school'
      and public.my_role() = 'principal'
      and school_id = public.my_school_id()
    )
    or (
      repo = 'team'
      and public.my_role() = 'lead'
      and team_id = public.my_team_id()
    )
    or public.repo_visible_to(id, auth.uid())
  );

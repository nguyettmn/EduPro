-- EduPro backend — migration 0003: table-level GRANTs for the API roles.
--
-- WHY THIS FILE EXISTS (bug found by live verification, 2026-11-17):
--   Signups succeeded, but no signed-in user could load ANY table — every
--   query failed with "permission denied for table ...". Root cause:
--   migrations 0001/0002 created RLS policies but never granted table
--   privileges. Postgres checks table privileges BEFORE row-level policies,
--   and tables created in the SQL Editor are owned by `postgres`, so the
--   `authenticated` and `anon` roles had no access at all. RLS policies
--   restrict rows; GRANTs open the door. Both are needed.
--
-- WHAT IT DOES:
--   `authenticated` gets SELECT/INSERT/UPDATE/DELETE on all 15 app tables
--   (the RLS policies in 0001/0002 still decide WHICH rows each user sees
--   or changes — the grants add no row-level access by themselves).
--   `anon` gets SELECT on `schools` only, so the signup form can list
--   schools before login (policy `schools_select_anon` in 0002).
--   Default privileges keep future tables created by the SQL Editor owner
--   consistent. The `service_role` needs nothing here: Supabase grants it
--   full access and it bypasses RLS (used by the invite function).
--
-- HOW TO APPLY: SQL Editor -> New query, paste this whole file, Run.
-- Re-runnable: GRANT is idempotent. Apply AFTER 0001 and 0002.
--
-- VALIDATION NOTE: the 0001/0002 harnesses ran as the table owner, which
-- is why they never caught the missing grants. Any future harness MUST run
-- its checks as a non-owner role (SET ROLE authenticated / anon) with a
-- stubbed auth.uid(), or it will miss this whole class of bug.

grant select, insert, update, delete on public.schools to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.class_memberships to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant select, insert, update, delete on public.proposals to authenticated;
grant select, insert, update, delete on public.repo_items to authenticated;
grant select, insert, update, delete on public.exercise_sets to authenticated;
grant select, insert, update, delete on public.html_games to authenticated;
grant select, insert, update, delete on public.game_results to authenticated;
grant select, insert, update, delete on public.tutor_data to authenticated;
grant select, insert, update, delete on public.space_names to authenticated;

-- Sequences (harmless if a table has none; needed by any serial/identity PK).
grant usage, select on all sequences in schema public to authenticated;

-- Signup form: list schools before login. Nothing else for anon.
grant select on public.schools to anon;

-- Keep future tables created by the SQL Editor owner consistent.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated;

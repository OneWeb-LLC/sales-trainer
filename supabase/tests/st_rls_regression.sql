-- Regression checks for st_* RLS / helper ACL (run on One OS after 0003 migration).

do $$
declare
  anon_can_member boolean;
  anon_can_admin boolean;
  has_trigger boolean;
  has_rep_policy boolean;
  old_policy boolean;
  is_manager_dropped boolean;
begin
  select has_function_privilege('anon', 'public.st_is_workspace_member(uuid)', 'EXECUTE')
    into anon_can_member;
  select has_function_privilege('anon', 'public.st_is_workspace_admin(uuid)', 'EXECUTE')
    into anon_can_admin;

  if anon_can_member or anon_can_admin then
    raise exception 'ACL regression: anon can execute st_is_workspace_* (member=%, admin=%)',
      anon_can_member, anon_can_admin;
  end if;

  select exists (
    select 1 from pg_trigger where tgname = 'st_sessions_guard_identity'
  ) into has_trigger;

  select exists (
    select 1 from pg_policies where tablename = 'st_sessions' and policyname = 'st_sessions_update_rep'
  ) into has_rep_policy;

  select exists (
    select 1 from pg_policies where tablename = 'st_sessions' and policyname = 'st_sessions_update_self'
  ) into old_policy;

  select not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'st_profiles'
      and column_name = 'is_manager'
  ) into is_manager_dropped;

  if not has_trigger or not has_rep_policy or old_policy or not is_manager_dropped then
    raise exception
      'schema regression: trigger=%, rep_policy=%, old_self_policy=%, is_manager_dropped=%',
      has_trigger, has_rep_policy, old_policy, is_manager_dropped;
  end if;

  raise notice 'st_rls_regression: ACL and schema checks passed';
end $$;

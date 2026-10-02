-- Corrective security hardening for st_* (One OS)
-- - Session identity columns immutable for non-admins
-- - Split session UPDATE policies (rep vs admin)
-- - Lock down SECURITY DEFINER membership helpers (no anon)
-- - Remove unused st_profiles.is_manager (not used for auth)

-- ---------------------------------------------------------------------------
-- Helper ACL (defense in depth; anon must not execute SECURITY DEFINER helpers)
-- ---------------------------------------------------------------------------
revoke all on function public.st_is_workspace_member(uuid) from public;
revoke all on function public.st_is_workspace_admin(uuid) from public;
revoke execute on function public.st_is_workspace_member(uuid) from anon;
revoke execute on function public.st_is_workspace_admin(uuid) from anon;
grant execute on function public.st_is_workspace_member(uuid) to authenticated;
grant execute on function public.st_is_workspace_admin(uuid) to authenticated;
grant execute on function public.st_is_workspace_member(uuid) to service_role;
grant execute on function public.st_is_workspace_admin(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- st_profiles: drop client-promotable manager flag (auth via ao_org_members only)
-- ---------------------------------------------------------------------------
alter table public.st_profiles drop column if exists is_manager;

drop policy if exists st_profiles_update_own on public.st_profiles;

create policy st_profiles_update_own on public.st_profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- st_sessions: prevent rep ownership / tenant / scenario reassignment
-- ---------------------------------------------------------------------------
create or replace function public.st_sessions_guard_identity_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if public.st_is_workspace_admin(old.workspace_id) then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.workspace_id is distinct from old.workspace_id
     or new.scenario_id is distinct from old.scenario_id then
    raise exception 'st_sessions identity columns are immutable for non-admin members'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.st_sessions_guard_identity_columns() from public;
grant execute on function public.st_sessions_guard_identity_columns() to authenticated;
grant execute on function public.st_sessions_guard_identity_columns() to service_role;

drop trigger if exists st_sessions_guard_identity on public.st_sessions;

create trigger st_sessions_guard_identity
  before update on public.st_sessions
  for each row
  execute function public.st_sessions_guard_identity_columns();

drop policy if exists st_sessions_update_self on public.st_sessions;

create policy st_sessions_update_rep on public.st_sessions
  for update to authenticated
  using (
    public.st_is_workspace_member(workspace_id)
    and user_id = auth.uid()
  )
  with check (
    public.st_is_workspace_member(workspace_id)
    and user_id = auth.uid()
  );

create policy st_sessions_update_admin on public.st_sessions
  for update to authenticated
  using (public.st_is_workspace_admin(workspace_id))
  with check (public.st_is_workspace_admin(workspace_id));

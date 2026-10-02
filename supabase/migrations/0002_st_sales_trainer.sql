-- AI Sales Trainer (st_*) — One OS additive schema
-- Workspace-scoped; uses ao_org_members for membership checks.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.st_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ao_org_members m
    where m.org_id = p_workspace_id
      and m.user_id = auth.uid()::text
      and m.left_at is null
  );
$$;

create or replace function public.st_is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ao_org_members m
    where m.org_id = p_workspace_id
      and m.user_id = auth.uid()::text
      and m.left_at is null
      and lower(coalesce(m.role::text, '')) in ('owner', 'admin')
  );
$$;

revoke all on function public.st_is_workspace_member(uuid) from public;
revoke all on function public.st_is_workspace_admin(uuid) from public;
grant execute on function public.st_is_workspace_member(uuid) to authenticated;
grant execute on function public.st_is_workspace_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- st_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.st_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_manager boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.st_profiles enable row level security;

create policy st_profiles_select_own on public.st_profiles
  for select to authenticated using (auth.uid() = id);

create policy st_profiles_insert_own on public.st_profiles
  for insert to authenticated with check (auth.uid() = id);

create policy st_profiles_update_own on public.st_profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- st_scenarios
-- ---------------------------------------------------------------------------
create table if not exists public.st_scenarios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.ao_orgs (id) on delete cascade,
  slug text not null,
  title text not null,
  summary text,
  language text not null default 'en' check (language in ('en', 'es')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  vertical_tag text,
  published boolean not null default false,
  pass_threshold_pct numeric(5,2) not null default 70,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index if not exists st_scenarios_workspace_idx on public.st_scenarios (workspace_id);

alter table public.st_scenarios enable row level security;

create policy st_scenarios_select_member on public.st_scenarios
  for select to authenticated
  using (public.st_is_workspace_member(workspace_id) and (published or public.st_is_workspace_admin(workspace_id)));

create policy st_scenarios_insert_admin on public.st_scenarios
  for insert to authenticated
  with check (public.st_is_workspace_admin(workspace_id));

create policy st_scenarios_update_admin on public.st_scenarios
  for update to authenticated
  using (public.st_is_workspace_admin(workspace_id))
  with check (public.st_is_workspace_admin(workspace_id));

create policy st_scenarios_delete_admin on public.st_scenarios
  for delete to authenticated
  using (public.st_is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- st_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.st_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.ao_orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id uuid not null references public.st_scenarios (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'live', 'completed', 'aborted')),
  room_name text,
  language text not null default 'en',
  retry_focus jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists st_sessions_user_idx on public.st_sessions (workspace_id, user_id, created_at desc);

alter table public.st_sessions enable row level security;

create policy st_sessions_select_member on public.st_sessions
  for select to authenticated
  using (
    public.st_is_workspace_member(workspace_id)
    and (user_id = auth.uid() or public.st_is_workspace_admin(workspace_id))
  );

create policy st_sessions_insert_self on public.st_sessions
  for insert to authenticated
  with check (
    public.st_is_workspace_member(workspace_id)
    and user_id = auth.uid()
  );

create policy st_sessions_update_self on public.st_sessions
  for update to authenticated
  using (
    public.st_is_workspace_member(workspace_id)
    and (user_id = auth.uid() or public.st_is_workspace_admin(workspace_id))
  )
  with check (public.st_is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- st_transcript_lines
-- ---------------------------------------------------------------------------
create table if not exists public.st_transcript_lines (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.st_sessions (id) on delete cascade,
  speaker text not null check (speaker in ('rep', 'prospect', 'system')),
  content text not null,
  offset_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists st_transcript_session_idx on public.st_transcript_lines (session_id, id);

alter table public.st_transcript_lines enable row level security;

create policy st_transcript_select on public.st_transcript_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.st_sessions s
      where s.id = session_id
        and public.st_is_workspace_member(s.workspace_id)
        and (s.user_id = auth.uid() or public.st_is_workspace_admin(s.workspace_id))
    )
  );

create policy st_transcript_insert on public.st_transcript_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from public.st_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
        and public.st_is_workspace_member(s.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- st_scorecards
-- ---------------------------------------------------------------------------
create table if not exists public.st_scorecards (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.st_sessions (id) on delete cascade,
  total_score numeric(5,2) not null,
  passed boolean not null,
  rubric jsonb not null default '{}'::jsonb,
  coaching jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now()
);

alter table public.st_scorecards enable row level security;

create policy st_scorecards_select on public.st_scorecards
  for select to authenticated
  using (
    exists (
      select 1 from public.st_sessions s
      where s.id = session_id
        and public.st_is_workspace_member(s.workspace_id)
        and (s.user_id = auth.uid() or public.st_is_workspace_admin(s.workspace_id))
    )
  );

-- Inserts/updates via service role only (evaluation API)

-- ---------------------------------------------------------------------------
-- st_certifications
-- ---------------------------------------------------------------------------
create table if not exists public.st_certifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.ao_orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id uuid not null references public.st_scenarios (id) on delete cascade,
  score numeric(5,2) not null,
  certified_at timestamptz not null default now(),
  unique (workspace_id, user_id, scenario_id)
);

alter table public.st_certifications enable row level security;

create policy st_certifications_select on public.st_certifications
  for select to authenticated
  using (
    public.st_is_workspace_member(workspace_id)
    and (user_id = auth.uid() or public.st_is_workspace_admin(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- st_coaching_assignments
-- ---------------------------------------------------------------------------
create table if not exists public.st_coaching_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.ao_orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id uuid references public.st_scenarios (id) on delete set null,
  assigned_by uuid references auth.users (id) on delete set null,
  focus_areas jsonb not null default '[]'::jsonb,
  notes text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.st_coaching_assignments enable row level security;

create policy st_coaching_select on public.st_coaching_assignments
  for select to authenticated
  using (
    public.st_is_workspace_member(workspace_id)
    and (user_id = auth.uid() or public.st_is_workspace_admin(workspace_id))
  );

create policy st_coaching_admin_write on public.st_coaching_assignments
  for all to authenticated
  using (public.st_is_workspace_admin(workspace_id))
  with check (public.st_is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- st_rep_stats (materialized summary)
-- ---------------------------------------------------------------------------
create table if not exists public.st_rep_stats (
  workspace_id uuid not null references public.ao_orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sessions_completed integer not null default 0,
  avg_score numeric(5,2),
  certifications_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.st_rep_stats enable row level security;

create policy st_rep_stats_select on public.st_rep_stats
  for select to authenticated
  using (
    public.st_is_workspace_member(workspace_id)
    and (user_id = auth.uid() or public.st_is_workspace_admin(workspace_id))
  );

-- ============================================================
-- AAS AGENTIC OS — Supabase schema (multi-user pilot)
-- Run this in Supabase → SQL Editor on a fresh project.
--
-- Model: one row per workspace (client), members join through
-- profiles, all work lives in tasks with a JSON config snapshot
-- per workspace (the same white-label schema as the static app).
-- Row Level Security keeps every workspace's data isolated.
-- ============================================================

-- ---------- workspaces (one per client) ----------
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- the entire white-label config (brand, terms, workstreams,
  -- routing rules, checklists, governance) — same schema as
  -- assets/config.js in the static prototype
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- profiles (app users; 1:1 with auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  workspace_id uuid references workspaces (id) on delete set null,
  name text not null default '',
  title text not null default '',
  role text not null default 'owner'
    check (role in ('admin', 'owner', 'reviewer', 'requester')),
  created_at timestamptz not null default now()
);

-- ---------- invites (admin-created path for teammates) ----------
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  email text not null,
  role text not null
    check (role in ('admin', 'owner', 'reviewer', 'requester')),
  token uuid not null default gen_random_uuid() unique,
  created_by uuid references profiles (id),
  accepted_by uuid references profiles (id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create unique index if not exists invites_pending_email
  on invites (workspace_id, lower(email))
  where accepted_at is null;
create index if not exists invites_token_active
  on invites (token)
  where accepted_at is null;

-- ---------- tasks ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  title text not null,
  requester text not null default '',
  workstream_id text not null default '',
  desired_output text not null default '',
  notes text not null default '',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  flags jsonb not null default '{}',
  track text not null default 'quick' check (track in ('quick', 'full')),
  stage text not null default 'intake'
    check (stage in ('intake', 'routing', 'owned', 'in_review', 'ready', 'shipped')),
  blocked boolean not null default false,
  blocked_reason text,
  owner_id uuid references profiles (id) on delete set null,
  backup_id uuid references profiles (id) on delete set null,
  escalation_id uuid references profiles (id) on delete set null,
  reviewer_id uuid references profiles (id) on delete set null,
  checklist jsonb not null default '{}',
  signoff jsonb,          -- { reviewer_id, notes, ts }
  ship_id text,
  due_date timestamptz,
  shipped_at timestamptz,
  cycle_time_hours numeric,
  ai_used jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_ws_stage on tasks (workspace_id, stage);
create index if not exists profiles_workspace on profiles (workspace_id);

-- ---------- agent runs (advisory AI outputs, approval-gated) ----------
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  task_id uuid not null references tasks (id) on delete cascade,
  agent_type text not null,
  source text not null default 'simulated' check (source in ('simulated', 'live')),
  output text not null default '',
  approved boolean not null default false,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ---------- audit trail (append-only) ----------
create table if not exists audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  task_id uuid references tasks (id) on delete cascade,
  actor text not null default 'System',
  event text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table audit_events add column if not exists payload jsonb not null default '{}';
create index if not exists audit_ws_time on audit_events (workspace_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY — workspace isolation
-- ============================================================
alter table workspaces enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table tasks enable row level security;
alter table agent_runs enable row level security;
alter table audit_events enable row level security;

-- helper: the caller's workspace
create or replace function my_workspace_id()
returns uuid language sql stable security definer set search_path = public as
$$ select workspace_id from profiles where id = (select auth.uid()) $$;

create or replace function my_role()
returns text language sql stable security definer set search_path = public as
$$ select role from profiles where id = (select auth.uid()) $$;

create or replace function create_workspace_with_profile(ws_name text, ws_config jsonb, user_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if nullif(trim(ws_name), '') is null then
    raise exception 'Workspace name is required';
  end if;
  if nullif(trim(user_name), '') is null then
    raise exception 'User name is required';
  end if;
  if exists (select 1 from profiles where id = (select auth.uid())) then
    raise exception 'Already onboarded';
  end if;

  insert into workspaces (name, config)
  values (trim(ws_name), coalesce(ws_config, '{}'::jsonb))
  returning id into ws_id;

  insert into profiles (id, workspace_id, name, role)
  values ((select auth.uid()), ws_id, trim(user_name), 'admin');

  return ws_id;
end $$;

create or replace function create_invite(invite_email text, invite_role text default 'reviewer')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
  normalized_email text;
  clean_role text;
  invite_token uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if (select my_role()) <> 'admin' then
    raise exception 'Only workspace admins can create invites';
  end if;

  ws_id := (select my_workspace_id());
  normalized_email := lower(trim(invite_email));
  clean_role := lower(trim(invite_role));

  if nullif(normalized_email, '') is null or position('@' in normalized_email) = 0 then
    raise exception 'A valid invite email is required';
  end if;
  if clean_role not in ('admin', 'owner', 'reviewer', 'requester') then
    raise exception 'Invalid invite role';
  end if;

  delete from invites
  where workspace_id = ws_id
    and lower(email) = normalized_email
    and accepted_at is null;

  insert into invites (workspace_id, email, role, created_by)
  values (ws_id, normalized_email, clean_role, (select auth.uid()))
  returning token into invite_token;

  return invite_token;
end $$;

create or replace function accept_invite(invite_token uuid, user_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  invite_row invites%rowtype;
  jwt_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if nullif(trim(user_name), '') is null then
    raise exception 'User name is required';
  end if;

  select * into invite_row
  from invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;
  if invite_row.accepted_at is not null then
    raise exception 'Invite has already been accepted';
  end if;
  if invite_row.expires_at < now() then
    raise exception 'Invite has expired';
  end if;

  jwt_email := lower(coalesce(auth.jwt()->>'email', ''));
  if jwt_email = '' or jwt_email <> lower(invite_row.email) then
    raise exception 'Invite email does not match the signed-in user';
  end if;
  if exists (select 1 from profiles where id = (select auth.uid())) then
    raise exception 'Already onboarded';
  end if;

  insert into profiles (id, workspace_id, name, role)
  values ((select auth.uid()), invite_row.workspace_id, trim(user_name), invite_row.role);

  update invites
  set accepted_by = (select auth.uid()),
      accepted_at = now()
  where id = invite_row.id;

  return invite_row.workspace_id;
end $$;

create or replace function admin_set_role(target_profile_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  clean_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if (select my_role()) <> 'admin' then
    raise exception 'Only workspace admins can change roles';
  end if;

  clean_role := lower(trim(new_role));
  if clean_role not in ('admin', 'owner', 'reviewer', 'requester') then
    raise exception 'Invalid role';
  end if;
  if target_profile_id = (select auth.uid()) and clean_role <> 'admin' then
    raise exception 'Admins cannot remove their own admin role';
  end if;
  if not exists (
    select 1 from profiles
    where id = target_profile_id
      and workspace_id = (select my_workspace_id())
  ) then
    raise exception 'Profile is not in your workspace';
  end if;

  perform set_config('app.allow_profile_privilege_change', 'on', true);
  update profiles
  set role = clean_role
  where id = target_profile_id;
end $$;

create or replace function reroute_task(task_id uuid, new_flags jsonb, new_track text, reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  task_row tasks%rowtype;
  clean_track text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if (select my_role()) not in ('admin', 'owner') then
    raise exception 'Only owners or admins can reroute tasks';
  end if;

  clean_track := lower(trim(new_track));
  if clean_track not in ('quick', 'full') then
    raise exception 'Invalid track';
  end if;

  select * into task_row
  from tasks
  where id = task_id
    and workspace_id = (select my_workspace_id())
  for update;

  if not found then
    raise exception 'Task not found';
  end if;
  if task_row.stage = 'shipped' then
    raise exception 'Shipped tasks cannot be rerouted';
  end if;
  if task_row.track = 'full' and clean_track = 'quick' and nullif(trim(reason), '') is null then
    raise exception 'Downgrading from Full Review requires a reason';
  end if;

  perform set_config('app.allow_task_reroute', 'on', true);
  update tasks
  set flags = coalesce(new_flags, '{}'::jsonb),
      track = clean_track
  where id = task_id;

  insert into audit_events (workspace_id, task_id, actor, event, payload)
  values (
    task_row.workspace_id,
    task_row.id,
    coalesce((select nullif(name, '') from profiles where id = (select auth.uid())), (select auth.uid())::text),
    'Task rerouted',
    jsonb_build_object('from_track', task_row.track, 'to_track', clean_track, 'reason', nullif(trim(reason), ''))
  );
end $$;

drop policy if exists "profiles read own workspace" on profiles;
drop policy if exists "profiles update self" on profiles;
drop policy if exists "profiles insert self" on profiles;
drop policy if exists "profiles update self basic fields" on profiles;
drop policy if exists "invites read admin" on invites;
drop policy if exists "workspaces read member" on workspaces;
drop policy if exists "workspaces insert any authed" on workspaces;
drop policy if exists "workspaces update member admin" on workspaces;
drop policy if exists "tasks by workspace" on tasks;
drop policy if exists "tasks select by workspace" on tasks;
drop policy if exists "tasks insert by workspace member" on tasks;
drop policy if exists "tasks update by workspace staff" on tasks;
drop policy if exists "runs by workspace" on agent_runs;
drop policy if exists "audit read by workspace" on audit_events;
drop policy if exists "audit insert by workspace" on audit_events;

-- profiles: read everyone in your workspace; edit only your non-privileged fields
create policy "profiles read own workspace" on profiles for select
  using (workspace_id = (select my_workspace_id()) or id = (select auth.uid()));
create policy "profiles update self basic fields" on profiles for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and workspace_id = (select my_workspace_id())
    and role = (select my_role())
  );

-- invites: admins can inspect pending/accepted invites; writes go through RPCs
create policy "invites read admin" on invites for select
  using (workspace_id = (select my_workspace_id()) and (select my_role()) = 'admin');

-- workspaces: members can read; admins can update config. Creation goes through RPC.
create policy "workspaces read member" on workspaces for select
  using (id = (select my_workspace_id()));
create policy "workspaces update member admin" on workspaces for update
  using (id = (select my_workspace_id()) and (select my_role()) = 'admin')
  with check (id = (select my_workspace_id()) and (select my_role()) = 'admin');

-- tasks / agent_runs / audit: full access within your own workspace
create policy "tasks select by workspace" on tasks for select
  using (workspace_id = (select my_workspace_id()));
create policy "tasks insert by workspace member" on tasks for insert
  with check (
    workspace_id = (select my_workspace_id())
    and (select my_role()) in ('admin', 'owner', 'reviewer', 'requester')
  );
create policy "tasks update by workspace staff" on tasks for update
  using (
    workspace_id = (select my_workspace_id())
    and (select my_role()) in ('admin', 'owner', 'reviewer')
  )
  with check (workspace_id = (select my_workspace_id()));
create policy "runs by workspace" on agent_runs for all
  using (workspace_id = (select my_workspace_id()))
  with check (workspace_id = (select my_workspace_id()));
create policy "audit read by workspace" on audit_events for select
  using (workspace_id = (select my_workspace_id()));

-- ============================================================
-- GUARDRAILS AT THE DATABASE LEVEL
-- The app enforces these too, but the DB is the backstop:
--   1. new tasks start in intake/routing and follow valid stage transitions
--   2. no task may leave routing without an owner
--   3. quick-track work must finish its checklist before ready/shipped
--   4. full-review work must have non-owner reviewer sign-off
-- ============================================================
create or replace function enforce_guardrails()
returns trigger language plpgsql as $$
declare
  quick_item record;
  full_item record;
  signoff_reviewer uuid;
  actor_id uuid;
  actor_role text;
  allow_reroute boolean;
begin
  actor_id := (select auth.uid());
  actor_role := (select my_role());
  allow_reroute := coalesce(current_setting('app.allow_task_reroute', true), '') = 'on';

  if tg_op = 'INSERT' then
    if actor_id is not null and actor_role not in ('admin', 'owner', 'reviewer', 'requester') then
      raise exception 'Guardrail: a workspace role is required to submit tasks';
    end if;
    if new.stage <> 'intake' then
      raise exception 'Guardrail: new tasks must start in intake';
    end if;
    if new.owner_id is not null or new.reviewer_id is not null or new.signoff is not null then
      raise exception 'Guardrail: new tasks cannot start with owner, reviewer, or sign-off data';
    end if;
  end if;

  if tg_op = 'UPDATE' and actor_id is not null then
    if actor_role = 'requester' then
      raise exception 'Guardrail: requesters can submit tasks only';
    end if;
    if actor_role = 'reviewer' then
      if old.track <> 'full' or old.stage <> 'in_review' then
        raise exception 'Guardrail: reviewers can only update Full Review tasks in review';
      end if;
      if old.owner_id = actor_id then
        raise exception 'Guardrail: reviewer must be someone other than the owner';
      end if;
      if (to_jsonb(new) - 'checklist' - 'reviewer_id' - 'signoff' - 'stage' - 'updated_at')
        is distinct from
        (to_jsonb(old) - 'checklist' - 'reviewer_id' - 'signoff' - 'stage' - 'updated_at') then
        raise exception 'Guardrail: reviewers can only update checklist and sign-off fields';
      end if;
      if new.stage = 'in_review' then
        if new.reviewer_id is distinct from old.reviewer_id or new.signoff is distinct from old.signoff then
          raise exception 'Guardrail: reviewer sign-off is only recorded when moving to ready';
        end if;
      elsif new.stage = 'ready' then
        if new.reviewer_id <> actor_id then
          raise exception 'Guardrail: sign-off must be recorded by the assigned reviewer';
        end if;
      else
        raise exception 'Guardrail: reviewers cannot move tasks to %', new.stage;
      end if;
    elsif actor_role not in ('admin', 'owner') then
      raise exception 'Guardrail: only owners, reviewers, or admins can update tasks';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.track is distinct from new.track and not allow_reroute then
    raise exception 'Guardrail: track changes require a dedicated reroute flow';
  end if;

  if tg_op = 'UPDATE' and old.stage is distinct from new.stage then
    if not (
      (old.stage = 'intake' and new.stage = 'routing')
      or (old.stage = 'routing' and new.stage = 'owned')
      or (old.stage = 'owned' and old.track = 'quick' and new.stage = 'ready')
      or (old.stage = 'owned' and old.track = 'full' and new.stage = 'in_review')
      or (old.stage = 'in_review' and new.stage = 'ready')
      or (old.stage = 'ready' and new.stage = 'shipped')
    ) then
      raise exception 'Guardrail: invalid stage transition from % to %', old.stage, new.stage;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.signoff is distinct from new.signoff then
    if not (old.stage = 'in_review' and new.stage = 'ready' and new.track = 'full') then
      raise exception 'Guardrail: sign-off can only be recorded during Full Review sign-off';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.reviewer_id is distinct from new.reviewer_id then
    if not (old.stage = 'in_review' and new.stage = 'ready' and new.track = 'full') then
      raise exception 'Guardrail: reviewer can only be assigned during Full Review sign-off';
    end if;
  end if;

  if new.stage in ('owned', 'in_review', 'ready', 'shipped') and new.owner_id is null then
    raise exception 'Guardrail: a task cannot proceed without one named owner';
  end if;

  if new.track = 'quick' and new.stage in ('ready', 'shipped') then
    for quick_item in
      select item.value->>'id' as id
      from workspaces w
      cross join jsonb_array_elements(coalesce(w.config #> '{checklists,quick}', '[]'::jsonb)) as item(value)
      where w.id = new.workspace_id
    loop
      if coalesce(new.checklist->>quick_item.id, 'false') <> 'true' then
        raise exception 'Guardrail: Quick Check item % is incomplete', quick_item.id;
      end if;
    end loop;
  end if;

  if new.track = 'full' and new.stage in ('ready', 'shipped') then
    for full_item in
      select item.value->>'id' as id
      from workspaces w
      cross join jsonb_array_elements(coalesce(w.config #> '{checklists,full}', '[]'::jsonb)) as item(value)
      where w.id = new.workspace_id
        and coalesce((item.value->>'requiresReviewer')::boolean, false) is false
    loop
      if coalesce(new.checklist->>full_item.id, 'false') <> 'true' then
        raise exception 'Guardrail: Full Review item % is incomplete', full_item.id;
      end if;
    end loop;

    if new.signoff is null then
      raise exception 'Guardrail: Full Review work cannot ship without a reviewer sign-off';
    end if;
    if new.reviewer_id is null or new.reviewer_id = new.owner_id then
      raise exception 'Guardrail: reviewer must be someone other than the owner';
    end if;
    begin
      signoff_reviewer := nullif(new.signoff->>'reviewer_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Guardrail: sign-off reviewer id is invalid';
    end;
    if signoff_reviewer is null or signoff_reviewer <> new.reviewer_id then
      raise exception 'Guardrail: sign-off reviewer must match the assigned reviewer';
    end if;
    if tg_op = 'UPDATE'
      and (old.signoff is distinct from new.signoff or (old.stage = 'in_review' and new.stage = 'ready'))
      and (select auth.uid()) is not null
      and new.reviewer_id <> (select auth.uid()) then
      raise exception 'Guardrail: sign-off must be recorded by the assigned reviewer';
    end if;
  end if;

  if new.stage = 'shipped' then
    new.shipped_at = coalesce(new.shipped_at, now());
    new.cycle_time_hours = coalesce(
      new.cycle_time_hours,
      round((extract(epoch from (new.shipped_at - new.created_at)) / 3600)::numeric, 2)
    );
  end if;

  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tasks_guardrails on tasks;
create trigger tasks_guardrails before insert or update on tasks
  for each row execute function enforce_guardrails();

create or replace function prevent_profile_privilege_changes()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.allow_profile_privilege_change', true), '') = 'on' then
    new.name = trim(new.name);
    new.title = trim(new.title);
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'Guardrail: profile id cannot be changed';
  end if;
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'Guardrail: workspace changes require an invite or admin RPC';
  end if;
  if new.role is distinct from old.role then
    raise exception 'Guardrail: role changes require an admin RPC';
  end if;
  new.name = trim(new.name);
  new.title = trim(new.title);
  return new;
end $$;

drop trigger if exists profiles_privilege_guard on profiles;
create trigger profiles_privilege_guard before update on profiles
  for each row execute function prevent_profile_privilege_changes();

create or replace function audit_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_name text;
  event_text text;
  event_payload jsonb;
begin
  select coalesce(nullif(name, ''), id::text)
    into actor_name
    from profiles
    where id = (select auth.uid());
  actor_name := coalesce(actor_name, 'System');

  if tg_op = 'INSERT' then
    event_text := 'Task created in ' || new.stage;
    event_payload := jsonb_build_object('stage', new.stage, 'track', new.track);
  elsif old.stage is distinct from new.stage then
    event_text := 'Stage changed: ' || old.stage || ' -> ' || new.stage;
    event_payload := jsonb_build_object('from_stage', old.stage, 'to_stage', new.stage, 'track', new.track);
  elsif old.track is distinct from new.track then
    event_text := 'Task rerouted';
    event_payload := jsonb_build_object('from_track', old.track, 'to_track', new.track);
  elsif old.owner_id is distinct from new.owner_id then
    event_text := 'Owner updated';
    event_payload := jsonb_build_object('from_owner_id', old.owner_id, 'to_owner_id', new.owner_id);
  elsif old.reviewer_id is distinct from new.reviewer_id or old.signoff is distinct from new.signoff then
    event_text := 'Reviewer sign-off updated';
    event_payload := jsonb_build_object('reviewer_id', new.reviewer_id, 'signed_off', new.signoff is not null);
  elsif old.checklist is distinct from new.checklist then
    event_text := 'Checklist updated';
    event_payload := jsonb_build_object('track', new.track, 'stage', new.stage);
  else
    event_text := 'Task updated';
    event_payload := '{}'::jsonb;
  end if;

  insert into audit_events (workspace_id, task_id, actor, event, payload)
  values (new.workspace_id, new.id, actor_name, event_text, event_payload);

  return new;
end $$;

drop trigger if exists tasks_audit on tasks;
create trigger tasks_audit after insert or update on tasks
  for each row execute function audit_task_change();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tasks'
    ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

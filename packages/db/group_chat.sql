-- Group chat tables for the live Supabase project.
-- Apply this in the Supabase SQL editor. The legacy schema.sql file is reference-only.

create extension if not exists pgcrypto;

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  avatar_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.chat_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists chat_group_members_user_idx
  on public.chat_group_members (user_id);

create index if not exists chat_group_messages_group_created_idx
  on public.chat_group_messages (group_id, created_at);

create or replace function public.set_chat_group_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.chat_groups
    set updated_at = now()
    where id = new.group_id;
  return new;
end;
$$;

drop trigger if exists chat_group_messages_touch_group on public.chat_group_messages;
create trigger chat_group_messages_touch_group
after insert on public.chat_group_messages
for each row execute function public.set_chat_group_updated_at();

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_messages enable row level security;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

drop policy if exists "Group members can read groups" on public.chat_groups;
create policy "Group members can read groups"
on public.chat_groups for select
using (
  created_by = auth.uid() or
  public.is_group_member(id)
);

drop policy if exists "Authenticated users can create groups" on public.chat_groups;
create policy "Authenticated users can create groups"
on public.chat_groups for insert
with check (created_by = auth.uid());

drop policy if exists "Group owners can update groups" on public.chat_groups;
create policy "Group owners can update groups"
on public.chat_groups for update
using (
  exists (
    select 1
    from public.chat_group_members members
    where members.group_id = id
      and members.user_id = auth.uid()
      and members.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.chat_group_members members
    where members.group_id = id
      and members.user_id = auth.uid()
      and members.role = 'owner'
  )
);

drop policy if exists "Group members can read memberships" on public.chat_group_members;
create policy "Group members can read memberships"
on public.chat_group_members for select
using (
  public.is_group_member(group_id)
);

drop policy if exists "Group creators can add initial members" on public.chat_group_members;
create policy "Group creators can add initial members"
on public.chat_group_members for insert
with check (
  exists (
    select 1
    from public.chat_groups groups
    where groups.id = group_id
      and groups.created_by = auth.uid()
  )
);

create or replace function public.mark_chat_group_read(
  p_group_id uuid,
  p_read_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_group_members
    set last_read_at = coalesce(p_read_at, now())
    where group_id = p_group_id
      and user_id = auth.uid();
end;
$$;

grant execute on function public.mark_chat_group_read(uuid, timestamptz) to authenticated;

drop policy if exists "Group members can read messages" on public.chat_group_messages;
create policy "Group members can read messages"
on public.chat_group_messages for select
using (
  public.is_group_member(group_id)
);

drop policy if exists "Group members can send messages" on public.chat_group_messages;
create policy "Group members can send messages"
on public.chat_group_messages for insert
with check (
  sender_id = auth.uid()
  and public.is_group_member(group_id)
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_group_members;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_group_messages;
  exception when duplicate_object then
    null;
  end;
end;
$$;

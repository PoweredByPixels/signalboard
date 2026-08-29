-- Signalboard: each user owns one persisted workspace and, optionally, one LinkedIn connection.
create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  jobs jsonb not null default '[]'::jsonb,
  searches jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.linkedin_authorizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token_ciphertext text not null,
  expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_workspaces enable row level security;
alter table public.linkedin_authorizations enable row level security;

create policy "Users own their workspace" on public.user_workspaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- OAuth tokens are never readable from the browser; Netlify uses the service-role key.
create policy "Users can see whether LinkedIn is linked" on public.linkedin_authorizations
  for select using (auth.uid() = user_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists user_workspaces_touch on public.user_workspaces;
create trigger user_workspaces_touch before update on public.user_workspaces
  for each row execute procedure public.touch_updated_at();
drop trigger if exists linkedin_authorizations_touch on public.linkedin_authorizations;
create trigger linkedin_authorizations_touch before update on public.linkedin_authorizations
  for each row execute procedure public.touch_updated_at();

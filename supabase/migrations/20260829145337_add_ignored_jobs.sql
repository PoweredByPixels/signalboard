-- Store user-dismissed job discoveries separately from active pipeline cards.
alter table public.user_workspaces
  add column if not exists ignored_jobs jsonb not null default '[]'::jsonb;

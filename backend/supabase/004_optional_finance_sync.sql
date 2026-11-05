begin;
create table if not exists public.finance_sync_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(snapshot) = 'object')
);
alter table public.finance_sync_snapshots enable row level security;
revoke all on public.finance_sync_snapshots from anon, authenticated;
comment on table public.finance_sync_snapshots is 'Optional account-owned sync snapshots. Receipt photos and device paths are excluded. Only authenticated backend operations with explicit client consent write here.';
commit;

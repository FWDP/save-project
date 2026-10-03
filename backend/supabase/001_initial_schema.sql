create table if not exists public.user_profiles (
  legacy_id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  client_mutation_id text,
  type text not null check (type in ('expense', 'income')),
  amount numeric(18, 2) not null check (amount >= 0),
  category text not null,
  description text not null,
  date text not null,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  merchant text,
  tags text[] not null default '{}',
  recurring boolean not null default false,
  receipt_uri text,
  custom_fields jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions(user_id, created_at desc);
create index if not exists transactions_user_type_date_idx on public.transactions(user_id, type, date desc);
create index if not exists transactions_user_category_date_idx on public.transactions(user_id, category, date desc);
create unique index if not exists transactions_user_mutation_uidx on public.transactions(user_id, client_mutation_id) where client_mutation_id is not null;

create table if not exists public.categories (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income')),
  color text not null default '#6366F1',
  replaces_built_in_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists categories_user_idx on public.categories(user_id, created_at desc);

create table if not exists public.budgets (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  category text not null,
  budget_limit numeric(18, 2) not null check (budget_limit >= 0),
  spent numeric(18, 2) not null default 0 check (spent >= 0),
  period text not null default 'monthly' check (period in ('monthly', 'weekly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_user_category_key unique(user_id, category)
);

create table if not exists public.savings_goals (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(24, 7) not null check (target_amount >= 0),
  funded_amount numeric(24, 7) not null default 0 check (funded_amount >= 0),
  target_date text,
  asset text not null default 'XLM',
  status text not null default 'draft' check (status in ('draft', 'pending', 'active', 'completed', 'withdrawn', 'cancelled')),
  network text not null default 'testnet',
  owner_address text,
  contract_id text,
  vault_goal_id text,
  transaction_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists savings_goals_user_idx on public.savings_goals(user_id, created_at desc);
create index if not exists savings_goals_status_idx on public.savings_goals(status, created_at desc);
create index if not exists savings_goals_owner_status_idx on public.savings_goals(owner_address, status);

create table if not exists public.workspaces (
  id text primary key,
  name text not null check (char_length(name) <= 80),
  kind text not null check (kind in ('personal', 'business')),
  owner_id uuid not null references auth.users(id),
  client_mutation_id text not null,
  currency text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, client_mutation_id)
);
create unique index if not exists workspaces_one_personal_per_owner_uidx on public.workspaces(owner_id) where kind = 'personal';

create table if not exists public.workspace_members (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'finance', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(workspace_id, user_id)
);
create index if not exists workspace_members_user_status_idx on public.workspace_members(user_id, status);

create table if not exists public.workspace_transactions (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  client_mutation_id text not null,
  type text not null check (type in ('income', 'expense')),
  amount_minor bigint not null check (amount_minor > 0),
  description text not null check (char_length(description) <= 160),
  category text not null check (char_length(category) <= 80),
  merchant text not null default '' check (char_length(merchant) <= 120),
  date text not null,
  revision integer not null default 1 check (revision > 0),
  shared_with_mobile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, client_mutation_id)
);
create index if not exists workspace_transactions_scope_idx on public.workspace_transactions(workspace_id, date desc, id desc);
create index if not exists workspace_transactions_creator_idx on public.workspace_transactions(workspace_id, created_by, shared_with_mobile, id);

create table if not exists public.stellar_accounts (
  address text primary key,
  network text not null default 'testnet',
  signing_mode text not null default 'watch-only',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stellar_signing_requests (
  idempotency_key text primary key,
  kind text not null check (kind in ('classic', 'soroban')),
  action text not null,
  source text not null,
  unsigned_xdr text not null,
  status text not null check (status in ('prepared', 'submitted', 'pending', 'success', 'failed')),
  hash text,
  fee text,
  savings_goal_id text,
  goal_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stellar_signing_requests_source_idx on public.stellar_signing_requests(source);
create index if not exists stellar_signing_requests_status_idx on public.stellar_signing_requests(status);
create index if not exists stellar_signing_requests_hash_idx on public.stellar_signing_requests(hash);

create table if not exists public.stellar_contract_events (
  event_id text primary key,
  contract_id text not null,
  ledger bigint not null,
  transaction_hash text not null,
  ledger_closed_at text,
  topics jsonb not null default '[]'::jsonb,
  value jsonb,
  successful boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stellar_contract_events_contract_ledger_idx on public.stellar_contract_events(contract_id, ledger);
create index if not exists stellar_contract_events_transaction_idx on public.stellar_contract_events(transaction_hash);

create table if not exists public.mongo_migration_quarantine (
  source_collection text not null,
  source_id text not null,
  owner_reference text,
  reason text not null,
  document jsonb not null,
  archived_at timestamptz not null default now(),
  primary key(source_collection, source_id)
);

alter table public.user_profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_transactions enable row level security;
alter table public.stellar_accounts enable row level security;
alter table public.stellar_signing_requests enable row level security;
alter table public.stellar_contract_events enable row level security;
alter table public.mongo_migration_quarantine enable row level security;

revoke all on public.user_profiles, public.transactions, public.categories,
  public.budgets, public.savings_goals, public.workspaces,
  public.workspace_members, public.workspace_transactions,
  public.stellar_accounts, public.stellar_signing_requests,
  public.stellar_contract_events, public.mongo_migration_quarantine
from anon, authenticated;
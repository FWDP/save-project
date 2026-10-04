-- Additive cutover: retain workspace tables as a historical archive.
-- Run during cutover with legacy workspace writes stopped. Safe to run again.
begin;
lock table public.workspaces, public.workspace_members, public.workspace_transactions, public.transactions in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.workspace_transactions t join public.workspaces w on w.id=t.workspace_id where w.currency <> 'PHP') then
    raise exception 'Non-PHP records require an explicit currency migration; refusing to relabel amounts.';
  end if;
  if exists (select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.user_id<>w.owner_id and m.status='active')
    or exists (select 1 from public.workspace_transactions t join public.workspaces w on w.id=t.workspace_id where t.created_by<>w.owner_id) then
    raise exception 'Shared records require an explicit ownership migration.';
  end if;
  if exists (select 1 from public.workspace_transactions t join public.workspaces w on w.id=t.workspace_id join public.transactions a on a.id=t.id where not t.shared_with_mobile and (a.user_id is distinct from w.owner_id or a.type<>t.type or a.amount<>t.amount_minor::numeric/100 or a.date<>t.date or a.description<>t.description or a.category<>t.category)) then
    raise exception 'Conflicting transaction IDs; migration aborted.';
  end if;
end $$;
-- shared_with_mobile rows are already represented in account storage. Never resurrect
-- them: a subsequent account edit or deletion is authoritative.
insert into public.transactions (id,user_id,client_mutation_id,type,amount,category,description,date,revision,status,merchant,created_at,updated_at)
select t.id,w.owner_id,'legacy-workspace-' || t.workspace_id || '-' || t.id,t.type,t.amount_minor::numeric/100,t.category,t.description,t.date,t.revision,'pending',t.merchant,t.created_at,t.updated_at
from public.workspace_transactions t join public.workspaces w on w.id=t.workspace_id
where not t.shared_with_mobile
on conflict (id) do nothing;
do $$
begin
  if exists(select 1 from public.workspace_transactions t join public.workspaces w on w.id=t.workspace_id where not t.shared_with_mobile and not exists(select 1 from public.transactions a where a.id=t.id and a.user_id=w.owner_id)) then
    raise exception 'Account migration did not preserve every pending record.';
  end if;
end $$;
update public.workspace_transactions set shared_with_mobile=true where not shared_with_mobile;
commit;

create unique index if not exists user_profiles_email_lower_uidx
  on public.user_profiles (lower(email));

create or replace function public.prevent_workspace_currency_change()
returns trigger
language plpgsql
as $$
begin
  if new.currency is distinct from old.currency then
    raise exception 'Workspace currency is immutable.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_currency_immutable on public.workspaces;
create trigger workspaces_currency_immutable
before update on public.workspaces
for each row execute function public.prevent_workspace_currency_change();
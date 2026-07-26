-- Preserve immutable inventory history while allowing an operator to delete
-- their authentication account. PostgreSQL's FK action may anonymize only the
-- actor_user_id; every business field remains append-only.

alter table public.inventory_events
  drop constraint if exists inventory_events_actor_user_id_fkey;

alter table public.inventory_events
  alter column actor_user_id drop not null;

alter table public.inventory_events
  add constraint inventory_events_actor_user_id_fkey
  foreign key (actor_user_id)
  references auth.users(id)
  on delete set null;

create or replace function private.reject_inventory_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.actor_user_id is not null
    and new.actor_user_id is null
    and not exists (
      select 1
      from auth.users auth_user
      where auth_user.id = old.actor_user_id
    )
    and (
      pg_catalog.to_jsonb(new) - 'actor_user_id'
    ) is not distinct from (
      pg_catalog.to_jsonb(old) - 'actor_user_id'
    )
  then
    return new;
  end if;

  raise exception 'Inventory events are append-only' using errcode = '55000';
end;
$$;

comment on column public.inventory_events.actor_user_id is
  'Authoritative event actor. Set to null only by the auth.users FK during account deletion; direct event mutation remains blocked.';

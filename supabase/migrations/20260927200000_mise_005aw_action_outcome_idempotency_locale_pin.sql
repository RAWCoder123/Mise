-- MISE-005AW: pin public.mise_actions.idempotency_key and
-- public.action_outcomes.idempotency_key shape CHECKs to COLLATE "C".
--
-- Both tables still store idempotency_key under length-only bounds from the
-- operational-backend foundation migration:
--   length(trim(idempotency_key)) between 1 and 240
-- Hosted writers mint durable ASCII tokens only:
--   mise_actions := format('send_supplier_order:%s', order_id)  -- UUID
--   action_outcomes := format('supplier_delivery_outcome:%s', delivery_id)
-- with demo/parity mints using the same ASCII vocabulary
-- (`{restaurantId}:send_supplier_order:{orderId}`, fixture
-- `read-only-fixture`, `send_supplier_order:<uuid>`). Length-only CHECKs
-- accept spaces, control bytes, and non-ASCII that the restored C-locale
-- path would treat differently under LC_CTYPE drift.
--
-- idempotency_key is the durable per-restaurant unique key for mise action
-- and action-outcome identity (UNIQUE (restaurant_id, idempotency_key) on
-- each table). Clients hold SELECT only; inserts come from server triggers /
-- SECURITY DEFINER delivery workflows. POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; later 005* tips pinned operational_issues
-- dedupe_key (#456), restaurant_tasks.client_task_id (#455), and
-- finding-decision identity (#454), but left these foundation action /
-- outcome idempotency keys on length-only bounds.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- an idempotency_key the restored C-locale ASCII gate would refuse (or the
-- reverse), breaking action / outcome identity across restore.
--
-- Scope:
--   - Replace length-only mise_actions.idempotency_key CHECK with named
--     shape CHECK:
--     idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
--   - Replace length-only action_outcomes.idempotency_key CHECK with named
--     shape CHECK:
--     idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
-- Does NOT rewrite supplier-order / delivery writers, activity_events
-- idempotency_key (ISO / label mints), restaurant_memories.dedupe_key
-- (supplier-name legacy), inventory_events identity (#375), or
-- operational_issues.dedupe_key (#456).
-- Timestamp after MISE-005AV (#456).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.mise_actions'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'mise_actions_idempotency_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%idempotency_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(idempotency_key))%'
            or pg_get_constraintdef(con.oid) ilike '%length(idempotency_key)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_-]{1,240}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.mise_actions drop constraint %I',
      constraint_name
    );
  end loop;

  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.action_outcomes'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'action_outcomes_idempotency_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%idempotency_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(idempotency_key))%'
            or pg_get_constraintdef(con.oid) ilike '%length(idempotency_key)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_-]{1,240}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.action_outcomes drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.mise_actions
  drop constraint if exists mise_actions_idempotency_key_check;

alter table public.action_outcomes
  drop constraint if exists action_outcomes_idempotency_key_check;

alter table public.mise_actions
  add constraint mise_actions_idempotency_key_check check (
    idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  );

alter table public.action_outcomes
  add constraint action_outcomes_idempotency_key_check check (
    idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  );

comment on constraint mise_actions_idempotency_key_check
  on public.mise_actions is
  'MISE-005AW: ASCII mise_actions.idempotency_key under COLLATE "C".';

comment on constraint action_outcomes_idempotency_key_check
  on public.action_outcomes is
  'MISE-005AW: ASCII action_outcomes.idempotency_key under COLLATE "C".';

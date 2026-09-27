-- MISE-005AV: pin public.operational_issues.dedupe_key shape CHECK to
-- COLLATE "C".
--
-- public.operational_issues still stores dedupe_key under a length-only
-- bound from the operational-backend foundation migration:
--   length(trim(dedupe_key)) between 1 and 240
-- Writers mint durable ASCII tokens only:
--   format('inventory-risk:%s', inventory_item_id)  -- UUID
-- with pgTAP fixtures using the same vocabulary
-- ('inventory-risk:d0000000-0000-4000-8000-000000000011').
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- dedupe_key is the durable per-restaurant unique key for operational issue
-- identity (UNIQUE (restaurant_id, dedupe_key)). POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; later 005* tips pinned restaurant
-- task client_task_id (#455) and finding-decision identity (#454), but left
-- foundation ops issue dedupe keys on length-only bounds.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a dedupe_key the restored C-locale ASCII gate would refuse (or the
-- reverse), breaking operational-issue identity across restore.
--
-- Scope:
--   - Replace length-only dedupe_key CHECK with named shape CHECK:
--     dedupe_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
-- Does NOT rewrite the purchase_recommendations sync trigger that mints
-- inventory-risk keys, restaurant_memories.dedupe_key (supplier-name legacy
-- keys), activity_events.idempotency_key (ISO / label mints), inventory_events
-- identity (#375), or restaurant_tasks.client_task_id (#455).
-- Timestamp after MISE-005AU (#455).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.operational_issues'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'operational_issues_dedupe_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%dedupe_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(dedupe_key))%'
            or pg_get_constraintdef(con.oid) ilike '%length(dedupe_key)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_-]{1,240}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.operational_issues drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.operational_issues
  drop constraint if exists operational_issues_dedupe_key_check;

alter table public.operational_issues
  add constraint operational_issues_dedupe_key_check check (
    dedupe_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  );

comment on constraint operational_issues_dedupe_key_check
  on public.operational_issues is
  'MISE-005AV: ASCII operational-issue dedupe_key under COLLATE "C".';

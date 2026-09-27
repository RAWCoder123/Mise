-- MISE-005AU: pin public.restaurant_tasks.client_task_id shape CHECK to
-- COLLATE "C".
--
-- public.restaurant_tasks still stores client_task_id under a length-only
-- bound from the shared restaurant tasks migration:
--   length(trim(client_task_id)) between 1 and 200
-- Writers mint durable ASCII tokens:
--   UI create-task := 'restaurant-task:' || epoch_ms || ':' || base36
--   fixtures := 'task-count-chicken' / 'demo-shared-count' / 'client-task-1'
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- client_task_id is the durable per-restaurant unique key for shared
-- restaurant task idempotency (UNIQUE (restaurant_id, client_task_id)).
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips pinned finding-decision identity (#454) and recalculation keys
-- (#452/#453), but left restaurant task client identity on length-only
-- bounds.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a client_task_id the restored C-locale ASCII gate would refuse (or the
-- reverse), breaking task idempotency identity across restore.
--
-- Scope:
--   - Replace length-only client_task_id CHECK with named shape CHECK:
--     client_task_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'
-- Does NOT rewrite public.create_restaurant_task (trim/length validation
-- stays; mint stays application-owned via app/more/create-task.tsx),
-- finding-decision identity (#454), inventory_events identity (#375), or
-- recalculation job_name (#453).
-- Timestamp after MISE-005AT (#454).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.restaurant_tasks'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'restaurant_tasks_client_task_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%client_task_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(client_task_id))%'
            or pg_get_constraintdef(con.oid) ilike '%length(client_task_id)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_-]{1,200}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.restaurant_tasks drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_client_task_id_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_client_task_id_check check (
    client_task_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'
  );

comment on constraint restaurant_tasks_client_task_id_check
  on public.restaurant_tasks is
  'MISE-005AU: ASCII restaurant-task client_task_id under COLLATE "C".';

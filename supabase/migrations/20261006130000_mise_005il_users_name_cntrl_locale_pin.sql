-- MISE-005IL: pin public.users.name CHECK to reject control characters
-- under COLLATE "C".
--
-- public.users.name was declared as NOT NULL text with no length or cntrl
-- gate (secure multi-tenant foundation 202606210001). The sole write path
-- public.update_my_profile already rejects null/empty and enforces
-- length(btrim(p_name)) between 1 and 120, but the table itself stayed
-- unbound. Sibling tips already pinned:
--   - restaurants.name length + COLLATE C cntrl (#548 / MISE-005EJ)
--   - users.preferred_locale allowlist (#463 / MISE-005CB)
--   - membership role/status (#489 / MISE-005CC)
-- but left the operator display name column without a durable CHECK.
--
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; later
-- 005* tips re-pin single-line display text with COLLATE "C".
--
-- users.name is the durable operator display name shown in team directory,
-- activity attribution, and settings. If LC_CTYPE drifted under a missing
-- cntrl gate, dump/restore could accept name bytes the restored C-locale
-- profile writer path would refuse — or the reverse — breaking operator
-- identity continuity across restore.
--
-- Scope:
--   - Attach users_name_check as length(btrim(name)) between 1 and 120
--     PLUS ASCII control rejection under COLLATE "C"
-- Does NOT rewrite update_my_profile, preferred_locale (#463), membership
-- role/status (#489), or users.email (auth-synced).
-- Timestamp after MISE-005IK (#653).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.users'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'users_name_check'
        or con.conname = 'users_name_length_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%name%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%name%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%preferred_locale%'
          and pg_get_constraintdef(con.oid) not ilike '%email%'
          and pg_get_constraintdef(con.oid) not ilike '%role%'
          and con.conname is distinct from 'users_preferred_locale_allowlist_check'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.users drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.users
  drop constraint if exists users_name_check;

alter table public.users
  drop constraint if exists users_name_length_check;

alter table public.users
  add constraint users_name_check check (
    pg_catalog.length(pg_catalog.btrim(name)) between 1 and 120
    and name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint users_name_check on public.users is
  'MISE-005IL: operator display name length 1..120 after trim plus ASCII control rejection under COLLATE "C".';

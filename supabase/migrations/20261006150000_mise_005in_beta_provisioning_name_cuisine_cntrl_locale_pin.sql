-- MISE-005IN: pin private.beta_restaurant_provisioning_requests
-- normalized_restaurant_name and normalized_cuisine_type CHECKs to reject
-- control characters under COLLATE "C".
--
-- private.beta_restaurant_provisioning_requests was declared with unbound
-- text columns (invite-only beta admission 20260728210609):
--   normalized_restaurant_name text not null
--   normalized_cuisine_type text
-- The sole writer private.service_provision_beta_restaurant already
-- btrims inputs and enforces name length 1..120 and cuisine length <= 120,
-- but the durable idempotency ledger itself stayed without a table CHECK.
-- Sibling tips already pinned the public restaurants profile mirrors:
--   - restaurants.name length + COLLATE C cntrl (#548 / MISE-005EJ)
--   - restaurants.cuisine_type length + COLLATE C cntrl (#549 / MISE-005EK)
-- but left the private provisioning ledger columns unbound at the table.
--
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips re-pin single-line profile text with COLLATE "C".
--
-- These columns are the durable service-only provisioning idempotency
-- fingerprint beside owner_user_id. If LC_CTYPE drifted under a missing
-- cntrl gate, dump/restore could accept provisioning ledger bytes the
-- restored C-locale restaurants.name / cuisine_type gates (#548/#549)
-- would refuse — or the reverse — breaking invite-only provisioning
-- replay continuity across restore.
--
-- Scope:
--   - Attach normalized_restaurant_name CHECK as length 1..120 plus ASCII
--     control rejection under COLLATE "C"
--   - Attach normalized_cuisine_type CHECK as null or length <= 120 plus
--     ASCII control rejection under COLLATE "C" (matches #549 bounds)
-- Does NOT rewrite private.service_provision_beta_restaurant, public
-- restaurants name/cuisine tips (#548/#549), or workspace quota logic.
-- Timestamp after MISE-005IM (#655).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.beta_restaurant_provisioning_requests'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'beta_restaurant_provisioning_requests_name_check'
        or con.conname = 'beta_restaurant_provisioning_requests_cuisine_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%normalized_restaurant_name%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%normalized_restaurant_name%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%normalized_cuisine_type%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%normalized_cuisine_type%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.beta_restaurant_provisioning_requests drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.beta_restaurant_provisioning_requests
  drop constraint if exists beta_restaurant_provisioning_requests_name_check;

alter table private.beta_restaurant_provisioning_requests
  drop constraint if exists beta_restaurant_provisioning_requests_cuisine_check;

alter table private.beta_restaurant_provisioning_requests
  add constraint beta_restaurant_provisioning_requests_name_check check (
    pg_catalog.length(normalized_restaurant_name) between 1 and 120
    and normalized_restaurant_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint beta_restaurant_provisioning_requests_name_check
  on private.beta_restaurant_provisioning_requests is
  'MISE-005IN: provisioning normalized_restaurant_name length 1..120 plus ASCII control rejection under COLLATE "C".';

alter table private.beta_restaurant_provisioning_requests
  add constraint beta_restaurant_provisioning_requests_cuisine_check check (
    normalized_cuisine_type is null
    or (
      pg_catalog.length(normalized_cuisine_type) <= 120
      and normalized_cuisine_type collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint beta_restaurant_provisioning_requests_cuisine_check
  on private.beta_restaurant_provisioning_requests is
  'MISE-005IN: provisioning normalized_cuisine_type null or length <= 120 plus ASCII control rejection under COLLATE "C".';

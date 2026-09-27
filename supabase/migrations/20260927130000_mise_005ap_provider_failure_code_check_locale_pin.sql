-- MISE-005AP: pin Gmail/Square OAuth failure_code and supplier-email
-- delivery last_error_code CHECKs to COLLATE "C".
--
-- On main these durable columns only have length bounds:
--   failure_code / last_error_code is null
--   or length(...) between 1 and 80
-- Writers already route through private.gmail_safe_error_code, which gates:
--   p_error_code !~ '^[a-z0-9_]{1,80}$'
-- MISE-005AE (#439) pins that helper under COLLATE "C", and MISE-005AO
-- (#449) attached the sibling public.mise_actions.error_code table CHECK —
-- but left these provider OAuth / delivery failure columns on length-only
-- CHECKs that accept uppercase, hyphens, spaces, and other non-snake tokens
-- the restored C-locale writer would refuse.
--
-- failure_code and last_error_code are durable provider failure evidence
-- (OAuth flow terminal failure; supplier-send attempt outcome). Accepted
-- values are ASCII snake_case tokens compared for exact-retry continuity
-- and restored across dump/restore. POSIX [a-z0-9_] follows database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster. Under length-only CHECKs, dump/restore can accept
-- an error token the restored C-locale gmail_safe_error_code gate would
-- refuse (or the reverse), breaking failure-evidence continuity for Gmail
-- and Square OAuth flows and supplier email deliveries.
--
-- Scope:
--   - Replace length-only CHECKs with named nullable-or-shape CHECKs:
--     col is null or col collate "C" ~ '^[a-z0-9_]{1,80}$'
--     on private.gmail_oauth_flows.failure_code,
--        private.square_oauth_flows.failure_code,
--        private.supplier_email_deliveries.last_error_code
-- Does NOT rewrite private.gmail_safe_error_code (open #439), OAuth
-- state_hash pins (#438), provider_message_id CHECKs (#444/#445), delivery
-- fingerprint CHECKs (#447), or mise_actions.error_code (#449).
-- Timestamp after MISE-005AO (#449).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.gmail_oauth_flows'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'gmail_oauth_flows_failure_code_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%failure_code%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(failure_code)%'
            or pg_get_constraintdef(con.oid) ilike '%^[a-z0-9_]{1,80}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.gmail_oauth_flows drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.gmail_oauth_flows
  drop constraint if exists gmail_oauth_flows_failure_code_check;

alter table private.gmail_oauth_flows
  add constraint gmail_oauth_flows_failure_code_check check (
    failure_code is null
    or failure_code collate "C" ~ '^[a-z0-9_]{1,80}$'
  );

comment on constraint gmail_oauth_flows_failure_code_check
  on private.gmail_oauth_flows is
  'MISE-005AP: nullable Gmail OAuth failure_code ASCII snake_case under COLLATE "C".';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.square_oauth_flows'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'square_oauth_flows_failure_code_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%failure_code%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(failure_code)%'
            or pg_get_constraintdef(con.oid) ilike '%^[a-z0-9_]{1,80}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.square_oauth_flows drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.square_oauth_flows
  drop constraint if exists square_oauth_flows_failure_code_check;

alter table private.square_oauth_flows
  add constraint square_oauth_flows_failure_code_check check (
    failure_code is null
    or failure_code collate "C" ~ '^[a-z0-9_]{1,80}$'
  );

comment on constraint square_oauth_flows_failure_code_check
  on private.square_oauth_flows is
  'MISE-005AP: nullable Square OAuth failure_code ASCII snake_case under COLLATE "C".';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.supplier_email_deliveries'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_email_deliveries_last_error_code_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%last_error_code%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(last_error_code)%'
            or pg_get_constraintdef(con.oid) ilike '%^[a-z0-9_]{1,80}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.supplier_email_deliveries drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_last_error_code_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_last_error_code_check check (
    last_error_code is null
    or last_error_code collate "C" ~ '^[a-z0-9_]{1,80}$'
  );

comment on constraint supplier_email_deliveries_last_error_code_check
  on private.supplier_email_deliveries is
  'MISE-005AP: nullable supplier-email last_error_code ASCII snake_case under COLLATE "C".';

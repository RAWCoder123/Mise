-- MISE-005IH: pin private.gmail_oauth_flows.failure_code CHECK to
-- reject control characters under COLLATE "C".
--
-- private.gmail_oauth_flows.failure_code was declared as nullable
-- text with a length-only CHECK:
--   failure_code is null or length(failure_code) between 1 and 80
-- and no control-character gate. Writers already normalize via
-- private.gmail_safe_error_code (^[a-z0-9_]{1,80}$) or assign fixed ASCII
-- tokens such as superseded. There was still no table-level cntrl rejection
-- under COLLATE "C".
--
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- failure_code is the durable single-line OAuth/outcome failure label on
-- the private Gmail OAuth flow ledger. It is not operator free-form
-- multiline prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted
-- under a bare (or missing) cntrl gate, dump/restore could accept
-- failure_code bytes a restored C-locale path would refuse — or the
-- reverse — breaking Gmail OAuth failure-evidence continuity across restore.
--
-- Scope:
--   - Reattach gmail_oauth_flows_failure_code_check as null OR
--     length(failure_code) 1..80 PLUS ASCII control rejection under
--     COLLATE "C" (preserves foundation length window)
-- Does NOT rewrite gmail_safe_error_code, OAuth claim/complete/fail RPCs,
-- state_hash (#438), square_oauth_flows.failure_code (#450 allowlist tip),
-- or supplier_email_deliveries.last_error_code (#649). Does NOT expand to
-- the writer charset allowlist ^[a-z0-9_]{1,80}$; this tip is cntrl-only
-- to match activity / last_error_code siblings.
-- Timestamp after MISE-005IG (#649).

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
            pg_get_constraintdef(con.oid) ilike '%length%failure_code%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%state_hash%'
          and pg_get_constraintdef(con.oid) not ilike '%expires_at%'
          and pg_get_constraintdef(con.oid) not ilike '%completed_at%'
          and pg_get_constraintdef(con.oid) not ilike '%failed_at%'
          and pg_get_constraintdef(con.oid) not ilike '%callback_reservation%'
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
    or (
      length(failure_code) between 1 and 80
      and failure_code collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint gmail_oauth_flows_failure_code_check
  on private.gmail_oauth_flows is
  'MISE-005IH: optional failure_code length 1–80 with ASCII C [[:cntrl:]] rejection (COLLATE "C").';

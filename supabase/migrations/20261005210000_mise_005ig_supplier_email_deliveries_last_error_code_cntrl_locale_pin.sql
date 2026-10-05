-- MISE-005IG: pin private.supplier_email_deliveries.last_error_code CHECK to
-- reject control characters under COLLATE "C".
--
-- private.supplier_email_deliveries.last_error_code was declared as nullable
-- text with a length-only CHECK:
--   last_error_code is null or length(last_error_code) between 1 and 80
-- and no control-character gate. Writers already normalize via
-- private.gmail_safe_error_code (^[a-z0-9_]{1,80}$) or assign fixed ASCII
-- tokens such as stale_send_claim / legacy_unproven_claim. There was still no
-- table-level cntrl rejection under COLLATE "C".
--
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- last_error_code is the durable single-line provider/outcome failure label on
-- the private Gmail supplier-send delivery ledger. It is not operator
-- free-form multiline prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- last_error_code bytes a restored C-locale path would refuse — or the
-- reverse — breaking supplier-send delivery continuity across restore.
--
-- Scope:
--   - Reattach supplier_email_deliveries_last_error_code_check as null OR
--     length(last_error_code) 1..80 PLUS ASCII control rejection under
--     COLLATE "C" (preserves foundation length window)
-- Does NOT rewrite gmail_safe_error_code, claim/complete send RPCs, status
-- (#533), provider_message_id (#444), rfc_message_id (#418),
-- sent_check, or mise_003c metadata. Does NOT expand to the writer charset
-- allowlist ^[a-z0-9_]{1,80}$; this tip is cntrl-only to match activity /
-- provider_message_id siblings.
-- Timestamp after MISE-005IF (#648).

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
            pg_get_constraintdef(con.oid) ilike '%length%last_error_code%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_message_id%'
          and pg_get_constraintdef(con.oid) not ilike '%rfc_message_id%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_accepted_at%'
          and pg_get_constraintdef(con.oid) not ilike '%content_version%'
          and pg_get_constraintdef(con.oid) not ilike '%attempt_count%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%claim_token%'
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
    or (
      length(last_error_code) between 1 and 80
      and last_error_code collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint supplier_email_deliveries_last_error_code_check
  on private.supplier_email_deliveries is
  'MISE-005IG: optional last_error_code length 1–80 with ASCII C [[:cntrl:]] rejection (COLLATE "C").';

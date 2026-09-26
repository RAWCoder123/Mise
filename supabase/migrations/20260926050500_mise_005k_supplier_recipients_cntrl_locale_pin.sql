-- MISE-005K: pin supplier_recipients name/email cntrl CHECKs to COLLATE "C".
--
-- public.supplier_recipients still rejects control characters with bare
-- POSIX [[:cntrl:]], which follows database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A already proved locale drift on this cluster
-- for lower() / [[:alnum:]]; MISE-005B through MISE-005J re-pinned sibling
-- text identity columns with `collate "C" !~ '[[:cntrl:]]'`.
--
-- supplier_name and email are the durable supplier-send To identity and the
-- presentation snapshot used by recipient directory + send envelope approval.
-- If a glibc/ICU change reclassified a stored byte under bare [[:cntrl:]],
-- pg_dump/restore would reject recipient rows the source accepted — breaking
-- send readiness and To-address continuity.
--
-- Scope:
--   - Reattach supplier_recipients_name_bounds_check with COLLATE "C"
--   - Reattach supplier_recipients_email_format_check with COLLATE "C"
-- Does NOT rewrite upsert_supplier_recipient / setup save RPCs (compose with
-- open supplier-send and durable-identity stacks). Restore authority is the
-- CHECK. Client validation already uses ASCII Cc (U+0000–U+001F, U+007F).

alter table public.supplier_recipients
  drop constraint if exists supplier_recipients_name_bounds_check;

alter table public.supplier_recipients
  drop constraint if exists supplier_recipients_email_format_check;

alter table public.supplier_recipients
  add constraint supplier_recipients_name_bounds_check check (
    pg_catalog.length(pg_catalog.btrim(supplier_name)) between 1 and 160
    and supplier_name = pg_catalog.btrim(supplier_name)
    and supplier_name collate "C" !~ '[[:cntrl:]]'
  );

alter table public.supplier_recipients
  add constraint supplier_recipients_email_format_check check (
    email is null or (
      pg_catalog.length(email) between 3 and 254
      and email = pg_catalog.btrim(email)
      and email collate "C" !~ '[[:cntrl:]]'
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

comment on constraint supplier_recipients_name_bounds_check
  on public.supplier_recipients is
  'MISE-005K: supplier_name trimmed length 1–160 and ASCII C [[:cntrl:]] rejection (COLLATE "C").';

comment on constraint supplier_recipients_email_format_check
  on public.supplier_recipients is
  'MISE-005K: optional email length 3–254, trimmed, ASCII C [[:cntrl:]] rejection, basic address shape (COLLATE "C").';

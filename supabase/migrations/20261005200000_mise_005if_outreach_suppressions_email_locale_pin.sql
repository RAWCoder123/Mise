-- MISE-005IF: pin public.outreach_suppressions.email shape CHECK to COLLATE "C".
--
-- public.outreach_suppressions.email was declared as `email text not null` with
-- no shape CHECK. Writers copy the lead mailbox from outreach_leads (unsubscribe
-- RPC and outreach-webhook suppressLead). MISE-005L re-pinned
-- outreach_leads.email shape and both tables' email_normalized generated keys
-- under COLLATE "C", but intentionally left suppressions.email unbound.
-- MISE-005M pinned campaign From/Reply-To the same way and also left
-- suppressions untouched.
--
-- This address is the durable marketing-suppression mailbox. Bare storage with
-- no shape gate means dump/restore cannot refuse control/whitespace bytes that
-- sibling lead/campaign email CHECKs would reject under COLLATE "C" — a restore
-- hazard on the shared production database path even though outreach tables are
-- service-only.
--
-- Scope:
--   - Attach outreach_suppressions_email_check with
--     email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
--     (case-sensitive ~, matching MISE-005L / MISE-005M)
-- Does NOT recreate email_normalized (#420), reason/source vocabulary (#527),
-- leads email (#420), or campaign sender/reply (#421). CHECK-only; no writer
-- rewrite.
-- Timestamp after MISE-005IE (#647).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.outreach_suppressions'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'outreach_suppressions_email_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%email%'
          and (
            pg_get_constraintdef(con.oid) ilike '%[[:space:]]%'
            or pg_get_constraintdef(con.oid) ilike '%@%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%email_normalized%'
          and pg_get_constraintdef(con.oid) not ilike '%reason%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
          and con.conname is distinct from 'outreach_suppressions_reason_check'
          and con.conname is distinct from 'outreach_suppressions_source_check'
          and con.conname is distinct from 'outreach_suppressions_email_normalized_key'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.outreach_suppressions drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.outreach_suppressions
  drop constraint if exists outreach_suppressions_email_check;

alter table public.outreach_suppressions
  add constraint outreach_suppressions_email_check check (
    email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

comment on constraint outreach_suppressions_email_check
  on public.outreach_suppressions is
  'MISE-005IF: basic suppression mailbox shape with ASCII C [[:space:]] rejection (COLLATE "C").';

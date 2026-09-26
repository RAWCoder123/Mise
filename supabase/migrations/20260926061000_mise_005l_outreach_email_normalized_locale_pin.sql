-- MISE-005L: pin outreach email_normalized unique keys to COLLATE "C".
--
-- public.outreach_leads and public.outreach_suppressions store
--   email_normalized text generated always as (lower(btrim(email))) stored
-- with UNIQUE(email_normalized). lower() follows database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved lower() differs between
-- en_US.UTF-8 and C for accented uppercase input; MISE-005B–005K re-pinned
-- restaurant-tenant discovery keys and cntrl CHECKs the same way.
--
-- These generated unique keys are a restore hazard: a glibc/ICU/ctype change
-- that moved recomputed keys would make pg_dump/restore abort on lead or
-- suppression rows the source accepted — breaking outreach dedupe and
-- unsubscribe continuity. Outreach tables are non-tenant service-only, but
-- they share the production database restore path.
--
-- Email identity must stay ASCII-case folding only. Do NOT accent-fold:
-- folding Café@x → cafe@x would change the mailbox. COLLATE "C" lower folds
-- A-Z only, which matches the intended email discovery key and the domain
-- helper normalizeOutreachEmail.
--
-- Scope:
--   - Recreate generated email_normalized with lower(btrim(email) COLLATE "C")
--   - Reattach outreach_leads email shape CHECK with COLLATE "C" on [[:space:]]
-- Does NOT rewrite outreach Edge function bodies beyond the shared domain
-- helper (compose with existing service-only auth gates).

do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  where con.conrelid = 'public.outreach_leads'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%[[:space:]]%'
    and pg_get_constraintdef(con.oid) ilike '%@%'
  order by con.conname
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.outreach_leads drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.outreach_leads
  drop column if exists email_normalized;

alter table public.outreach_leads
  add column email_normalized text generated always as (
    pg_catalog.lower(pg_catalog.btrim(email) collate "C") collate "C"
  ) stored;

alter table public.outreach_leads
  add constraint outreach_leads_email_normalized_key unique (email_normalized);

alter table public.outreach_leads
  add constraint outreach_leads_email_check check (
    email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

comment on column public.outreach_leads.email_normalized is
  'MISE-005L: locale-stable outreach lead email key. lower(btrim(email) COLLATE "C") only — never accent-fold.';

comment on constraint outreach_leads_email_check on public.outreach_leads is
  'MISE-005L: basic address shape with ASCII C [[:space:]] rejection (COLLATE "C").';

alter table public.outreach_suppressions
  drop column if exists email_normalized;

alter table public.outreach_suppressions
  add column email_normalized text generated always as (
    pg_catalog.lower(pg_catalog.btrim(email) collate "C") collate "C"
  ) stored;

alter table public.outreach_suppressions
  add constraint outreach_suppressions_email_normalized_key unique (email_normalized);

comment on column public.outreach_suppressions.email_normalized is
  'MISE-005L: locale-stable outreach suppression email key. lower(btrim(email) COLLATE "C") only — never accent-fold.';

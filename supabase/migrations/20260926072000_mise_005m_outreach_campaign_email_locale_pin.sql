-- MISE-005M: pin outreach_campaigns sender/reply email shape CHECKs to COLLATE "C".
--
-- public.outreach_campaigns still validates sender_email and reply_to with
--   ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
-- POSIX [[:space:]] follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster for lower() /
-- [[:alnum:]]; MISE-005L re-pinned sibling outreach lead email shape with
-- `email collate "C" ~ ...[[:space:]]...`. Campaign From/Reply-To were left
-- on the original bare ~* shape.
--
-- These addresses are the durable commercial From and Reply-To on every
-- approved outreach campaign. If a glibc/ICU change reclassified a stored
-- byte under bare [[:space:]], pg_dump/restore would reject campaign rows
-- the source accepted — breaking send continuity for already-approved
-- campaigns. Outreach tables are non-tenant service-only, but they share
-- the production database restore path.
--
-- Scope:
--   - Reattach outreach_campaigns sender_email and reply_to CHECKs with
--     COLLATE "C" on [[:space:]] (case-sensitive ~, matching MISE-005L)
-- Does NOT touch lead/suppression tables (owned by MISE-005L) and does NOT
-- rewrite Edge function bodies beyond shared domain shape parity.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.outreach_campaigns'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%[[:space:]]%'
      and pg_get_constraintdef(con.oid) ilike '%@%'
      and (
        pg_get_constraintdef(con.oid) ilike '%sender_email%'
        or pg_get_constraintdef(con.oid) ilike '%reply_to%'
        or con.conname ilike '%sender_email%'
        or con.conname ilike '%reply_to%'
      )
    order by con.conname
  loop
    execute format(
      'alter table public.outreach_campaigns drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.outreach_campaigns
  drop constraint if exists outreach_campaigns_sender_email_check;

alter table public.outreach_campaigns
  drop constraint if exists outreach_campaigns_reply_to_check;

alter table public.outreach_campaigns
  add constraint outreach_campaigns_sender_email_check check (
    sender_email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

alter table public.outreach_campaigns
  add constraint outreach_campaigns_reply_to_check check (
    reply_to collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

comment on constraint outreach_campaigns_sender_email_check
  on public.outreach_campaigns is
  'MISE-005M: basic From address shape with ASCII C [[:space:]] rejection (COLLATE "C").';

comment on constraint outreach_campaigns_reply_to_check
  on public.outreach_campaigns is
  'MISE-005M: basic Reply-To address shape with ASCII C [[:space:]] rejection (COLLATE "C").';

-- MISE-005HO: pin public.outreach_leads.business_name CHECK to reject
-- control characters under COLLATE "C".
--
-- outreach_leads.business_name was declared as
--   business_name text not null
--     check (char_length(btrim(business_name)) between 1 and 160)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- business_name is a durable single-line restaurant/lead business title on
-- service-only Mise sales outreach leads. It is not operator free-form
-- multiline prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under
-- a bare (or missing) cntrl gate, dump/restore could accept business-name
-- bytes a restored C-locale path would refuse — or the reverse — breaking
-- lead business-title continuity across restore.
--
-- Scope:
--   - Reattach outreach_leads_business_name_check preserving the exact
--     char_length(btrim(business_name)) 1..160 bound PLUS ASCII control
--     rejection under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus status/contact_basis
--     (#530), email_normalized uniqueness (#420), email / source_url /
--     website URL CHECKs, and untipped optional lead text columns
--     (contact_name, city, state, cuisine, fit_notes)
-- Does NOT rewrite outreach writers/Edge Functions, enrollment/message
-- vocabulary, campaign title/brand columns, or restaurant-tenant tables.
-- Timestamp after MISE-005HN (#630).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.outreach_leads'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'outreach_leads_business_name_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%business_name%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%business_name%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%business_name%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%contact_name%'
          and pg_get_constraintdef(con.oid) not ilike '%contact_basis%'
          and pg_get_constraintdef(con.oid) not ilike '%source_url%'
          and pg_get_constraintdef(con.oid) not ilike '%email_normalized%'
          and pg_get_constraintdef(con.oid) not ilike '%fit_notes%'
          and con.conname is distinct from 'outreach_leads_status_check'
          and con.conname is distinct from 'outreach_leads_contact_basis_check'
          and con.conname is distinct from 'outreach_leads_email_check'
          and con.conname is distinct from 'outreach_leads_source_url_check'
          and con.conname is distinct from 'outreach_lead_website_url'
          and con.conname is distinct from 'outreach_lead_approval_verified'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.outreach_leads drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.outreach_leads
  drop constraint if exists outreach_leads_business_name_check;

alter table public.outreach_leads
  add constraint outreach_leads_business_name_check check (
    char_length(btrim(business_name)) between 1 and 160
    and business_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint outreach_leads_business_name_check
  on public.outreach_leads is
  'MISE-005HO: outreach_leads business_name char_length(btrim) 1..160 plus ASCII control rejection under COLLATE "C".';

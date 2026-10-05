-- MISE-005ID: pin public.outreach_leads.cuisine CHECK to reject
-- control characters under COLLATE "C".
--
-- outreach_leads.cuisine was declared as unbounded nullable text with no
-- length or control-character gate. Current domain writers persist via
--   optionalText(input.cuisine, "cuisine", 120)
-- which trims and bounds to 1..120 when present. Bare POSIX [[:cntrl:]]
-- follows database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- cuisine is a durable single-line lead cuisine label on service-only Mise
-- sales outreach leads. It is not operator free-form multiline prose and
-- must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or
-- missing) cntrl gate, dump/restore could accept cuisine bytes a restored
-- C-locale path would refuse — or the reverse — breaking lead cuisine
-- continuity across restore.
--
-- Scope:
--   - Attach outreach_leads_cuisine_check as null OR
--     length(trim(cuisine)) 1..120 PLUS ASCII control rejection under
--     COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus business_name (#631),
--     contact_name (#643), fit_notes (#642), city (#644), state (#645),
--     status/contact_basis (#530), email_normalized uniqueness (#420),
--     email / source_url / website URL CHECKs
-- Does NOT rewrite outreach writers/Edge Functions, enrollment/message
-- vocabulary, campaign columns, or restaurant-tenant tables.
-- Timestamp after MISE-005IC (#645).

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
        con.conname = 'outreach_leads_cuisine_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%cuisine%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%cuisine%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%cuisine%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%business_name%'
          and pg_get_constraintdef(con.oid) not ilike '%contact_name%'
          and pg_get_constraintdef(con.oid) not ilike '%contact_basis%'
          and pg_get_constraintdef(con.oid) not ilike '%source_url%'
          and pg_get_constraintdef(con.oid) not ilike '%email_normalized%'
          and pg_get_constraintdef(con.oid) not ilike '%fit_notes%'
          and pg_get_constraintdef(con.oid) not ilike '%city%'
          and pg_get_constraintdef(con.oid) not ilike '%state%'
          and con.conname is distinct from 'outreach_leads_business_name_check'
          and con.conname is distinct from 'outreach_leads_contact_name_check'
          and con.conname is distinct from 'outreach_leads_fit_notes_check'
          and con.conname is distinct from 'outreach_leads_city_check'
          and con.conname is distinct from 'outreach_leads_state_check'
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
  drop constraint if exists outreach_leads_cuisine_check;

alter table public.outreach_leads
  add constraint outreach_leads_cuisine_check check (
    cuisine is null
    or (
      length(trim(cuisine)) between 1 and 120
      and cuisine collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint outreach_leads_cuisine_check
  on public.outreach_leads is
  'MISE-005ID: outreach_leads cuisine null or length(trim) 1..120 plus ASCII control rejection under COLLATE "C".';

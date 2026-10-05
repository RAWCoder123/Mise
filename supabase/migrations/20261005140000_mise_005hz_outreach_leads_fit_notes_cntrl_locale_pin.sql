-- MISE-005HZ: pin public.outreach_leads.fit_notes CHECK to reject
-- unsafe control characters under COLLATE "C", while allowing multiline
-- free-form fit notes.
--
-- outreach_leads.fit_notes was declared as unbounded nullable text with no
-- length or control-character gate. Current domain writers persist via
--   optionalText(input.fitNotes, "fitNotes", 500)
-- which trims, bounds to 1..500 when present, and rejects the same
-- multiline-aware ASCII control class as supplier-send operator_note
-- (allow LF/TAB/CR; reject other C0 controls and DEL). Bare POSIX
-- [[:cntrl:]] would also reject LF (and the established multiline
-- allowlist), so this tip uses the same byte class as
-- services/miseValidation.ts `unsafeSupplierSendMultilineControlPattern`
-- and the outreach domain requireText gate:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D)
--
-- fit_notes is durable free-form lead-fit rationale on service-only Mise
-- sales outreach leads (why this restaurant is a fit). When present it may
-- contain intentional newlines. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept fit_notes bytes a restored C-locale
-- path would refuse — or the reverse — breaking outreach lead continuity
-- across restore.
--
-- Scope:
--   - Attach outreach_leads_fit_notes_check as null OR
--     length(trim(fit_notes)) 1..500 PLUS multiline-aware ASCII
--     control rejection under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus business_name (#631),
--     status/contact_basis (#530), email_normalized uniqueness (#420),
--     email / source_url / website URL CHECKs, and untipped optional lead
--     text (contact_name, city, state, cuisine)
-- Does NOT rewrite outreach writers/Edge Functions, enrollment/message
-- vocabulary, campaign columns, or restaurant-tenant tables.
-- Timestamp after MISE-005HY (#641).

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
        con.conname = 'outreach_leads_fit_notes_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%fit_notes%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%fit_notes%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%fit_notes%'
            or pg_get_constraintdef(con.oid) ilike E'%\\x00-\\x08%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%business_name%'
          and pg_get_constraintdef(con.oid) not ilike '%contact_name%'
          and pg_get_constraintdef(con.oid) not ilike '%contact_basis%'
          and pg_get_constraintdef(con.oid) not ilike '%source_url%'
          and pg_get_constraintdef(con.oid) not ilike '%email_normalized%'
          and pg_get_constraintdef(con.oid) not ilike '%city%'
          and pg_get_constraintdef(con.oid) not ilike '%state%'
          and pg_get_constraintdef(con.oid) not ilike '%cuisine%'
          and con.conname is distinct from 'outreach_leads_business_name_check'
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
  drop constraint if exists outreach_leads_fit_notes_check;

alter table public.outreach_leads
  add constraint outreach_leads_fit_notes_check check (
    fit_notes is null
    or (
      length(trim(fit_notes)) between 1 and 500
      and fit_notes collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint outreach_leads_fit_notes_check
  on public.outreach_leads is
  'MISE-005HZ: outreach_leads fit_notes null or length(trim) 1..500 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';

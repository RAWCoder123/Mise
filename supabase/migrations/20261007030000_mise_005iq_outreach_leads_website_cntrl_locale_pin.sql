-- MISE-005IQ: pin public.outreach_leads.website protocol + length +
-- cntrl CHECK to COLLATE "C".
--
-- public.outreach_leads.website was declared nullable text with a
-- protocol-prefix-only CHECK and no length or control-character gate:
--   website is null or website ~* '^https?://'
-- (outreach agent 20260718010000). Sibling restaurant logo_url tip
-- MISE-005AC (#437) pins HTTPS host class under COLLATE "C"; campaign
-- cta_url tip MISE-005IP (#658) upgrades the same foundation protocol
-- CHECK to length 1..2048 + cntrl + https?:// under COLLATE "C". Open
-- MISE-005AI (#443) only re-pins the bare protocol under COLLATE "C"
-- without length/cntrl — this tip supersedes that website shape when
-- either lands first on main.
--
-- website is the durable optional single-line lead website URL on the
-- service-role outreach ledger (http or https prefix allowed by product).
-- Authenticated clients hold no DML; service_role writes lead rows.
-- POSIX character classes and case-insensitive regex follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster.
--
-- If LC_CTYPE drifted under a bare protocol prefix (or a missing
-- length/cntrl gate), dump/restore could accept website bytes a restored
-- C-locale sibling URL gate would refuse — or the reverse — breaking
-- outreach lead continuity across restore.
--
-- Scope:
--   - Reattach outreach_lead_website_url as null OR length 1..2048 plus
--     ASCII control rejection under COLLATE "C" plus the original
--     https?:// protocol prefix under COLLATE "C"
-- Does NOT rewrite outreach writers, enrollments, messages, suppressions,
-- campaign cta_url (#658), lead source_url, restaurant logo_url (#437),
-- or other outreach text tips (#628–#648). Does NOT tighten to HTTPS-only
-- host class.
-- Timestamp after MISE-005IP (#658).

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
        con.conname = 'outreach_lead_website_url'
        or (
          pg_get_constraintdef(con.oid) ilike '%website%'
          and (
            pg_get_constraintdef(con.oid) ilike '%https?://%'
            or pg_get_constraintdef(con.oid) ilike '%length%website%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%source_url%'
          and pg_get_constraintdef(con.oid) not ilike '%business_name%'
          and pg_get_constraintdef(con.oid) not ilike '%contact_name%'
          and pg_get_constraintdef(con.oid) not ilike '%contact_basis%'
          and pg_get_constraintdef(con.oid) not ilike '%email_normalized%'
          and pg_get_constraintdef(con.oid) not ilike '%fit_notes%'
          and pg_get_constraintdef(con.oid) not ilike '%cuisine%'
          and pg_get_constraintdef(con.oid) not ilike '%city%'
          and pg_get_constraintdef(con.oid) not ilike '%state%'
          and con.conname is distinct from 'outreach_leads_source_url_check'
          and con.conname is distinct from 'outreach_leads_business_name_check'
          and con.conname is distinct from 'outreach_leads_contact_name_check'
          and con.conname is distinct from 'outreach_leads_fit_notes_check'
          and con.conname is distinct from 'outreach_leads_cuisine_check'
          and con.conname is distinct from 'outreach_leads_city_check'
          and con.conname is distinct from 'outreach_leads_state_check'
          and con.conname is distinct from 'outreach_leads_status_check'
          and con.conname is distinct from 'outreach_leads_contact_basis_check'
          and con.conname is distinct from 'outreach_leads_email_check'
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
  drop constraint if exists outreach_lead_website_url;

alter table public.outreach_leads
  add constraint outreach_lead_website_url check (
    website is null
    or (
      pg_catalog.length(website) between 1 and 2048
      and website collate "C" !~ '[[:cntrl:]]'
      and website collate "C" ~* '^https?://'
    )
  );

comment on constraint outreach_lead_website_url
  on public.outreach_leads is
  'MISE-005IQ: optional website length 1–2048, ASCII C [[:cntrl:]] rejection, and https?:// protocol under COLLATE "C".';

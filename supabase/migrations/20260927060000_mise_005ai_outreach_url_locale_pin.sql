-- MISE-005AI: pin outreach HTTP(S) URL prefix CHECKs to COLLATE "C".
--
-- public.outreach_campaigns.cta_url and public.outreach_leads.source_url /
-- website still validate with bare
--   ~* '^https?://'
-- Case-insensitive regex matching follows database LC_CTYPE for case folding.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; MISE-005L/M pinned outreach email shapes with COLLATE "C" but
-- intentionally deferred the literal-prefix URL gates (no POSIX class, but
-- still ~* case folding).
--
-- These URLs are restore authority for commercial CTA destinations and lead
-- provenance. If LC_CTYPE drifted under bare ~*, dump/restore could reject
-- campaign or lead rows the source accepted — breaking send continuity and
-- contact-basis audit trails. Outreach tables are non-tenant service-only,
-- but they share the production database restore path.
--
-- Scope:
--   - Reattach outreach_campaign_cta_url, outreach_leads_source_url_check,
--     and outreach_lead_website_url with COLLATE "C" on ~* '^https?://'
-- Does NOT touch sender/reply email CHECKs (owned by open MISE-005M #421),
-- lead/suppression normalized-email keys (owned by open MISE-005L #420), or Edge
-- auth/service gates beyond shared domain prefix parity.
-- Timestamp after MISE-005AH (#442).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.outreach_campaigns'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'outreach_campaign_cta_url'
        or (
          pg_get_constraintdef(con.oid) ilike '%cta_url%'
          and pg_get_constraintdef(con.oid) ilike '%https?://%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.outreach_campaigns drop constraint %I',
      constraint_name
    );
  end loop;

  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.outreach_leads'::regclass
      and con.contype = 'c'
      and (
        con.conname in ('outreach_leads_source_url_check', 'outreach_lead_website_url')
        or (
          (
            pg_get_constraintdef(con.oid) ilike '%source_url%'
            or pg_get_constraintdef(con.oid) ilike '%website%'
          )
          and pg_get_constraintdef(con.oid) ilike '%https?://%'
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

alter table public.outreach_campaigns
  drop constraint if exists outreach_campaign_cta_url;

alter table public.outreach_leads
  drop constraint if exists outreach_leads_source_url_check;

alter table public.outreach_leads
  drop constraint if exists outreach_lead_website_url;

alter table public.outreach_campaigns
  add constraint outreach_campaign_cta_url check (
    cta_url is null or cta_url collate "C" ~* '^https?://'
  );

alter table public.outreach_leads
  add constraint outreach_leads_source_url_check check (
    source_url collate "C" ~* '^https?://'
  );

alter table public.outreach_leads
  add constraint outreach_lead_website_url check (
    website is null or website collate "C" ~* '^https?://'
  );

comment on constraint outreach_campaign_cta_url on public.outreach_campaigns is
  'MISE-005AI: optional CTA URL must start with http(s):// under COLLATE "C" ~*.';

comment on constraint outreach_leads_source_url_check on public.outreach_leads is
  'MISE-005AI: lead source URL must start with http(s):// under COLLATE "C" ~*.';

comment on constraint outreach_lead_website_url on public.outreach_leads is
  'MISE-005AI: optional website URL must start with http(s):// under COLLATE "C" ~*.';

-- MISE-005IP: pin public.outreach_campaigns.cta_url protocol + length +
-- cntrl CHECK to COLLATE "C".
--
-- public.outreach_campaigns.cta_url was declared nullable text with a
-- protocol-prefix-only CHECK and no length or control-character gate:
--   cta_url is null or cta_url ~* '^https?://'
-- (outreach agent 20260718010000). Sibling restaurant logo_url tip
-- MISE-005AC (#437) pins HTTPS host class under COLLATE "C"; outreach
-- lead website keeps its own foundation protocol CHECK for a later tip.
--
-- cta_url is the durable single-line campaign call-to-action URL on the
-- service-role outreach ledger (http or https prefix allowed by product).
-- Authenticated clients hold no DML; service_role writes campaign rows.
-- POSIX character classes and case-insensitive regex follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster.
--
-- If LC_CTYPE drifted under a bare protocol prefix (or a missing
-- length/cntrl gate), dump/restore could accept CTA URL bytes a restored
-- C-locale sibling URL gate would refuse — or the reverse — breaking
-- outreach campaign continuity across restore.
--
-- Scope:
--   - Reattach outreach_campaign_cta_url as null OR length 1..2048 plus
--     ASCII control rejection under COLLATE "C" plus the original
--     https?:// protocol prefix under COLLATE "C"
-- Does NOT rewrite outreach writers, enrollments, messages, suppressions,
-- lead website CHECK, restaurant logo_url (#437), or other outreach
-- text tips (#628–#648). Does NOT tighten to HTTPS-only host class.
-- Timestamp after MISE-005IO (#657).

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
          and (
            pg_get_constraintdef(con.oid) ilike '%https?://%'
            or pg_get_constraintdef(con.oid) ilike '%length%cta_url%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%send_window%'
          and pg_get_constraintdef(con.oid) not ilike '%weekdays%'
          and pg_get_constraintdef(con.oid) not ilike '%approved_at%'
          and pg_get_constraintdef(con.oid) not ilike '%company_name%'
          and pg_get_constraintdef(con.oid) not ilike '%sender_name%'
          and pg_get_constraintdef(con.oid) not ilike '%timezone%'
        )
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
  drop constraint if exists outreach_campaign_cta_url;

alter table public.outreach_campaigns
  add constraint outreach_campaign_cta_url check (
    cta_url is null
    or (
      pg_catalog.length(cta_url) between 1 and 2048
      and cta_url collate "C" !~ '[[:cntrl:]]'
      and cta_url collate "C" ~* '^https?://'
    )
  );

comment on constraint outreach_campaign_cta_url
  on public.outreach_campaigns is
  'MISE-005IP: optional cta_url length 1–2048, ASCII C [[:cntrl:]] rejection, and https?:// protocol under COLLATE "C".';

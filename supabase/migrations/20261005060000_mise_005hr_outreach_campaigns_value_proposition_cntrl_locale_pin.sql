-- MISE-005HR: pin public.outreach_campaigns.value_proposition CHECK to
-- reject unsafe control characters under COLLATE "C", while allowing
-- multiline value-proposition prose (LF/TAB/CR).
--
-- outreach_campaigns.value_proposition was declared as
--   value_proposition text not null
--     check (char_length(btrim(value_proposition)) between 1 and 800)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs under COLLATE "C".
--
-- value_proposition is free-form campaign messaging prose on service-only
-- Mise sales campaigns (what Mise offers the audience). Operators may write
-- multi-line value copy, so this tip uses the established multiline-aware
-- ASCII control class from supplier-send operator_note / order_message /
-- company_postal_address (#632) / audience_description (#633):
--   collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
-- allowing LF/TAB/CR while rejecting other C0 controls and DEL. If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- value-proposition bytes a restored C-locale path would refuse — or the
-- reverse — breaking campaign value-proposition continuity across restore.
--
-- Scope:
--   - Reattach outreach_campaigns_value_proposition_check preserving the
--     exact char_length(btrim(value_proposition)) 1..800 bound PLUS
--     multiline-aware ASCII control rejection under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus campaign name (#630),
--     company_name (#628), sender_name (#629), company_postal_address (#632),
--     audience_description (#633), sender_email/reply_to (#421), timezone (#463),
--     status (#529), and cta_url (#443)
-- Does NOT rewrite outreach writers/Edge Functions, lead business_name,
-- message personalization_note / subject / body fields, or restaurant-tenant
-- tables.
-- Timestamp after MISE-005HQ (#633).

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
        con.conname = 'outreach_campaigns_value_proposition_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%value_proposition%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%value_proposition%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%value_proposition%'
            or pg_get_constraintdef(con.oid) ilike E'%\\x00-\\x08%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%company_name%'
          and pg_get_constraintdef(con.oid) not ilike '%sender_name%'
          and pg_get_constraintdef(con.oid) not ilike '%company_postal_address%'
          and pg_get_constraintdef(con.oid) not ilike '%audience_description%'
          and pg_get_constraintdef(con.oid) not ilike '%sender_email%'
          and pg_get_constraintdef(con.oid) not ilike '%reply_to%'
          and pg_get_constraintdef(con.oid) not ilike '%timezone%'
          and pg_get_constraintdef(con.oid) not ilike '%cta_url%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and con.conname is distinct from 'outreach_campaigns_name_check'
          and con.conname is distinct from 'outreach_campaigns_company_name_check'
          and con.conname is distinct from 'outreach_campaigns_sender_name_check'
          and con.conname is distinct from 'outreach_campaigns_company_postal_address_check'
          and con.conname is distinct from 'outreach_campaigns_audience_description_check'
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
  drop constraint if exists outreach_campaigns_value_proposition_check;

alter table public.outreach_campaigns
  add constraint outreach_campaigns_value_proposition_check check (
    char_length(btrim(value_proposition)) between 1 and 800
    and value_proposition collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  );

comment on constraint outreach_campaigns_value_proposition_check
  on public.outreach_campaigns is
  'MISE-005HR: outreach_campaigns value_proposition char_length(btrim) 1..800 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';

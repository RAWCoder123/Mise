-- MISE-005HQ: pin public.outreach_campaigns.audience_description CHECK to
-- reject unsafe control characters under COLLATE "C", while allowing
-- multiline audience prose (LF/TAB/CR).
--
-- outreach_campaigns.audience_description was declared as
--   audience_description text not null
--     check (char_length(btrim(audience_description)) between 1 and 500)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs under COLLATE "C".
--
-- audience_description is free-form campaign targeting prose on service-only
-- Mise sales campaigns (who the campaign is for). Operators may write
-- multi-line targeting notes, so this tip uses the established multiline-aware
-- ASCII control class from supplier-send operator_note / order_message /
-- company_postal_address (#632):
--   collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
-- allowing LF/TAB/CR while rejecting other C0 controls and DEL. If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- audience bytes a restored C-locale path would refuse — or the reverse —
-- breaking campaign audience-description continuity across restore.
--
-- Scope:
--   - Reattach outreach_campaigns_audience_description_check preserving the
--     exact char_length(btrim(audience_description)) 1..500 bound PLUS
--     multiline-aware ASCII control rejection under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus campaign name (#630),
--     company_name (#628), sender_name (#629), company_postal_address (#632),
--     value_proposition, sender_email/reply_to (#421), timezone (#463),
--     status (#529), and cta_url (#443)
-- Does NOT rewrite outreach writers/Edge Functions, lead business_name,
-- message personalization_note / subject / body fields, or restaurant-tenant
-- tables.
-- Timestamp after MISE-005HP (#632).

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
        con.conname = 'outreach_campaigns_audience_description_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%audience_description%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%audience_description%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%audience_description%'
            or pg_get_constraintdef(con.oid) ilike E'%\\x00-\\x08%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%company_name%'
          and pg_get_constraintdef(con.oid) not ilike '%sender_name%'
          and pg_get_constraintdef(con.oid) not ilike '%company_postal_address%'
          and pg_get_constraintdef(con.oid) not ilike '%value_proposition%'
          and pg_get_constraintdef(con.oid) not ilike '%sender_email%'
          and pg_get_constraintdef(con.oid) not ilike '%reply_to%'
          and pg_get_constraintdef(con.oid) not ilike '%timezone%'
          and pg_get_constraintdef(con.oid) not ilike '%cta_url%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and con.conname is distinct from 'outreach_campaigns_name_check'
          and con.conname is distinct from 'outreach_campaigns_company_name_check'
          and con.conname is distinct from 'outreach_campaigns_sender_name_check'
          and con.conname is distinct from 'outreach_campaigns_company_postal_address_check'
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
  drop constraint if exists outreach_campaigns_audience_description_check;

alter table public.outreach_campaigns
  add constraint outreach_campaigns_audience_description_check check (
    char_length(btrim(audience_description)) between 1 and 500
    and audience_description collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  );

comment on constraint outreach_campaigns_audience_description_check
  on public.outreach_campaigns is
  'MISE-005HQ: outreach_campaigns audience_description char_length(btrim) 1..500 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';

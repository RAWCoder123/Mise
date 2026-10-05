-- MISE-005HP: pin public.outreach_campaigns.company_postal_address CHECK to
-- reject unsafe control characters under COLLATE "C", while allowing
-- multiline postal addresses (LF/TAB/CR).
--
-- outreach_campaigns.company_postal_address was declared as
--   company_postal_address text not null
--     check (char_length(btrim(company_postal_address)) between 8 and 500)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs under COLLATE "C".
--
-- company_postal_address is a durable CAN-SPAM postal address on service-only
-- Mise sales campaigns. Addresses are free-form multiline text (street / city
-- lines), so this tip uses the established multiline-aware ASCII control class
-- from supplier-send operator_note / order_message:
--   collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
-- allowing LF/TAB/CR while rejecting other C0 controls and DEL. If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- address bytes a restored C-locale path would refuse — or the reverse —
-- breaking campaign postal-address continuity across restore.
--
-- Scope:
--   - Reattach outreach_campaigns_company_postal_address_check preserving the
--     exact char_length(btrim(company_postal_address)) 8..500 bound PLUS
--     multiline-aware ASCII control rejection under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus campaign name,
--     company_name (#628), sender_name (#629), audience_description,
--     value_proposition, sender_email/reply_to (#421), timezone (#463),
--     status (#529), and cta_url (#443)
-- Does NOT rewrite outreach writers/Edge Functions, lead business_name,
-- message personalization_note / subject / body fields, or restaurant-tenant
-- tables.
-- Timestamp after MISE-005HO (#631).

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
        con.conname = 'outreach_campaigns_company_postal_address_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%company_postal_address%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%company_postal_address%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%company_postal_address%'
            or pg_get_constraintdef(con.oid) ilike E'%\\x00-\\x08%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%company_name%'
          and pg_get_constraintdef(con.oid) not ilike '%sender_name%'
          and pg_get_constraintdef(con.oid) not ilike '%audience_description%'
          and pg_get_constraintdef(con.oid) not ilike '%value_proposition%'
          and pg_get_constraintdef(con.oid) not ilike '%sender_email%'
          and pg_get_constraintdef(con.oid) not ilike '%reply_to%'
          and pg_get_constraintdef(con.oid) not ilike '%timezone%'
          and pg_get_constraintdef(con.oid) not ilike '%cta_url%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and con.conname is distinct from 'outreach_campaigns_name_check'
          and con.conname is distinct from 'outreach_campaigns_company_name_check'
          and con.conname is distinct from 'outreach_campaigns_sender_name_check'
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
  drop constraint if exists outreach_campaigns_company_postal_address_check;

alter table public.outreach_campaigns
  add constraint outreach_campaigns_company_postal_address_check check (
    char_length(btrim(company_postal_address)) between 8 and 500
    and company_postal_address collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  );

comment on constraint outreach_campaigns_company_postal_address_check
  on public.outreach_campaigns is
  'MISE-005HP: outreach_campaigns company_postal_address char_length(btrim) 8..500 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';

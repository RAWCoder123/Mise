-- MISE-005HM: pin public.outreach_campaigns.sender_name CHECK to reject
-- control characters under COLLATE "C".
--
-- outreach_campaigns.sender_name was declared as
--   sender_name text not null
--     check (char_length(btrim(sender_name)) between 1 and 120)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- sender_name is a durable single-line From-header display name on
-- service-only Mise sales campaigns. It is not operator free-form multiline
-- prose and must not accept LF/TAB/CR/NUL (header injection). If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- sender_name bytes a restored C-locale path would refuse — or the reverse —
-- breaking campaign sender continuity across restore.
--
-- Scope:
--   - Reattach outreach_campaigns_sender_name_check preserving the exact
--     char_length(btrim(sender_name)) 1..120 bound PLUS ASCII control
--     rejection under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus campaign name,
--     company_name (#628), company_postal_address, audience_description,
--     value_proposition, sender_email/reply_to (#421), timezone (#463),
--     status (#529), and cta_url (#443)
-- Does NOT rewrite outreach writers/Edge Functions, lead business_name,
-- message personalization_note / subject / body fields, or restaurant-tenant
-- tables.
-- Timestamp after MISE-005HL (#628).

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
        con.conname = 'outreach_campaigns_sender_name_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%sender_name%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%sender_name%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%sender_name%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%company_name%'
          and pg_get_constraintdef(con.oid) not ilike '%company_postal_address%'
          and pg_get_constraintdef(con.oid) not ilike '%audience_description%'
          and pg_get_constraintdef(con.oid) not ilike '%value_proposition%'
          and pg_get_constraintdef(con.oid) not ilike '%sender_email%'
          and pg_get_constraintdef(con.oid) not ilike '%reply_to%'
          and pg_get_constraintdef(con.oid) not ilike '%timezone%'
          and pg_get_constraintdef(con.oid) not ilike '%cta_url%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          -- Bare campaign name CHECK mentions "name" but not sender_name;
          -- the ilike '%sender_name%' gate above already excludes it. Keep
          -- an explicit name guard for clarity.
          and con.conname is distinct from 'outreach_campaigns_name_check'
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
  drop constraint if exists outreach_campaigns_sender_name_check;

alter table public.outreach_campaigns
  add constraint outreach_campaigns_sender_name_check check (
    char_length(btrim(sender_name)) between 1 and 120
    and sender_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint outreach_campaigns_sender_name_check
  on public.outreach_campaigns is
  'MISE-005HM: outreach_campaigns sender_name char_length(btrim) 1..120 plus ASCII control rejection under COLLATE "C".';

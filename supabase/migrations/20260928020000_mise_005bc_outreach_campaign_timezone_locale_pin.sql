-- MISE-005BC: pin public.outreach_campaigns.timezone shape CHECK to COLLATE "C".
--
-- outreach_campaigns.timezone still only enforces length 1–100:
--   check (char_length(timezone) between 1 and 100)
-- The Edge create_campaign path already requires a real Intl IANA name, but the
-- table CHECK admits any Unicode string of that length — including ASCII
-- controls and spaced labels. Under LC_CTYPE drift, dump/restore and Edge
-- create continuity can disagree on the same timezone bytes.
--
-- Campaign timezone drives isWithinOutreachSendWindow / date_trunc day math for
-- send windows. Identity drift here can open or close the send window for the
-- same wall-clock instant after restore.
--
-- Scope:
--   - Reattach outreach_campaigns_timezone_check with
--     timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'
--     (same IANA Area/Location ASCII class as restaurants.timezone MISE-005BB;
--      length bound tightened from 100 → 64 to match)
-- Does NOT rewrite restaurants.timezone (open MISE-005BB #462), outreach email
-- / URL CHECKs (open #420/#421/#443), or free-form campaign copy.
-- Timestamp after MISE-005BB (#462 restaurants.timezone).

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
        con.conname = 'outreach_campaigns_timezone_check'
        or con.conname = 'outreach_campaigns_timezone_length_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%timezone%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length(timezone)%'
            or pg_get_constraintdef(con.oid) ilike '%length(timezone)%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%sender_email%'
          and pg_get_constraintdef(con.oid) not ilike '%reply_to%'
          and pg_get_constraintdef(con.oid) not ilike '%cta_url%'
          and pg_get_constraintdef(con.oid) not ilike '%send_window%'
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
  drop constraint if exists outreach_campaigns_timezone_check;

alter table public.outreach_campaigns
  drop constraint if exists outreach_campaigns_timezone_length_check;

alter table public.outreach_campaigns
  add constraint outreach_campaigns_timezone_check check (
    timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'
  );

comment on constraint outreach_campaigns_timezone_check
  on public.outreach_campaigns is
  'MISE-005BC: IANA-shaped ASCII timezone (Area/Location class) under COLLATE "C", length 1–64.';

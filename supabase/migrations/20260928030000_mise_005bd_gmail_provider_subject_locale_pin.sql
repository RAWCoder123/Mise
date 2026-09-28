-- MISE-005BD: pin private.gmail_credentials.provider_subject shape CHECK to
-- COLLATE "C".
--
-- private.gmail_credentials still stores provider_subject under a length-only
-- bound from the Gmail OAuth delivery migration:
--   length(provider_subject) between 1 and 255
-- Hosted writers accept the same length-only gate today:
--   private.service_complete_gmail_oauth
-- Edge identity parsing used unbounded stringField("sub", 255) (any non-control
-- Unicode) in _shared/gmail.ts.
--
-- provider_subject is the durable Google account subject bound 1:1 to a
-- restaurant Gmail credential (restaurant_id UNIQUE). It is the reconnect and
-- credential-rotation identity for supplier-email send. Authenticated clients
-- hold no direct access; inserts are SECURITY DEFINER service_role only.
--
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005* tips
-- pinned Gmail sender_email (#423), OAuth state_hash/PKCE (#438), and Square
-- merchant_id (#460), but left provider_subject on length-only bounds because
-- open #423 owns the complete-oauth rewrite for sender_email.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept a
-- subject the restored C-locale ASCII gate would refuse (or the reverse),
-- breaking Gmail credential reconnect continuity across restore.
--
-- Scope:
--   - Replace length-only provider_subject CHECK with named shape CHECK:
--     provider_subject collate "C" ~ '^[A-Za-z0-9_-]{1,255}$'
--   - Does NOT rewrite private.service_complete_gmail_oauth (open #423 owns
--     that function for sender_email). Edge gmail-oauth-callback fail-closes
--     on the same ASCII class before the complete RPC; a follow-up after #423
--     lands can pin the SQL writer + _shared/gmail.ts allowlist.
-- Does NOT rewrite sender_email (#423), OAuth state_hash/PKCE (#438), Square
-- merchant_id (#460), or activity_events / restaurant_memories / inventory_events.
-- Timestamp after MISE-005BC (#463 outreach_campaigns.timezone).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.gmail_credentials'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'gmail_credentials_provider_subject_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%provider_subject%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(provider_subject)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9_-]{1,255}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.gmail_credentials drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.gmail_credentials
  drop constraint if exists gmail_credentials_provider_subject_check;

alter table private.gmail_credentials
  add constraint gmail_credentials_provider_subject_check check (
    provider_subject collate "C" ~ '^[A-Za-z0-9_-]{1,255}$'
  );

comment on constraint gmail_credentials_provider_subject_check
  on private.gmail_credentials is
  'MISE-005BD: ASCII Google provider_subject under COLLATE "C".';

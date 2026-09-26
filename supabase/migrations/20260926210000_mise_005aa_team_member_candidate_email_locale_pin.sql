-- MISE-005AA: pin find_restaurant_member_candidate email normalize/compare
-- to COLLATE "C".
--
-- public.find_restaurant_member_candidate still normalizes the invite lookup
-- mailbox with bare:
--   lower(btrim(p_email))
-- and matches auth.users with bare:
--   lower(auth_user.email) = normalized_email
-- lower() follows database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; sibling email pins
-- (MISE-005N/O/P/Q/R) already COLLATE "C" supplier-send and Gmail mailboxes,
-- but left the team-directory invite candidate lookup on bare lower/btrim.
--
-- Owner/admin invite lookup resolves an Auth user id by email before
-- add_restaurant_member. If LC_CTYPE drifted, the same operator bytes could
-- fail to match a mailbox Auth stored (or match under a restore C-locale gate
-- that the source would have refused), breaking membership invite continuity.
--
-- Scope:
--   - Rewrite public.find_restaurant_member_candidate so normalize + Auth
--     compare use lower(btrim(...) COLLATE "C") COLLATE "C"
--   - Align fail-closed shape with the client normalizeTeamMemberEmail gate
--     (length 3–254, ASCII C [[:cntrl:]] + [[:space:]] mailbox shape)
--   - Preserve revoke/grant EXECUTE to authenticated only
-- Does NOT rewrite list_restaurant_members, add/update/remove_restaurant_member,
-- or open invite-token stacks. Compose-safe alone on main (candidate RPC
-- unreplaced since 20260726213000). Timestamp after MISE-005Z.

create or replace function public.find_restaurant_member_candidate(
  p_restaurant_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_email, '')) collate "C"
  ) collate "C";
  candidate_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin'])
  then
    raise exception 'Membership access denied' using errcode = '42501';
  end if;
  if pg_catalog.length(normalized_email) not between 3 and 254
    or normalized_email collate "C" ~ '[[:cntrl:]]'
    or normalized_email collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'Member email is invalid' using errcode = '22023';
  end if;

  select auth_user.id into candidate_user_id
  from auth.users auth_user
  where pg_catalog.lower(
      pg_catalog.btrim(coalesce(auth_user.email::text, '')) collate "C"
    ) collate "C" = normalized_email
  limit 1;

  return candidate_user_id;
end;
$$;

revoke all on function public.find_restaurant_member_candidate(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.find_restaurant_member_candidate(uuid, text)
to authenticated;

comment on function public.find_restaurant_member_candidate(uuid, text) is
  'Owner/admin-only lookup of an auth user id by email for team invitations. Null means no Mise account uses the email. MISE-005AA pins normalize/compare to COLLATE "C".';

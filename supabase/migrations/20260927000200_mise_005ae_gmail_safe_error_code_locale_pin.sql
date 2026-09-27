-- MISE-005AE: pin private.gmail_safe_error_code allowlist to COLLATE "C".
--
-- private.gmail_safe_error_code still gates provider failure codes with bare:
--   p_error_code !~ '^[a-z0-9_]{1,80}$'
-- POSIX [a-z0-9_] follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips pinned emails, fingerprints, OAuth state hashes, and profile shape
-- classes, but left this shared Gmail/Square failure-code helper on a bare
-- class check.
--
-- The helper is the single ASCII allowlist used by:
--   private.service_fail_gmail_oauth
--   private.service_mark_gmail_connection_state
--   private.service_fail_supplier_email_send
--   private.service_fail_square_oauth
--   private.service_mark_square_connection_state
--   private.service_record_square_sync_failure
-- and later 003a/003b/003c send-integrity callers that reuse it. Accepted
-- codes are stored on connection/sync/send failure rows. If LC_CTYPE drifted
-- under a bare class check, dump/restore and Edge→RPC failure recording
-- could disagree on the same provider bytes — accepting a code the restored
-- C-locale gate would refuse (or the reverse) and breaking reconnect /
-- sync-failure continuity for Gmail and Square.
--
-- Scope:
--   - Rewrite private.gmail_safe_error_code so the shape gate uses COLLATE "C"
--   - Preserve revoke-all (internal helper; no EXECUTE grants)
-- Does NOT rewrite service_record_mise_action_failure (separate mise_actions
-- path with the same regex class), operational_finding_decisions.policy_version,
-- complete-oauth paths, or Edge Function bodies (already emit lowercase
-- snake_case codes). Compose-safe alone on main (helper unreplaced since
-- gmail_backend_oauth_delivery). Timestamp after MISE-005AD.

create or replace function private.gmail_safe_error_code(p_error_code text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_error_code is null or p_error_code collate "C" !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'Invalid provider error code' using errcode = '22023';
  end if;
  return p_error_code;
end;
$$;

revoke all on function private.gmail_safe_error_code(text)
from public, anon, authenticated, service_role;

comment on function private.gmail_safe_error_code(text) is
  'MISE-005AE: ASCII provider error-code allowlist under COLLATE "C".';

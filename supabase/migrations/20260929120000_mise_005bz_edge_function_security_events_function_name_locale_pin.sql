-- MISE-005BZ: pin private.edge_function_security_events.function_name CHECK
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- private.edge_function_security_events stores Edge Function firewall identity
-- under a bare IN allowlist last expanded by square_backend_oauth_sync:
--   function_name in (
--     'sync-pos-sales', 'generate-ai-insights', 'link-gmail',
--     'gmail-oauth-callback', 'send-supplier-email', 'operational-workflows',
--     'delete-account', 'export-restaurant-data',
--     'link-square', 'square-oauth-callback', 'square-webhooks'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII kebab-case tokens
-- only (EdgeFunctionName in supabase/functions/_shared/mise.ts and
-- private.edge_function_policy).
--
-- function_name is the durable firewall identity for reservation, rate-limit,
-- and terminal security events. POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling provenance/identity gates through MISE-005BY are
-- pinned under COLLATE "C", but edge_function_security_events.function_name
-- remained on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN function_name CHECK, dump/restore could
-- accept firewall-identity bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking Edge
-- Function reservation continuity across restore.
--
-- Scope:
--   - Replace edge_function_security_events_function_name_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C":
--       function_name in (...11 kebab-case tokens...)
--       and function_name collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite edge_function_policy, reservation writers, Edge Function
-- TypeScript allowlists, or free-form event metadata.
-- Timestamp after MISE-005BY (#485).

alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_function_name_check;

alter table private.edge_function_security_events
  add constraint edge_function_security_events_function_name_check check (
    function_name in (
      'sync-pos-sales', 'generate-ai-insights', 'link-gmail',
      'gmail-oauth-callback', 'send-supplier-email', 'operational-workflows',
      'delete-account', 'export-restaurant-data',
      'link-square', 'square-oauth-callback', 'square-webhooks'
    )
    and function_name collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint edge_function_security_events_function_name_check
  on private.edge_function_security_events is
  'MISE-005BZ: exact Edge Function name allowlist plus ASCII shape under COLLATE "C".';

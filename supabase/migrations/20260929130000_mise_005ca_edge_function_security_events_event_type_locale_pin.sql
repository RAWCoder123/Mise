-- MISE-005CA: pin private.edge_function_security_events.event_type CHECK
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- private.edge_function_security_events stores Edge Function firewall event
-- classification under a bare IN allowlist from edge_function_firewall:
--   event_type in (
--     'allowed', 'denied', 'rate_limited', 'blocked', 'completed', 'error'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII snake_case tokens
-- only (reserve_edge_function_invocation / complete_edge_function_invocation
-- and supabase/functions/_shared/mise.ts terminal event helpers).
--
-- event_type is the durable firewall classification for reservation,
-- rate-limit, denial, and terminal security events. POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; MISE-005BZ pinned the sibling
-- function_name gate under COLLATE "C", but event_type remained on bare IN
-- only.
--
-- If LC_CTYPE drifted under a bare-IN event_type CHECK, dump/restore could
-- accept firewall-classification bytes the restored C-locale path (and
-- sibling machine-identity gates) would refuse — or the reverse — breaking
-- Edge Function reservation and rate-limit continuity across restore.
--
-- Scope:
--   - Replace edge_function_security_events_event_type_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C":
--       event_type in (...6 snake_case tokens...)
--       and event_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite reservation / completion writers, edge_function_policy,
-- function_name (#486 / MISE-005BZ), or free-form action/metadata fields.
-- Timestamp after MISE-005BZ (#486).

alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_event_type_check;

alter table private.edge_function_security_events
  add constraint edge_function_security_events_event_type_check check (
    event_type in (
      'allowed', 'denied', 'rate_limited', 'blocked', 'completed', 'error'
    )
    and event_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint edge_function_security_events_event_type_check
  on private.edge_function_security_events is
  'MISE-005CA: exact Edge Function event_type allowlist plus ASCII shape under COLLATE "C".';

-- MISE-005DF: pin public.system_operational_controls.ordering_policy and
-- public.restaurant_operational_controls.ordering_policy CHECKs to COLLATE "C",
-- preserving the exact-token allowlist off/draft_only.
--
-- Both tables store supplier-order policy vocabulary under bare IN allowlists
-- from enforce_provider_kill_switches:
--   ordering_policy in ('off', 'draft_only')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'off'         — supplier-order drafting disabled
--   'draft_only'  — manager-controlled draft generation permitted when
--                   order_drafting_enabled is also true
--
-- ordering_policy gates purchase-approval authority, provider kill-switch
-- claims, invite-only admission, pilot operational controls, and the
-- order_drafting_enabled coupling CHECKs. POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; open sibling pin #517 covers
-- system_operational_controls.operational_mode, but leaves ordering_policy
-- on both control tables on bare IN only.
--
-- If LC_CTYPE drifted under bare-IN ordering_policy CHECKs, dump/restore
-- could accept ordering-policy vocabulary bytes the restored C-locale path
-- (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking supplier-order authority across restore.
--
-- Scope:
--   - Replace system_operational_controls_ordering_policy_check and
--     restaurant_operational_controls_ordering_policy_check with
--     exact-token allowlists PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite order_drafting_policy_check coupling constraints,
-- operational_mode (#517), service_set_system_operational_mode (#434),
-- pilot control writers, purchase_orders.status, or other vocabularies.
-- Timestamp after MISE-005DE (#517).

alter table public.system_operational_controls
  drop constraint if exists system_operational_controls_ordering_policy_check;

alter table public.system_operational_controls
  add constraint system_operational_controls_ordering_policy_check
  check (
    ordering_policy in ('off', 'draft_only')
    and ordering_policy collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

alter table public.restaurant_operational_controls
  drop constraint if exists restaurant_operational_controls_ordering_policy_check;

alter table public.restaurant_operational_controls
  add constraint restaurant_operational_controls_ordering_policy_check
  check (
    ordering_policy in ('off', 'draft_only')
    and ordering_policy collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint system_operational_controls_ordering_policy_check
  on public.system_operational_controls is
  'MISE-005DF: exact off/draft_only allowlist plus ASCII shape under COLLATE "C". Global supplier-order policy.';

comment on constraint restaurant_operational_controls_ordering_policy_check
  on public.restaurant_operational_controls is
  'MISE-005DF: exact off/draft_only allowlist plus ASCII shape under COLLATE "C". Restaurant supplier-order policy.';

comment on column public.system_operational_controls.ordering_policy is
  'Global supplier-order policy. Allowed values: off, draft_only under COLLATE "C".';

comment on column public.restaurant_operational_controls.ordering_policy is
  'Restaurant supplier-order policy. Allowed values: off, draft_only under COLLATE "C".';

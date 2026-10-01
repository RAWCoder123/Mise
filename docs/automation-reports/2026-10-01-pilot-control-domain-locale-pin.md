# MISE-005DX: pilot control_domain locale pin

**Date:** 2026-10-01  
**Branch:** `cursor/mise-pilot-control-domain-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open locale-pin stacks through #535)

## Change

Additive CHECK-only migration
`20261001020000_mise_005dx_pilot_control_domain_locale_pin.sql`
replaces `pilot_operational_control_changes_control_domain_check` so the exact
allowlist `square` / `drafting` / `gmail` / `external` / `system_mode` is also
gated by ASCII shape under `COLLATE "C"`:

```sql
control_domain in ('square', 'drafting', 'gmail', 'external', 'system_mode')
and control_domain collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Why

The bare IN check from `mise_pilot_001_atomic_controls` is exact string equality
with no dedicated C-locale ASCII shape gate. MISE-005A proved locale drift on
this cluster; sibling pins through #535 left pilot `control_domain` unpinned.
Dump/restore under a drifted `LC_CTYPE` could accept bytes a restored C-locale
path would refuse (or the reverse), breaking pilot control evidence continuity.

## Scope / non-goals

- Does **not** rewrite `service_apply_pilot_operational_control`
- Does **not** touch `requested_action`, `reason_code`,
  `system_operational_controls.operational_mode` (#517), or
  `restaurant_operational_controls`
- CHECK-only; no policy or function changes

## Verification

- `npm run typecheck`
- Focused `pilotControlDomainLocalePin` tests
- `npm test` (expect 0 fail; cancelledByParent noise allowed)
- pgTAP plan **13** counted from 13 assertion call sites in
  `pilot_control_domain_locale_pin.test.sql` (Docker pgTAP not required in this
  environment)

## Classification impact

No change to release classification. Continues the controlled-pilot vocabulary
hardening cluster; does not unlock App Store submission.

# MISE-005HI: edge_function_security_events.action cntrl locale pin

## Summary

Additive CHECK-only migration replaces
`edge_function_security_events_action_check` with
`length(trim(action)) between 1 and 160 and action collate "C" !~ '[[:cntrl:]]'`.

The foundation column was `action text not null check (length(trim(action)) > 0)`
with no control-character gate and no upper length bound. Hosted writers in
`harden_workflow_authority` already reject blank or `length(action_name) > 160`
and store `trim(action_name)`. This tip upgrades the column CHECK under
COLLATE `"C"` so dump/restore cannot accept Edge Function action bytes a
restored C-locale path would refuse.

`action` is classified as a single-line invocation label
(e.g. `supplier_email_blocked`, `function_error`), not free-form multiline
prose.

## Scope

- CHECK-only; does not rewrite reservation / completion writers or
  `edge_function_policy`
- Leaves `function_name` (#486 / MISE-005BZ) and `event_type`
  (#487 / MISE-005CA) CHECKs untouched
- Alone-OK versus open #486 / #487 / #624

## Verification

- `npm run typecheck` passed
- focused `edgeFunctionSecurityEventsActionCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable
  in this environment)

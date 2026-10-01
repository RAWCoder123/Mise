# MISE-005EQ recalculation_runs.failure_reason cntrl locale pin

Date: 2026-10-01

## Change

CHECK-only replace of `recalculation_runs_failure_reason_check`:

- keep `failure_reason is null` or `length(trim(failure_reason)) between 1 and 200`
- reject ASCII controls with `failure_reason collate "C" !~ '[[:cntrl:]]'`

Domain `sanitizeRecalculationFailureReason` strips the same ASCII C control set
before ledger writes so system-generated cycle errors (which may include
newlines) still record safely under the pinned CHECK.

## Why

The length CHECK had no control-character gate. Failure reasons are durable
operational diagnostics on the recalculation run ledger. Sibling MISE-005 tips
pin text CHECKs under `COLLATE "C"` so dump/restore cannot accept bytes a
restored C-locale path would refuse.

## Out of scope

- `public.record_recalculation_run` rewrite
- `recalculation_runs_failure_check` status/reason consistency
- status (#496), cycle/monitoring_owner (#499), key (#452), job_name (#453)

## Verification

- `npm run typecheck`
- focused `recalculationFailureReasonCntrlLocalePin` tests
- `npm test`
- pgTAP plan **12** counted from 12 assertion call sites

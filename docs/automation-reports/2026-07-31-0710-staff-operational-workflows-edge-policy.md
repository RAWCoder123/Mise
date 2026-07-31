# Staff operational-workflows Edge firewall alignment

Date: 2026-07-31

## Problem

Staff inventory waste recording and count-session draft/submit were authorized in SQL RPCs, the Edge action allowlist (`staffOperationalActions`), and the Expo UI. Hosted calls still failed because `private.edge_function_policy('operational-workflows')` only allowed `owner|admin|manager`. Edge reservation runs before action-level role checks, so staff always received firewall `forbidden`.

Local demo mode bypasses Edge, and earlier pgTAP coverage exercised service waste RPCs directly, so the gap was easy to miss.

## Change

- Migration `20260731071000_staff_operational_workflows_edge_policy.sql` recreates `private.edge_function_policy` with `operational-workflows` roles `owner|admin|manager|staff`.
- Other Edge functions stay unchanged (`sync-pos-sales`, Gmail, supplier email remain manager+/owner+).
- Action-level least privilege is unchanged: staff may only `begin_count_session`, `save_count_lines`, `submit_count_session`, and `record_waste`; approve/cancel counts, inventory updates, item create, recipe edits, receiving, and setup remain manager+.

## Verification

- Static security contract asserts the new policy migration and staff action allowlist.
- pgTAP asserts staff can reserve `operational-workflows`, cannot reserve `link-gmail` or `sync-pos-sales`, and forbidden attempts do not write forbidden ledger rows.
- Unit/typecheck/security:backend run in the automation cycle.

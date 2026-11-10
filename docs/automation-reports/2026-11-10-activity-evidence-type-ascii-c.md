# MISE-005ABN Activity expanded evidence.type ASCII C

Date: 2026-11-10  
Branch: `cursor/mise-activity-evidence-type-ascii-c`  
Baseline: `origin/main` @ `78da7376`

## Problem

Activity expanded evidence lines always rendered raw `evidence.type` with only
underscore→space humanize:

```tsx
{evidence.type.replace(/_/g, " ")} — {evidence.summary}
```

A Unicode-only-space type (`"\u2003"`) is truthy/non-empty, so Activity still
rendered blank-looking evidence type identity (`"  — …"`). Separately, Unicode
`.trim()` on a padded type (`"\u2003inventory_item\u2003".trim() ===
"inventory_item"`) invents a clean display evidence type before
underscore→space humanize.

## Fix

- `services/domain/presentationActivityEvidenceTypeIdentity.ts` — ASCII C
  single-line prep; soft-null empty / Unicode-padded / control-bearing types
- `app/more/activity.tsx` — soft-null before evidence-line type humanize;
  empty-type fallthrough (`""` before the em-dash)
- Underscore→space humanize remains a post-normalize step on the safe token
  only
- Focused inventing/bypass proofs in `tests/activityEvidenceTypeAsciiC.test.ts`
- No new catalog keys; no migration

## Out of scope

- Activity expanded evidence.summary (#1155 / MISE-005YW)
- Activity relatedEntityType (#1200 / MISE-005AAO)
- Activity triggerType (#1201 / MISE-005AAP)
- Activity relatedEntityId / actionId / triggerReference (#1198 / #1199 / #1197)
- Autonomy actionType / evidence.type leave-alone (#254 / #239 / #273)
- restaurant-tasks evidence type (#856 / MISE-005PV)
- finding-decision evidence type (#793 / MISE-005NK)
- Activity title/summary i18n (#271) and hub label i18n (#239)

## Verification

- Focused tip tests: 5/5 (63 assertion call sites counted from source)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`
- No migration. Alone-OK beside #1155 / #1200 / #1201 (ordinary conflict only
  on `app/more/activity.tsx` + new identity module).

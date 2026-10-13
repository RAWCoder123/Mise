# MISE-005OR pilotReadiness supplier_id ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-pilot-readiness-supplier-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `assessSupplierRouting` / `assessEmailDelivery` grouped suppliers with
`item.supplier_id.trim()` and `recipient.supplier_id.trim()` as Set keys, and
treated a Unicode-trimmed token as present for the missing-supplier blocker.
NBSP (`U+00A0`) or em-space (`U+2003`) padding around a valid supplier token
would still normalize to that token, inventing a clean Set key, falsely clearing
missing-supplier blockers, and matching padded inventory identities to unpadded
recipients (`'\u2003uuid\u2003'.trim() === 'uuid'`).

## Change

- Added `services/domain/pilotReadinessSupplierIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed readiness Set-key grouping and missing-supplier detection through
  `canonicalizePilotReadinessSupplierId`; null continues the existing
  missing-supplier / empty-key filter so Unicode-padded supplier ids never
  invent a clean key.
- Preserved require message `Pilot readiness requires a supplier id.`
- Left `input.restaurantId.trim()` alone (tipped pilot-readiness restaurant
  workspace #745).
- Left `recipient.email?.trim()` and `connection.sender_email?.trim()`
  presentation emptiness alone.
- Left open supplier-reliability supplier tip #825 alone.
- UUID-shaped and non-UUID demo tokens intentionally preserved; max length 128.

## Merge note

Alone-OK relative to open stacks through #825 and #192. Does not share identity
modules with supplier-reliability supplier (#825) or tipped pilot-readiness
restaurant (#745). When #745 also lands and rewrites restaurant workspace, drop
this tip's assertion that `input.restaurantId.trim()` still appears if that path
already moved.

## Verification

- `tests/pilotReadinessSupplierAsciiC.test.ts`: focused inventing proofs
- `tests/pilotReadiness.test.ts`: existing readiness suite
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)

# Inventory coverage ↔ par guidance (2026-08-31)

## Goal
Help operators translate observed average daily usage into days-of-cover implications for par and reorder settings, without inventing lead times or MOQs.

## Changes
- Domain: `services/domain/inventoryCoverageGuidance.ts` converts usage + draft par/reorder into status, days-at-par, days-at-reorder, and optional ~3-day / ~1.5-day suggestions.
- Presentation: `services/presentation/inventoryCoveragePresentation.ts` localizes titles, bodies, day summary, and apply CTA.
- UI: Inventory detail par settings card shows live guidance as fields change; managers can fill suggested values into the draft before Save.
- i18n: EN / ES / zh-Hans keys under `inventory.coverage.*`.

## Tests
- `tests/inventoryCoverageGuidance.test.ts`
- `tests/inventoryCoveragePresentation.test.ts`

## Out of scope
- No migration / RPC changes.
- Does not edit purchase `unit`, invent expiration/MOQ/lead time, or auto-save settings.

# MISE-005KI: pin miseDomain insight demand slug identity to ASCII C

## Summary

`services/domain/miseDomain.ts` `buildInsightsFromData` still built
`insight_spike_*` and `insight_prep_*` ids with Unicode-aware
`toLowerCase` after whitespace→underscore. Sibling tip #677 /
MISE-005JH already pinned the parallel path in `operationalSignals`, and
the post-#703 gap note called out remaining insights label/identity
lowercasing. Under Unicode case folding, a Kelvin sign (`K`) becomes
`k`, which invents a `chicken_bowl` insight id the ASCII C path would
refuse — e.g. `chicKen Bowl` colliding with `Chicken Bowl`.

This tip routes spike/prep insight id slugs through ASCII C case fold +
ASCII-whitespace normalize + non-alphanumeric collapse (same shape as
`operationalSignals` `insightDemandSlug`), so Kelvin lookalikes cannot
invent demand or prep insight identity.

## Scope

- Client domain helpers in `miseDomain.ts`
  (`asciiCLower`, `asciiCNormalizeToken`, `insightDemandSlug`)
- Wire `buildInsightsFromData` spike/prep ids through `insightDemandSlug`
- Focused static + behavioral tests
- Does **not** re-tip operationalSignals demand keys (#677), miseDomain
  menu-item keys (#675), orderPresentation demo price (#703), Inventory
  categoryIcon (#701), settings deleteConfirmWord (#702), Ask Mise
  intent (#700), or restaurantMemory learning-signal (#699)
- Does **not** rewrite SQL uniqueness / CHECK migrations
- Does **not** tip error-message haystacks in `inventoryEventTransport` /
  `recalculationPorts`, commit-hash lower in `betaReleaseReadiness`, or
  InventoryHealth accessibility label lowercasing
- Does **not** tip cosmetic display `.toLowerCase()` in insight copy

## Verification

- `npm run typecheck`
- focused `tests/miseDomainInsightDemandSlugAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes the miseDomain insight
demand-slug Kelvin inventing gap deferred after #677/#703; it does not
unblock live POS credentials or App Store submission.

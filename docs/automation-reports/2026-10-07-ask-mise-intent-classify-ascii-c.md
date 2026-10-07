# MISE-005KE: pin Ask Mise intent classify to ASCII C

Date: 2026-10-07

## Summary

Pin Ask Mise intent classification (`askMiseIntentHaystack` /
`normalizeAskMiseIntentToken`) to ASCII C case fold and ASCII-only whitespace
trim so Kelvin lookalikes cannot invent operational intents (`stock`, `waste`,
`prep`, and siblings) that steer grounded Ask Mise answers. Expand the Spanish
prep stem to accept uppercase `Ó` so ALL-CAPS `PREPARACIÓN` still matches after
ASCII C fold (which leaves Latin-1 accents alone).

## Why

`classifyAskMiseIntent` previously lowercased the question with Unicode-aware
`toLowerCase` before keyword matching. Sibling client tips already pin learning-
signal classify, inventory/menu/email identity, and typed-search to ASCII C.
Ask Mise intent selects which grounded restaurant facts are summarized for the
operator. Under Unicode folding, Kelvin (`K`) becomes `k`, so a question like
`Is stocK healthy?` invents a `stock` keyword hit the ASCII C path would refuse.

Pure ASCII C without expanding the Spanish prep stem would regress ALL-CAPS
`PREPARACIÓN` (Ó stays uppercase and no longer matches `[oó]`).

## Change

- `services/ai/askMise.ts`: ASCII C helpers + exported normalize / haystack;
  classify path uses the haystack helper; prep regex accepts `Ó`.
- Focused static + behavioral tests.
- Automation report.
- No SQL migration (classification is client-side over free-form operator text).

## Verification

- `npm run typecheck`
- focused `tests/askMiseIntentClassifyAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Out of scope

- Landing/rebasing open stacks #348–#699
- Re-tipping tipped identity files (restaurantMemory learning-signal #699,
  Inventory/Log Delivery typed search #698, Scan Item #697, and listed skips)
- Inventory `categoryIcon` display heuristic
- `utils/orderPresentation` demo price heuristic
- Settings account `deleteConfirmWord` compare
- Error-message haystacks / commit-hash lower
- Contested SQL mutators / ingest rewrites

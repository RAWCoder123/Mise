# MISE-005SB demo supplier display-name ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-demo-supplier-display-name-ascii-c`

## Problem

`services/demo/demoSupplierIdentity.ts` `normalizeDemoSupplierDisplayName`
Unicode-trimmed, then collapsed Unicode `\s+` into a single space, before
storing `display_name` / `normalized_name` and deriving durable legacy
supplier UUIDs. Unicode trim invents a clean display name
(`'\u2003Acme Foods\u2003'.trim().replace(/\s+/g, " ") === 'Acme Foods'`).
Internal em-space likewise invents plain-space equality via `\s+`. Soft empty
/ Unicode-only space also invented the invalid-name branch via
`'\u2003'.trim() === ''`. Discovery lowercasing used
`toLocaleLowerCase("en-US")`, which can invent Kelvin-sign collapses hosted
COLLATE `"C"` lower would refuse.

Open #692 / MISE-005JW pins hosted `requireSupplierDisplayName` / recipient
directory prep. Open #691 / MISE-005JV pins Settings suppliers rename identity.
Open #430 / MISE-005V pins SQL display_name cntrl shape. None own this demo
display-name Unicode-trim / `\s+` / locale-lower sink. Tip them separately.

## Change

- New `services/domain/demoSupplierDisplayNameIdentity.ts` (MISE-005SB)
- Soft empty / Unicode-only space → throw (`Enter a valid supplier name.`)
- ASCII whitespace still trims / C-collapses clean before the length gate
- Unicode end padding, remaining non-C whitespace, and controls → throw
- Discovery keys fold only ASCII A–Z
- Wire `normalizeDemoSupplierDisplayName` / `demoSupplierNormalizedName`
- Leave hosted #692 / Settings #691 modules alone

## Landing notes

Alone-OK with #692 / #691 / #430 / #913 / #708 / #686 / #683. Keep
`demoSupplierDisplayNameIdentity.ts` separate from
`supplierDisplayNameIdentity.ts` (#692) and
`supplierSettingsNameIdentity.ts` (#691). When landing with #692, do not
consolidate onto that hosted module in this tip — demo discovery UUID
derivation stays local.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
- Docker pgTAP unavailable in this environment

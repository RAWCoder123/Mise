# MISE-005VV POS settings posProviderLabel ASCII C (2026-11-02)

## Defect

POS settings demo-mode provider chrome used:

```ts
const posProviderLabel =
  posProvider === "Manual CSV Upload" ? t("pos.provider.manualCsv") : posProvider;
// ...
posProviderLabel ?? t("common.demo")
posProviderLabel ?? t("common.none")
posProviderLabel ? t("pos.hero.connected", { provider: posProviderLabel }) : t("pos.hero.connectSource")
```

Unicode-only-space and empty string are non-nullish under `??` and truthy,
bypassing localized `common.demo` / `common.none` / connect-source copy.
Unicode `.trim()` on padded provider labels would invent clean display
provider identities before interpolating into `pos.hero.connected` /
`pos.status.demoConnected`.

## Fix

- `services/domain/presentationPosProviderLabelIdentity.ts`
- Soft-null via `normalizePosProviderLabel` (ASCII C single-line: ASCII end
  trim only; preserve NBSP — no fold; full C0/DEL reject) before
  `|| t("common.demo")` / `|| t("common.none")` and truthy connected copy on
  `app/settings/pos.tsx` (label derivation + 2 fallback sites; hero/body
  truthy path inherits soft-null)

## Ownership

Owns only POS settings demo-mode `posProviderLabel` presentation before
`common.demo` / `common.none` / connect-source. Does **not** own POS
mappings menu-item names (#1024 / MISE-005VP), Settings workspace
cuisine_type (#1023), Sales Import / Settings hub restaurant-name
(#1022 / #1021), Orders/Gmail sender_email (#1020 / #1019), waste itemName
(#1018), Inventory detail item_name (#1017), Orders detail supplier_name
(#1016), tasks.shared.* (#1025–#1028), Insights subtitle cuisine (#1029),
raw `posProvider` tone/stats selection, or ProviderOption list equality.
Alone-OK relative to #1029/#1024/#1023/#1022/#1021/#1020/#1019.

## Inventing / bypass proof

- `("\u2003" ?? FALLBACK) === "\u2003"` bypasses `?? t("common.demo")` /
  `?? t("common.none")`
- `("" ?? FALLBACK) === ""` same bypass
- truthy `"\u2003"` selects connected hero/body instead of connect-source
- `"\u2003Square\u2003".trim() === "Square"` inventing equality
- ASCII C soft-null restores the localized empty-state copy

## Verification

- Focused `tests/posProviderLabelAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)

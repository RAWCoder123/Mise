# MISE-005YZ: pin Activity expanded summarizeMetadata free-text string values to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-activity-metadata-string-value-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Activity expanded Details metadata projection inventing / blank-body bypass via prior always-pass free-text string values for `itemName` / `supplierName`:

```tsx
function summarizeMetadata(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === "string" || typeof value === "number" ? value : "…"}`)
    .join(" · ");
}
```

Soft-null empty / Unicode-padded / unsafe free-text identities → localized `activity.metadata.value.none` (EN / ES / zh-Hans). Alone-OK beside #1155 / #1150 / #1151 / #1148 / #1149 (no migration). Distinct from Activity expanded evidence.summary (#1155 / MISE-005YW). Machine metadata fields (`quantity`, `unit`, dates, enums/UUIDs) remain raw pass-through.

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as `itemName= ` / `supplierName= ` with no localized none fallback
- `"\u2003Chicken Breast\u2003".trim() === "Chicken Breast"` inventing equality
- activityEvents builders carry untrusted `itemName` / `supplierName` from recommendation, order, and inventory item names
- ASCII C soft-null restores `activity.metadata.value.none`

## Leave alone

- Activity expanded evidence.summary (#1155 / MISE-005YW)
- Activity hub row event.summary (#1150 / MISE-005YR)
- Home ActivityRow event.summary (#1151 / MISE-005YS)
- Activity hub row event.title (#1148 / MISE-005YP)
- Home ActivityRow event.title (#1149 / MISE-005YQ)
- Machine metadata fields (enums / UUIDs / numbers)
- `event.errorMessage` (not projected in UI)

## Alone-OK

No migration. Beside #1155 / #1150 / #1151 / #1148 / #1149. Ordinary UI conflicts possible with Activity inventing stacks that also touch `app/more/activity.tsx`.

## Verification

- Focused `activityMetadataStringValueAsciiC` 5/5 (77 assertion call sites; plan from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

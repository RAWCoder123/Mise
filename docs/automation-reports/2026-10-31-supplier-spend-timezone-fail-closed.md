# Supplier spend restaurant timezone fail-closed (2026-10-31)

Branch: `cursor/mise-supplier-spend-timezone-fail-closed`
Base: `origin/main` @ `78da737`

## Defect

`buildSupplierSpendTrend` defaulted omitted `options.timeZone` to `"UTC"` and
passed empty or Unicode-padded IANA names straight into `toDateKeyInTimeZone`.
Invalid zones are caught there and fall back to `date.toISOString().slice(0, 10)`,
inventing a UTC calendar day for spend buckets.

At `2026-10-31T22:30:00.000Z`:

- valid `Asia/Tokyo` → `2026-11-01`
- omitted / empty / em-space-padded / invalid via UTC inventing → `2026-10-31`

Sibling waste analysis and supplier reliability already fail closed with Intl
validation on the raw timezone. Supplier spend did not.

## Change

- `services/domain/supplierSpend.ts` — `requireRestaurantTimeZone` rejects
  omitted/empty zones with `Supplier spend trend requires a restaurant timezone.`
  and invalid/padded IANA names with
  `Supplier spend trend requires a valid restaurant timezone.` before dating.
- Do not Unicode-trim into a clean IANA identity. Do not default omitted zones
  to `"UTC"`.
- Leave restaurant workspace ASCII-C (#776), operating-date util (#1001), and
  global `hourInTimeZone` UTC fallback alone.

## Verification

- Focused `tests/supplierSpend.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

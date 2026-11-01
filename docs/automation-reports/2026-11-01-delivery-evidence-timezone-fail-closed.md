# Orders delivery-evidence timezone fail-closed (2026-11-01)

## Defect

`app/orders/[id].tsx` formatted delivery-evidence `receivedAt` with
`timeZone: restaurant?.timezone ?? "UTC"`. A missing restaurant timezone
therefore invented a UTC calendar day near timezone boundaries. Unicode-padded
or otherwise invalid IANA names stayed truthy through emptiness gates and could
reach formatters that strip the rejected zone and invent a host-local day.

## Inventing proof

At `2026-07-20T01:00:00.000Z`:

- valid `America/New_York` → **Jul 19, 2026**
- missing timezone via `?? "UTC"` → **Jul 20, 2026** (invented)

## Change

- `services/domain/deliveryEvidenceDate.ts` —
  `restaurantTimeZoneForDeliveryEvidence` (empty/missing →
  `Delivery evidence date requires a restaurant timezone.`; invalid/padded →
  `Delivery evidence date requires a valid restaurant timezone.`)
- Do not Unicode-trim into a clean IANA identity; Intl validates the raw value
- Orders detail maps fail-closed errors to `—` so the meta line does not invent
  a calendar day claim
- Leaves intentional noon-UTC formatting of stored `delivery_date` keys alone
- Leaves open timezone tips #993–#1009 and `formatLocalizedDate` strip inventing
  (#999) alone

## Ownership

Owns Orders detail delivery-evidence `receivedAt` timezone fail-closed only.
Does **not** own localized date strip inventing (#999), operating-date util
(#1001), demo dataset rebuild (#1009), or other tipped timezone/currency
surfaces.

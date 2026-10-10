# MISE-005MP: pin Mise-actions domain subjectId/idempotencyKey/actionId to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-actions-domain-object-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins domain-layer Mise-actions `subjectId` / `idempotencyKey` / `actionId` object
tokens to ASCII-only end trim so NBSP/em-space padding cannot invent a
normalized identity before idempotency-key composition, prepared-action
acceptance, or outcome measurement.

- Adds `services/domain/miseActionsDomainObjectIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes `miseActionIdempotencyKey` `subjectId` through
  `requireCanonicalMiseActionsDomainObjectId(..., "subject id")`.
- Routes `createPreparedAction` `idempotencyKey` through the same helper with
  label `"idempotency key"`.
- Routes `measureOutcome` `actionId` through the same helper with label
  `"action id"` and stores the canonical form.
- Preserves `Mise actions require an idempotency key.` /
  `Outcomes require an action id.`
- Adds fail-closed `Mise actions require a subject id.` for inventing subject
  padding (no prior dedicated subject rejection existed).
- Leaves restaurant workspace on Unicode trim.
- Leaves operator free-text (`approvedBy`, `error`, `rollbackReference`,
  `lesson`) on Unicode trim.
- Leaves application Mise-actions object tip #761
  (`miseActionsObjectIdentity.ts`) untouched.
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).

## Merge note

Alone-OK vs #761. Keep both helper modules when landing together:
`miseActionsObjectIdentity.ts` (application orderId/actionId labels) and
`miseActionsDomainObjectIdentity.ts` (domain subject/idempotency/action). Do
not merge their error contracts. Leave restaurant `restaurantId.trim()` paths
for any open restaurant tip.

## Verification

- `tests/miseActionsDomainObjectAsciiC.test.ts`: 4/4
- `tests/miseActions.test.ts`: 5/5
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)

## Do not

- Re-tip this domain subjectId/idempotencyKey/actionId path after merge.
- Bundle application (#761) or sibling object tips in the same PR.
- Rewrite restaurant `restaurantId.trim()` in this tip.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).

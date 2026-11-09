# MISE-005AAW — Orders detail deliveryEvidence notes ASCII C

**Branch:** `cursor/mise-orders-detail-delivery-evidence-notes-ascii-c`  
**Date:** 2026-11-09

## Problem

Orders detail rendered delivery-verification notes with raw truthiness:

```tsx
{evidence.notes ? (
  <Text style={styles.deliveryEvidenceNote}>{evidence.notes}</Text>
) : null}
```

A Unicode-only-space note (`"\u2003"`) is raw-truthy while `.trim()` empties it, so the intentional hide branch was bypassed and chrome could render a blank-looking note. Unicode `.trim()` on padded notes would invent a clean display body. Control-bearing notes that survive upstream soft paths could also reach the always-pass Text.

## Fix

- Add `services/domain/ordersDetailDeliveryEvidenceNotesIdentity.ts` with ASCII C multiline free-text prep (NBSP fold + C-end trim; preserve LF/TAB/CR; refuse em-space padding and disallowed controls).
- Route the deliveryEvidence notes display branch through soft `normalizeOrdersDetailDeliveryEvidenceNotes` so unsafe tokens fall through to the intentional hide branch.
- Leave domain builder canonicalize (#835), sent-note.none (#1013), delivery-evidence timezone (#1010), and receive-discrepancy (#670) alone.

## Inventing / bypass proof

- `Boolean("\u2003") === true` while `.trim()` empties it (hide bypass).
- `"\u2003Late truck; crushed corner\u2003".trim() === "Late truck; crushed corner"` (Unicode-trim inventing).
- ASCII C soft-null restores the intentional hide branch.
- Complementary to open #835: builder soft canonicalize may still pass em-padded notes through; this tip soft-nulls that padding at the UI gate.

## Ownership

Owns Orders detail deliveryEvidence `notes` presentation only. Alone-OK vs #835 (builder), #1013 (sent `operator_note` / note.none), #1010 (receivedAt timezone), #672 (SQL cntrl), and #883/#1027 (task evidence) — different modules/call sites.

## Verification

- Focused `tests/ordersDetailDeliveryEvidenceNotesAsciiC.test.ts`
- `npm run typecheck`
- `npm test`

# MISE-005OS inventory count-line note ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-inventory-count-sessions-note-ascii-c`  
Base: `origin/main` @ `78da737`

## Summary

Pins domain-layer inventory count-session line `note` to ASCII C multiline
free-text prep so Unicode trim cannot invent a clean variance note via
NBSP/em-space padding.

## Inventing proof

`mergeCountLineUpdates` and `planCountSessionApprovals` used
`update.note.trim()` / `line.note.trim()` before storing or planning ledger
metadata. Em-space padding invented a clean note:

```text
'\u2003Spill during prep\u2003'.trim() === 'Spill during prep'
```

ASCII C prep (NBSP fold + C end-trim only; no internal `\s` collapse) leaves
em-space alone and keeps internal LF/TAB/CR.

## Change

- `services/domain/inventoryCountLineNoteIdentity.ts`
- Route merge + plan notes through `normalizeCanonicalInventoryCountLineNote`
- Left `inventoryItemId.trim()` Map-key path on Unicode trim (#770 tip)
- Left miseValidation `requireInventoryCountLineNote` /
  `requireInventoryCountSessionNote` alone

## Verification

Recorded after local gates on this tip branch.

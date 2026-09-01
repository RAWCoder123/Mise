# Export share dismiss fail-closed (2026-09-01)

Branch: `cursor/mise-export-share-dismiss-fail-closed`  
Base: `origin/main` @ `20b28e5`

## Gap

Settings restaurant export always showed a green success notice after
`Sharing.shareAsync` resolved. expo-sharing resolves on every share-sheet
dismissal, including cancel, so operators were told the export was “Saved”
when they had not shared it.

## Fix

1. Added `services/domain/exportShareOutcome.ts` to classify
   `shared` / `dismissed` / `unconfirmed` without inventing delivery.
2. iOS uses React Native `Share.share` so `dismissedAction` maps to a caution
   notice instead of success.
3. Android/other native paths keep expo-sharing for file attachment, but treat
   sheet close as `unconfirmed` (and cancel-like errors as `dismissed`) rather
   than success.
4. Web download path remains an explicit success.
5. EN/ES/ZH copy for dismissed and unconfirmed notices.

## Verification

- `npm run typecheck` — pass
- `node --test --import tsx tests/exportShareOutcome.test.ts tests/dailyBriefAndExportUi.test.ts` — 7/7 pass
- `npm test` — see commit message / PR for full suite result

## Next

- Land/rebase open stacks onto main without duplicating gates.
- Inventory purchase-unit (`unit`) correction — needs Codex `safe_patch`.
- Founder legal URLs / EAS / hosted security re-proof remain external.

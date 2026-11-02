# MISE-005VT checklist completion-evidence label ASCII C (2026-11-02)

## Summary

Task detail completion previously wrote durable checklist evidence as
`entry.label ?? entry.type ?? "Completed checklist item"`. Unicode-only-space
and empty string are non-nullish under `??`, so padding bypassed the intentional
omit path; absent labels promoted machine `type` codes or invented English UI
copy into stored evidence. Unicode `.trim()` on padded labels would invent a
clean durable label.

## Fix

- `services/domain/taskChecklistCompletionEvidenceLabelIdentity.ts`
- Soft-null via `normalizeTaskChecklistCompletionEvidenceLabel` / 
  `buildChecklistCompletionEvidenceLabel` (ASCII C single-line: end trim only;
  preserve NBSP; refuse em-space padding / full C0/DEL) before write in
  `app/tasks/[id].tsx` (1 site)
- Omits `label` when soft-null; never bakes English `"Completed checklist item"`
  or machine type into durable evidence

## Ownership

Owns only the completion write-path checklist evidence label → omit / ASCII-C
canonical label. Does **not** own Task detail checklist display →
`tasks.shared.checklistItem` (#1026), evidence display → `tasks.shared.evidence`
(#1027), instructions → `tasks.shared.noInstructions` (#1025), write-path
completion evidence notes (#883), domain create/hydrate detail (#823), or
`completionResult` (#824). **Supersedes** stale #268 (Unicode-trim inventing
presentation helper). Alone-OK relative to #1027/#1026/#1025/#883/#823/#824.

## Verification

- focused `tests/taskChecklistCompletionEvidenceLabelAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test`

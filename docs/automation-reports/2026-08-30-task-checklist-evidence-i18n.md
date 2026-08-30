# Shared-task checklist evidence i18n (2026-08-30)

Branch: `cursor/mise-task-checklist-evidence-i18n`
Base: `origin/main` @ `20b28e5`

## Problem

Shared-task completion wrote English UI fallbacks (`Completed checklist item`)
and raw machine type codes (`checklist_item`) into durable
`completionEvidence`. ES/zh-Hans operators then saw English or machine strings
in completed-task history.

## Change

- Store checklist completion evidence locale-neutral: keep `type:
  checklist_item`, copy operator labels only when present, never invent English
  UI text at write time.
- Present checklist rows and completion evidence through
  `services/presentation/sharedTaskEvidence.ts` with EN/ES/zh-Hans catalog
  fallbacks (`tasks.shared.checklistItemCompleted` and verification-type
  labels).
- Wire `app/tasks/[id].tsx` to the shared helpers.

## Verification

- `npm run typecheck` — pass
- `npm test` — 635 pass / 0 fail / 7 cancelled
- `tests/sharedTaskEvidence.test.ts` — 3/3 pass
- `tests/localization.test.ts` — catalog key parity pass
- `npm run security:static` — pass

## Classification

Controlled pilot-ready tip. Not App Store submission-ready.

## Next residuals (avoid #132–#267 + #147)

1. Land/rebase open stacks onto main without duplicating gates.
2. Locale-aware supplier send templates (EN/ES/zh-Hans) with MISE-003B
   fingerprint parity — wait for #266 delivery_date message rebase.
3. Invite-gated Auth signup only after founder Auth policy decision.

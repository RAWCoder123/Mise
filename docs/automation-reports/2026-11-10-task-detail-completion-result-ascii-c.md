# MISE-005ABM Task detail sharedTask.completionResult ASCII C

Date: 2026-11-10  
Branch: `cursor/mise-task-detail-completion-result-ascii-c`  
Baseline: `origin/main` @ `78da7376`

## Problem

Task detail always rendered raw `sharedTask.completionResult` into Result chrome:

```tsx
<Text style={styles.instructionsBody}>{sharedTask.completionResult}</Text>
```

Domain complete uses Unicode `.trim().replace(/\s+/g, " ")` via `requiredText`, and hydrate uses Unicode `.trim()` via `optionalText`, so em-space padding invents a clean result body before UI. Unicode-only-space / control-bearing tokens that survive soft upstream paths always-pass into blank-looking or control-bearing Result chrome with no hide branch.

## Fix

- `services/domain/presentationTaskDetailCompletionResultIdentity.ts` — ASCII C multiline free-text prep (NBSP fold; C end-trim; preserve LF/TAB/CR; soft-null em-space padding and disallowed controls)
- `app/tasks/[id].tsx` — soft-null before the completed-result `instructionsBody` Text / intentional hide
- Focused inventing/bypass proofs in `tests/taskDetailCompletionResultAsciiC.test.ts`
- No new catalog keys (soft-null restores hide)

## Out of scope

- Restaurant-tasks durable complete/hydrate `completionResult` (#824 / MISE-005OP)
- Operating Plan Timeline `presentation.completionResult` (#1223 / MISE-005ABL)
- Task detail instructions → `tasks.shared.noInstructions` (#1025 / MISE-005VQ)
- Completion evidence notes (#883 / #1027)
- Create Task UI body pass-through

## Verification

- Focused tip tests: 5/5 (67 assertion call sites counted from source)
- `npm run typecheck`: passed
- `npm run security:static` + `security:backend`: passed
- `npm run design:static`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited withTimeout cancelledByParent; fixed in #1183, not landed)
- No migration. Alone-OK beside #824 / #1025 / #1223 (ordinary conflict only on `app/tasks/[id].tsx`).

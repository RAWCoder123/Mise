# Ask Mise grounded pilot readiness (2026-08-25)

## Completed

- Ask Mise classifies readiness, recipe-coverage/mapping, and supplier-recipient
  questions as dedicated intents.
- Answers are grounded only in `fetchPilotReadiness` / `PilotReadiness`.
- Missing or failed readiness loads fail closed: Ask Mise refuses to invent
  recommend/send/mapping/recipient claims.
- Ask Mise chips surface readiness, mapping, and recipients first.
- EN / ES / zh-Hans catalog strings added for thinking steps and answers.

## Paths

- `services/ai/askMise.ts`
- `app/ask-mise.tsx`
- `i18n/catalog.ts`
- `tests/askMise.test.ts`

## Verification

- `npm run typecheck`
- `npm test -- tests/askMise.test.ts`

## Do not redo

- Overlap with open Home/Orders/Today readiness UI PRs (#145, #148).
- Server-side `approve_purchase_recommendation` readiness revalidation (Codex).
- Inventing inventory, sales, mapping, or recipient facts when readiness is null.

# Mise Agent Guide

## Source of Truth
- The latest fetched `origin/main` is the sole authoritative implementation baseline.
- Current implementation status: `docs/implementation/STATE.md`.
- Master product/engineering spec: `docs/product/mise-operational-backend-master.md`.
- UI references: `docs/design/references/`.
- `docs/implementation/DECISIONS.md`, `PR_INTEGRATION_PLAN.md`, `CLAUDE_HANDOFF.md`, `CLAUDE_CONSOLE_AGENT_PROMPT.md`, and `AGENT_KIT_README.md` are historical or superseded.

## Before Work
- Run `git fetch origin`, switch to `main`, and run `git pull --ff-only origin main` before creating a task branch.
- If the current worktree is dirty, preserve it; do not discard, reset, or overwrite it. Use a separate clean worktree when needed.
- Do not resume or merge wholesale from `rescue/*`, `split/*`, `cursor/initial-mise-import`, or `cursor/mise-product-inspection-*`.
- Re-evaluate any historical idea against current `origin/main` and implement it as a fresh, narrow PR.
- Use one designated writer for a change set. Other agents may inspect or review, but must not edit the same paths concurrently.

## Product Direction
- Mise is a mobile-first operations system for independent restaurants.
- Keep the current stack: Expo Router, React Native, TypeScript, Supabase, and a custom in-app design system.
- Do not replatform to Phoenix, Electron, or SQLite unless explicitly requested.
- Treat Codex as the engineering harness, not as an in-app user-facing feature.

## Visual Standards
- Anchor the UI in the Mise logo: white surfaces, black text, tomato-red actions/status, restrained green freshness/success accents, warm neutral background.
- Use colored surfaces only for meaningful state. Avoid rainbow palettes, decorative blobs, nested cards, and generic dashboard clutter.
- Use Lucide icons through shared primitives such as `IconBadge` and `ActionIcon`; keep icon buttons at 44px touch targets.
- Keep cards and controls compact, organized, and scan-first for repeated restaurant operations.

## Backend Standards
- Keep screen-facing service APIs stable in `services/miseService.ts`.
- Keep pure business rules in `services/domain/`, orchestration in `services/application/`, screen-facing formatting in `services/presentation/`, data access in `services/repositories/`, and external provider boundaries in `services/integrations/`.
- Put input normalization in `services/miseValidation.ts`.
- Keep restaurant-specific identity on the tenant model: `brand_color`, `accent_color`, `logo_url`, `service_style`, `timezone`, `currency`, and `operational_profile`.
- Use `services/integrations/` for POS adapter contracts and `services/ai/` for structured insight contracts; do not put provider secrets or OpenAI keys in the Expo client.
- Preserve local demo mode whenever changing Supabase-backed behavior.
- Add tests for pure domain logic when changing predictions, recommendations, insights, or supplier draft generation.

## Verification
- Run `npm run typecheck` after TypeScript changes.
- Run `npm test` after domain, service, or schema changes.
- For visual changes, verify `/today`, `/inventory`, `/orders`, `/insights`, `/setup`, and `/settings` at mobile width with no horizontal overflow.

## Verification rules

These are standing rules, not per-task instructions. Each one caught a real
defect in MISE-004C. Do not re-argue them per task.

1. **The plan is derived from source, never from output.**
   Count assertion call sites in the test file to get the plan number. Never
   read the number off a passing run and write it back into the plan. A plan
   derived from output is a transcript of what happened, not an independent
   expectation, and cannot detect a silent skip.

2. **Match exact error messages, never booleans.**
   Use `error_of` with the exact expected message. Never use a helper that
   returns false on any error — a typo and a permission denial are then
   indistinguishable, and the test passes green on the wrong failure. This
   caught a shadowed PL/pgSQL local that was raising "column reference is
   ambiguous" where a fail-closed authorization error was expected.

3. **Suspicion is tested, not reasoned about.**
   When a defect is found in one code path, do not conclude by inspection that
   a sibling path is safe or unsafe. Prove it — restore the pre-fix state in a
   rolled-back transaction and observe. Assertions that never executed are
   unproven, not passing.

Corollaries:
- A run that aborts partway is a failure regardless of how many assertions
  passed before the abort.
- Test infrastructure that is not committed to the repository does not exist.
  No inline shims, no scratch clusters torn down after the run.
- Derive column sets from the system catalog (`pg_attribute`), never from
  hardcoded names, so new columns cannot silently reintroduce a fixed defect.
- Never claim a test ran when it did not.

## Tooling and browsing

### gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

Never use the `mcp__claude-in-chrome__*` tools — use `/browse` instead.

Available gstack skills:

/office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship,
/land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only,
/design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro,
/investigate, /document-release, /document-generate, /codex, /cso, /autoplan,
/plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze,
/gstack-upgrade, /learn

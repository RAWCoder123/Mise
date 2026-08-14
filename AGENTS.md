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

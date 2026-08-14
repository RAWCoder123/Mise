# Implementation decisions — HISTORICAL

Status: **SUPERSEDED**

> Historical document.
> This file describes Mise before repository consolidation.
> Do not use it as the current implementation source of truth.
> Current state: `docs/implementation/STATE.md`.

## 2026-08-05 — Integration trunk is local branch + dirty tree, not PR #4 alone

**Context:** Claude agent kit assumes a six-PR stack culminating in `split/mockup-redesign` as UI baseline. Local inspection shows `cursor/initial-mise-import` diverged after PR #1 and carries far more product (committed UI + uncommitted operational backend).

**Decision:** Treat `cursor/initial-mise-import` + dirty worktree as the product trunk to preserve. Use PR #1–#6 as a **source of unique deltas**, not as a reset target.

**Consequences:** Checkpoint commits before any stack merge; do not merge #1–#4 onto clean `main` as the primary path.

**Status:** Proposed by Cursor bootstrap; Claude should confirm or amend after own inspection.

## 2026-08-05 — Canonical masterdoc path

**Decision:** Canonical copy lives at `docs/product/mise-operational-backend-master.md` (from agent kit). Existing `docs/MISE_OPERATIONAL_BACKEND_MASTER_PROMPT.md` remains; Claude should diff and keep a single source of truth (prefer product path; link from AGENTS if needed).

**Status:** Staged; content reconciliation pending Claude.

## 2026-08-05 — UI synthesis target

**Decision (from kit, not re-litigated here):** Newer clean concept for structure/density/nav; warmer concept for Fraunces narrative, tomato accent, warmer surfaces, expressive empty/done states. Preserve Mise design-system constraints in `AGENTS.md` and `constants/theme.ts` / `design:static` locks.

**Status:** Guidance only until Claude runs a visual pass against `docs/design/references/*`.

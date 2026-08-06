# Consultation — Cursor bootstrap (2026-08-05)

**Role:** Cursor as staging + repository-truth agent (not principal writer for product code)  
**Ask:** Execute Claude agent-kit first objective: stage kit, establish repo truth, map PR ancestry/CI, record resumable state.

## Findings accepted into living docs

- PR stack ancestry matches the kit hypothesis.  
- Local HEAD diverges after PR #1; does not contain PR #2–#4.  
- Dirty worktree holds critical untracked operational backend; must be preserved before stack merges.  
- GitHub PRs #1–#6 open/MERGEABLE with **no** status checks.  
- `npm run typecheck` and `npm test` (439) pass on current dirty tree.

## Decisions proposed (pending Claude confirmation)

See `docs/implementation/DECISIONS.md` — preserve local trunk; mine unique PR deltas; do not reset to mockup-redesign.

## Rejected approaches

- Integrating only PR #1–#4 onto clean `main` as the primary product path.

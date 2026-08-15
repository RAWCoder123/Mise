# Implementation decisions

## 2026-08-14 — Pilot readiness is one pure tenant-scoped contract

**Decision:** Compute POS-history/freshness, physical-count/canonical-unit, sales-weighted recipe coverage, supplier/cost routing, recipient, and Gmail readiness in `services/domain/pilotReadiness.ts`; load it through the repository-backed application layer and expose it through `services/miseService.ts`.

**Consequences:** Screens can present exact readiness areas without inventing state. Internal drafts remain available when only external recipient/Gmail setup is missing. Recommendation approval and draft generation do not consume this gate yet, so this is reporting—not a pilot-ready enforcement claim.

## 2026-08-14 — Supplier approval and external execution are separate transitions

**Decision:** Remove direct supplier send from Home and the Orders list. Order detail must show From, To, and Subject, refresh that envelope before approval, and call `approve_supplier_send_envelope` before delivery. The RPC persists the reviewed tuple on the `mise_action`; the provider claim locks and compares the current normalized sender, recipient, and subject before it can create a delivery claim. Hosted and demo delivery reject prepared/waiting/failed actions instead of approving them inside the send request.

**Consequences:** A final visible operator review owns the side effect. Recipient edits invalidate approval without recording a false send failure; retry after a true failed attempt requires another explicit approval. Provider idempotency and ambiguous-result blocking remain unchanged.

## 2026-08-14 — Square import activity uses an unambiguous processed-row accumulator

**Decision:** Replace the ambiguous PL/pgSQL accumulator/column assignment with `processed_count`, and cover exact and overlapping provider-window replay in pgTAP source.

**Consequences:** `sales_imports.records_processed`, audit metadata, the sync response, and activity projection agree. Database execution remains unproven until Docker or a hosted test environment is available.

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

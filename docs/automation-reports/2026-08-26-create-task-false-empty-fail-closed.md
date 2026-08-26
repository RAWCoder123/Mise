# Create Task false-empty fail-closed (2026-08-26)

## Context

Create Task already gated visible task lists on `hubReady`, but still rendered
true-empty copy (“no open/completed tasks”) and a zero count subtitle whenever
those gated lists were empty. Soft-refresh / load errors therefore claimed an
empty task board beside the RetryNotice.

This tip closes that false-empty gap only. It does not redo Autonomy/Create Task
draft-preserve (#160), secondary hub fail-closed (#151), or Today/suppliers/
log-delivery false-empty (#172).

## Changes

- EmptyState for open/completed task lists renders only when `hubReady`
- List count subtitle is omitted until the hub is ready
- Open/completed toggle is disabled while the hub is unavailable
- Static pins in `tests/hubLoadState.test.ts`, `tests/clientTenantSafety.test.ts`,
  and `tests/pilotUiSafety.test.ts`

## Paths

- `app/more/create-task.tsx`
- `tests/hubLoadState.test.ts`
- `tests/clientTenantSafety.test.ts`
- `tests/pilotUiSafety.test.ts`

## Verification

- `npm run typecheck`
- Targeted: hubLoadState + clientTenantSafety + pilotUiSafety

## Classification

Controlled pilot-ready code tip. Not App Store submission-ready.

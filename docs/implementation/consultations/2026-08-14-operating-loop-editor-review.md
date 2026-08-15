# Operating-loop editor consultation — 2026-08-14

Scope: read-only review from Cursor and VS Code alongside the Codex implementation on `pilot/first-restaurant-operating-loop`.

## Cursor

The first pass correctly established that PR #127 was already merged and was a presentation reconstruction, not proof of the first-real-restaurant milestone. Two actionable regressions were accepted and fixed:

- P1: Home had stopped rendering `visibleBrief.demoLabeled` / `home.demo.label`.
- P2: Today capped Later and Done at one row even after the operator selected that bucket, and did not promote the selected bucket.

Cursor was then asked to re-review the current working tree, strictly read-only, with emphasis on readiness, Square count/replay, supplier approval/send separation, tenant isolation, demo parity, and those two fixes. Its second pass found three accepted P2 issues: Home routed send reviews to the generic Orders hub, approval was not durably bound to the visible delivery envelope, and readiness load failures disappeared. Codex added the exact-order deep link, atomic envelope approval/claim contract with demo parity, and a visible retryable readiness failure.

A final focused Cursor pass found two more accepted mismatches: hosted `approval_required` was incorrectly recorded as a failed automation even though no delivery was claimed, and hosted SQL used exact supplier-name casing while review/demo used normalized identity. Both were fixed. The same pass noted that a bounded 200-action scan could miss an older draft; order detail now performs an exact tenant/order action lookup. Cursor reported the Home deep link, readiness retry, role boundaries, and row-locked envelope binding otherwise in place.

## VS Code

The existing VS Code agent independently verified and merged PR #127 in its separate `/Users/RAW/mise` clone before this milestone branch was created. Codex did not rely on that transcript for repository truth; the merge was independently verified against GitHub and `origin/main`.

A separate VS Code read-only peer review was requested against the absolute working-tree path `/Users/RAW/Documents/Mise`, with explicit instructions not to edit, stage, commit, push, merge, switch branches, approve prompts, or rerun long suites. It confirmed the truthful-count migration and send separation. Two reported code defects were rejected after direct inspection: `squareHeaders` is valid source with a bearer authorization header (the editor view masked the token expression), and repository rows are normalized into the camelCase `InventoryEvent` domain type before readiness scope validation. Its low-severity invalid-date note does not affect the repository-backed application path, which supplies no caller-controlled `generatedAt`.

## Authority

Codex remains the only writer in `/Users/RAW/Documents/Mise`. Editor findings are advisory and are accepted only after direct source inspection and local verification.

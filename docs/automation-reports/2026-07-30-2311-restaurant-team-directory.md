# Restaurant team directory (2026-07-30)

## Completed

- Cherry-picked prior hardening onto `cursor/mise-product-inspection-f21d` (secondary DML revoke, inventory movements, account deletion, bounded CSV POS ingest).
- Added `list_restaurant_members` and `add_restaurant_member_by_email` RPCs with audit logging on membership update/remove.
- Wired Settings → Team access UI for roster review, role changes, disable/enable, remove, and email-based add.
- Demo mode now seeds owner/manager/staff memberships (schema v4) and supports local team practice.
- Pinned `brace-expansion` to `^5.0.8` to clear the high npm audit finding.

## Verification

- Unit/domain coverage in `tests/teamMembership.test.ts`.
- pgTAP suite `supabase/tests/database/restaurant_team_directory.test.sql` (requires Docker).
- Route smoke includes `/settings/team`.

## Remaining

- Docker + hosted `verify:private-beta-security` re-proof after latest migrations.
- True email invite/onboarding (Auth invite) still requires founder product decision and provider config.
- Live POS/Gmail credentials and Apple/TestFlight remain external blockers.

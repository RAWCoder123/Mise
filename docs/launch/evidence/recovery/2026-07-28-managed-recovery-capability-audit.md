# Managed recovery capability audit

Verified: 2026-07-28

## Current state

The Mise Supabase organization is on the Free plan. Its dedicated staging
project is healthy, but managed daily backups and restore-to-new-project are
paid-plan capabilities.

Supabase's current documentation states:

- Pro, Team, and Enterprise projects receive managed daily backups;
- Free projects should maintain logical exports;
- restore-to-new-project is available only on paid plans with physical backups;
  and
- a restored project incurs additional project costs.

References:

- `https://supabase.com/docs/guides/platform/backups`
- `https://supabase.com/docs/guides/platform/clone-project`

## Existing evidence

Mise already performs a secret-free logical dump and isolated restore exercise
against dedicated staging. The latest proof matched the operational schemas and
rows without emitting row content. This remains useful disaster-recovery
evidence but is not equivalent to Supabase's managed restore workflow.

## Required external decision

The `managed_backup_restore` release receipt remains pending. Closing it
requires Raymond to approve the paid-plan and recovery-project cost before
Codex creates or restores any managed project. Production remains untouched.

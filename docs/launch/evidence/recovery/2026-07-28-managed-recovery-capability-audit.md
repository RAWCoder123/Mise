# Managed recovery capability audit

Verified: 2026-07-29T21:13:40Z

## Current state

The Mise Supabase organization is on the Free plan. Its dedicated staging
project is healthy, but managed daily backups and restore-to-new-project are
paid-plan capabilities.

The connected Supabase project inventory was rechecked on July 29. `Mise
Staging Security` (`ycwozuyyxunnnvalydar`) is `ACTIVE_HEALTHY` on PostgreSQL
17 in `us-east-2`. No production or recovery project was created, resumed,
restored, or changed.

Supabase's current documentation states:

- Pro, Team, and Enterprise projects receive managed daily backups;
- Free projects should maintain logical exports;
- restore-to-new-project is available only on paid plans with physical backups;
  and
- a restored project incurs additional project costs.

The connected organization currently quotes a development branch at
`$0.01344/hour`. That quote is not authorization to create a branch, and a
fresh migration-only branch would not by itself satisfy this receipt: the
exercise must prove restoration of the required staging snapshot into an
isolated hosted target.

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

-- MISE-005EE: pin public.setup_attachments.kind and status CHECKs
-- to COLLATE "C", preserving the exact-token allowlists.
--
-- public.setup_attachments stores onboarding import vocabulary under bare IN
-- allowlists from setup_persistence_observability:
--   kind in ('csv', 'screenshot')
--   status in ('queued', 'review_needed', 'processed', 'dismissed')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   kind:
--     'csv'         — CSV import metadata reference
--     'screenshot'  — screenshot import metadata reference
--   status:
--     'queued'         — accepted, awaiting review/processing
--     'review_needed'  — operator review required
--     'processed'      — import metadata processed
--     'dismissed'      — operator dismissed the attachment
--
-- kind and status gate setup persistence metadata, save_restaurant_setup
-- attachment payloads, and tenant-scoped setup continuity. POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; open tip #542 pinned pilot
-- backend_identity, but leave setup_attachments kind/status on bare IN only.
--
-- If LC_CTYPE drifted under bare-IN kind/status CHECKs, dump/restore could
-- accept setup-attachment vocabulary bytes the restored C-locale path
-- (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking setup-attachment continuity across restore.
--
-- Scope:
--   - Replace setup_attachments_kind_check and setup_attachments_status_check
--     with exact-token allowlists PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite save_restaurant_setup / atomic setup writers,
-- setup_attachments_metadata_only_check, RLS policies, or pilot vocabulary
-- pins (#542/#541/#536). Timestamp after MISE-005ED (#542).

alter table public.setup_attachments
  drop constraint if exists setup_attachments_kind_check;

alter table public.setup_attachments
  add constraint setup_attachments_kind_check
  check (
    kind in ('csv', 'screenshot')
    and kind collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

alter table public.setup_attachments
  drop constraint if exists setup_attachments_status_check;

alter table public.setup_attachments
  add constraint setup_attachments_status_check
  check (
    status in ('queued', 'review_needed', 'processed', 'dismissed')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint setup_attachments_kind_check
  on public.setup_attachments is
  'MISE-005EE: exact csv/screenshot allowlist plus ASCII shape under COLLATE "C". Setup attachment kind.';

comment on constraint setup_attachments_status_check
  on public.setup_attachments is
  'MISE-005EE: exact queued/review_needed/processed/dismissed allowlist plus ASCII shape under COLLATE "C". Setup attachment lifecycle state.';

comment on column public.setup_attachments.kind is
  'Setup attachment kind. Allowed values: csv, screenshot under COLLATE "C".';

comment on column public.setup_attachments.status is
  'Setup attachment lifecycle. Allowed values: queued, review_needed, processed, dismissed under COLLATE "C".';

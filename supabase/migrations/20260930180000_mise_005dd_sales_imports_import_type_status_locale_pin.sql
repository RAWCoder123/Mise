-- MISE-005DD: pin public.sales_imports.import_type and status CHECKs
-- to COLLATE "C", preserving the exact-token allowlists.
--
-- public.sales_imports stores POS/CSV import vocabulary under bare IN
-- allowlists from restaurant_ops_backbone:
--   import_type in ('pos_sync', 'csv_upload', 'manual_adjustment')
--   status in ('queued', 'processing', 'completed', 'failed')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   import_type:
--     'pos_sync'           — Square/provider sync import
--     'csv_upload'         — operator CSV sales upload
--     'manual_adjustment'  — manager correction import
--   status:
--     'queued'      — accepted, not yet running
--     'processing'  — sync/import in flight
--     'completed'   — finished with truthful counts
--     'failed'      — failed closed with error metadata
--
-- import_type and status gate POS sync activity routing (pos_sync_completed
-- vs automation_failed), Square sync truthful-count writers, demo/CSV
-- import presentation, and import ledger continuity. POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; open sibling pin #474
-- covers sales_imports.source_file_name, but leave import_type and status
-- on bare IN only.
--
-- If LC_CTYPE drifted under bare-IN import_type/status CHECKs, dump/restore
-- could accept import-vocabulary bytes the restored C-locale path (and
-- sibling machine-identity gates) would refuse — or the reverse —
-- breaking sales-import continuity across restore.
--
-- Scope:
--   - Replace sales_imports_import_type_check and sales_imports_status_check
--     with exact-token allowlists PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite Square sync / POS import writers, source_file_name (#474),
-- records_processed, error_message, metadata, or activity_events vocabulary
-- (#512). Timestamp after MISE-005DC (#515).

alter table public.sales_imports
  drop constraint if exists sales_imports_import_type_check;

alter table public.sales_imports
  add constraint sales_imports_import_type_check
  check (
    import_type in ('pos_sync', 'csv_upload', 'manual_adjustment')
    and import_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

alter table public.sales_imports
  drop constraint if exists sales_imports_status_check;

alter table public.sales_imports
  add constraint sales_imports_status_check
  check (
    status in ('queued', 'processing', 'completed', 'failed')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint sales_imports_import_type_check
  on public.sales_imports is
  'MISE-005DD: exact pos_sync/csv_upload/manual_adjustment allowlist plus ASCII shape under COLLATE "C". Sales import channel.';

comment on constraint sales_imports_status_check
  on public.sales_imports is
  'MISE-005DD: exact queued/processing/completed/failed allowlist plus ASCII shape under COLLATE "C". Sales import lifecycle state.';

comment on column public.sales_imports.import_type is
  'Sales import channel. Allowed values: pos_sync, csv_upload, manual_adjustment under COLLATE "C".';

comment on column public.sales_imports.status is
  'Sales import lifecycle. Allowed values: queued, processing, completed, failed under COLLATE "C".';

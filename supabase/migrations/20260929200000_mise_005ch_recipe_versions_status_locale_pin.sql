-- MISE-005CH: pin recipe_versions.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist draft/verified/retired.
--
-- recipe_versions.status stores recipe lifecycle vocabulary under a bare IN
-- allowlist from operational_data_foundation_inventory_ledger:
--   status in ('draft', 'verified', 'retired')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'draft'     — provisional recipe version, not yet operator-verified
--   'verified'  — operator-confirmed recipe authority for depletion
--   'retired'   — formerly active version, excluded from active windows
--
-- recipe_versions.status gates which recipe revision is eligible for POS
-- depletion, overlapping-window exclusion (status <> 'retired'), and
-- historical recipe continuity. POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; open sibling pins cover verification_status
-- (#493), inventory_events.event_type (#492), sibling canonical_unit
-- (#491), and inventory_items.canonical_unit (#490), but leave
-- recipe_versions.status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN recipe_versions.status CHECK,
-- dump/restore could accept lifecycle-state bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the
-- reverse — breaking recipe authority continuity across restore.
--
-- Scope:
--   - Replace recipe_versions_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite recipe writers, verification_status (#493),
-- inventory_events.event_type (#492), canonical_unit pins (#490/#491),
-- overlapping-window exclusion, or free-form notes.
-- Timestamp after MISE-005CG (#493).

alter table public.recipe_versions
  drop constraint if exists recipe_versions_status_check;

alter table public.recipe_versions
  add constraint recipe_versions_status_check
  check (
    status in ('draft', 'verified', 'retired')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint recipe_versions_status_check
  on public.recipe_versions is
  'MISE-005CH: exact draft/verified/retired allowlist plus ASCII shape under COLLATE "C". Recipe version lifecycle state.';

comment on column public.recipe_versions.status is
  'Recipe version lifecycle state. Allowed values: draft, verified, retired under COLLATE "C".';

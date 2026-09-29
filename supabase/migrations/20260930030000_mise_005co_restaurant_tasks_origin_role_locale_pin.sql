-- MISE-005CO: pin restaurant_tasks.origin and required_role CHECKs to
-- COLLATE "C", preserving the exact-token allowlists.
--
-- restaurant_tasks.origin and required_role store task provenance and
-- authority vocabulary under bare IN allowlists from shared_restaurant_tasks:
--   origin in ('human', 'mise', 'automated', 'approval', 'verification')
--   required_role in ('member', 'manager', 'owner_admin')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   origin:        'human' | 'mise' | 'automated' | 'approval' | 'verification'
--   required_role: 'member' | 'manager' | 'owner_admin'
--
-- origin gates Mise-vs-human activity copy, create-task authority, and
-- operating-plan presentation. required_role gates assignee eligibility and
-- complete-task role checks. POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; open sibling pin #498 covers restaurant_tasks.status
-- only, leaving origin and required_role on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN origin / required_role CHECK,
-- dump/restore could accept task-authority bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking task provenance and role gates across restore.
--
-- Scope:
--   - Replace restaurant_tasks_origin_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace restaurant_tasks_required_role_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite create/complete/reopen task RPCs, status (#498),
-- client_task_id (#455), priority/timing_bucket/operational_category/
-- verification_method/service_window, completion consistency CHECK, or
-- free-form title/detail/completion_result.
-- Timestamp after MISE-005CN (#500).

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_origin_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_origin_check
  check (
    origin in ('human', 'mise', 'automated', 'approval', 'verification')
    and origin collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_tasks_origin_check
  on public.restaurant_tasks is
  'MISE-005CO: exact human/mise/automated/approval/verification allowlist plus ASCII shape under COLLATE "C". Shared restaurant task provenance.';

comment on column public.restaurant_tasks.origin is
  'Shared restaurant task provenance. Allowed values: human, mise, automated, approval, verification under COLLATE "C".';

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_required_role_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_required_role_check
  check (
    required_role in ('member', 'manager', 'owner_admin')
    and required_role collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_tasks_required_role_check
  on public.restaurant_tasks is
  'MISE-005CO: exact member/manager/owner_admin allowlist plus ASCII shape under COLLATE "C". Shared restaurant task authority tier.';

comment on column public.restaurant_tasks.required_role is
  'Minimum role required to complete the task. Allowed values: member, manager, owner_admin under COLLATE "C".';

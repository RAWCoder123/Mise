# Daily Operating Plan and shared restaurant tasks evidence

Date: 2026-08-02  
Batch: `daily-operating-plan-41`  
Scope: master-prompt Milestone 4 local vertical slice

## Delivered

- A deterministic Daily Operating Plan over authoritative Today workflows and
  durable restaurant-wide tasks, with service windows, why, needed-by, effect,
  priority, roles, dependency IDs, verification methods, real completion
  results, and evidence-backed reprioritization.
- `restaurant_tasks` and `restaurant_task_dependencies` with tenant-composite
  foreign keys, active-membership RLS, explicit grants, operational-mode
  guards, assignee-role validation, cycle rejection, and no authenticated
  direct-write privileges.
- Authenticated `create_restaurant_task`, `complete_restaurant_task`, and
  `reopen_restaurant_task` RPCs with role enforcement, idempotent creation,
  prerequisite gating, evidence-required completion, immutable activity, and
  transactional dependent-task unblocking.
- Hosted and local-demo repository parity behind stable `miseService.ts`
  screen contracts; demo schema advanced to version 6.
- Changed task-create replays now fail closed across every immutable request
  field and dependency edge. Hosted mutation responses reload persisted
  dependencies instead of trusting caller input.
- Shared tasks project through the stable Today summary as well as the Daily
  Operating Plan, so Home, Ask Mise, task detail, and reporting consume the
  same restaurant-wide work. Cancelled tasks never reappear as open work and
  completed-task inclusion is consistent across both projections.
- Explicit Restaurant versus Personal task scope. Restaurant tasks support
  assignee, required role, timing, service window, verification, checklist,
  prerequisite, priority, and operational focus. Personal tasks retain the
  local device-only behavior.
- Central task detail and completion UI requiring the entire checklist, a
  truthful result, and configured evidence. Completed work exposes its result
  and evidence and can be reopened by a manager/owner/admin.
- Restaurant exports now include task and dependency datasets.

## Automated evidence

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 411/411 passed |
| `npm run security:backend` | Passed, including exact tenant-table inventory and explicit grants |
| `npm run design:static` | Passed |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `npm run doctor` | 21/21 checks passed |
| Expo production web export | Passed; 2 web bundles and 55 assets |
| `npm run qa:routes` | All declared routes returned HTTP 200 |
| `npm run qa:interactions` | 23 rendered routes at 390×844, zero horizontal overflow; full core interaction QA and EN/ES/ZH localized QA passed |
| `npm run supabase:test` | 15 files, 656 pgTAP assertions passed |
| Cursor read-only closure audit | No remaining actionable P0/P1/P2 findings after replay, dependency, projection, summary, and assignee-gate fixes |
| Workspace concurrency proof | 5 accepted, 15 rejected, 5 immutable allocations |
| Local Supabase security advisor | No issues found |

The focused shared-task pgTAP file contributes 35 assertions covering RLS,
grants, idempotency, staff/manager authority, tenant isolation, assignee
isolation, dependency cycles, evidence requirements, completion activity,
transactional unblocking, reopen, and emergency/read-only mode enforcement.

## Rendered Browser evidence

Browser classification: Codex in-app Browser.  
Local URL: `http://127.0.0.1:8081`.

The flow under test was:

`Tasks → create restaurant-wide count task → Today Now bucket → task detail →
checklist gate → completion result + count evidence → Today Done bucket`.

Observed state:

- The create screen defaulted to Restaurant scope and exposed service window,
  role, eligible assignee, verification, checklist, and prerequisite controls.
- Saving produced one central task and one open-list row.
- Today displayed the task in `Before supplier cutoff` with count verification.
- Completion was rejected until all three checklist items were checked.
- Completing with `Counted 42 lb…` plus a scale-reading note persisted the
  result and checklist evidence and changed Today from Now 2 / Done 11 to
  Now 1 / Done 12.
- The completed detail rendered the actual result, three completed checklist
  entries, the verification note, and a manager Reopen action.
- `/today`, `/inventory`, `/orders`, `/insights`, `/setup`, and `/settings`
  rendered meaningful content at 390×844 with `scrollWidth = 390`.
- Today also rendered at 1280px with `scrollWidth = 1280`.
- No framework overlay or application console error appeared. The only warning
  was the intended local-demo disclosure that Supabase public environment
  variables were absent.

The rendered loop found and fixed three issues before closure: central-task
save copy still described the old device-only lane, checklist rows were visible
but not yet completion evidence, and action validation used an inappropriate
retry-style notice instead of an ordinary error notice.

## Safety conclusions

- Restaurant-wide tasks no longer depend on one device for authority.
- Cross-tenant tasks, assignees, dependencies, and reads fail closed.
- Staff cannot fabricate Mise-origin tasks or assign work to another member.
- Non-assignee staff cannot enable completion in the task UI; managers retain
  the same explicit override enforced by the hosted RPC.
- A task cannot complete through the RPC while prerequisites remain open or
  configured verification evidence is absent.
- Activity history is append-only; task RPC replay does not rewrite prior
  activity.
- No staffing coverage, reservation demand, weather, supplier cutoff clock, or
  completion result is fabricated.
- Provider and ordering kill switches remain unchanged and default-off.

## Rollback and external boundary

The migration is additive. UI rollback can remove the central projection while
preserving task/activity truth. Database rollback, if explicitly approved,
must revoke the three RPCs and drop dependency/task tables only after exporting
required records; it must never delete activity, outcomes, inventory events, or
audit evidence.

No hosted/staging migration, provider activation, production deployment,
commit, or push was performed. Staging tenant proof and physical-device proof
remain gated external work, not unearned evidence for this local milestone.

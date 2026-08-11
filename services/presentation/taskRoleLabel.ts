import type { MessageKey } from "../../i18n/catalog";
import type { OperationalTodayTaskRequiredRole } from "../domain/todayTasks";

/**
 * The message key naming who owns a task.
 *
 * Home, Today, and Task detail all print this beside a due time, so the mapping
 * lives in one place: a row that says "Manager" while the detail behind it says
 * "Staff" is a correctness bug, not a styling one.
 */
export function taskRoleLabelKey(role: OperationalTodayTaskRequiredRole): MessageKey {
  if (role === "owner_admin") return "tasks.assigned.ownerAdmin";
  if (role === "manager") return "tasks.assigned.manager";
  return "tasks.assigned.staff";
}

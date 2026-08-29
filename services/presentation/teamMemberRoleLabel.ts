import type { MessageKey } from "../../i18n/catalog";
import type { RestaurantRole } from "../../types/mise";

/**
 * Message keys for restaurant membership roles shown in operator pickers.
 * Reuses Settings role labels so Create Task and Team never disagree.
 */

const ROLE_KEYS = {
  owner: "settings.role.owner",
  admin: "settings.role.admin",
  manager: "settings.role.manager",
  staff: "settings.role.staff"
} as const satisfies Record<RestaurantRole, MessageKey>;

export function teamMemberRoleLabelKey(role: RestaurantRole): MessageKey {
  return ROLE_KEYS[role];
}

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function presentTeamMemberRoleLabel(role: RestaurantRole, t: Translate): string {
  return t(teamMemberRoleLabelKey(role));
}

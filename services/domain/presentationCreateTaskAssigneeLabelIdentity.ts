/**
 * Create Task assignee chip label identity helpers (MISE-005TY).
 *
 * Pins Create Task `member.name?.trim() || member.email?.trim() ||
 * t("operatorTasks.assignee.teammate")` prep outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * Prior assignee chips Unicode-trimmed the teammate display name (then
 * email fallback) before rendering the ChoiceRow label
 * (`'\u2003Alex Rivera\u2003'.trim() === 'Alex Rivera'`), so NBSP/em-space
 * padding invented a clean assignee identity rendered into Create Task
 * assignee chrome. Soft empty / Unicode-only space also collapsed through
 * `.trim()` into the intentional i18n teammate fallback.
 *
 * These are presentation **Create Task assignee chip labels** only — not
 * Home / Ask Mise greeting first-name tokens (#961 / MISE-005TW), not
 * outreach greeting `firstName` (#960 / MISE-005TV), not user profile
 * display-name persistence (#849 / MISE-005PO), not More / Settings
 * profile avatar initials (#962 / MISE-005TX), not More / Settings profile
 * **name** label `.trim()` display, not team member directory labels, and
 * not restaurant-tasks domain `assigneeUserId` (#811 / MISE-005OC). Soft
 * empty / Unicode-padded / control-bearing tokens soft-null so padded
 * teammate names or emails cannot invent a clean assignee chip label; the
 * live `|| t("operatorTasks.assignee.teammate")` branch then preserves the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean. Case and accents are left unchanged.
 *
 * Complements open presentation greeting tip #961 / MISE-005TW and profile
 * initials tip #962 / MISE-005TX (which explicitly left Create Task
 * assignee chip labels alone) without sharing those modules or rewriting
 * team directory / More profile name-label paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized assignee label before it is rendered
 * into Create Task assignee chrome.
 */
export function asciiTrimPresentationCreateTaskAssigneeLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Create Task assignee chip label token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls. Does not prefer name over email — callers
 * sequence name then email after successful canonicalize.
 */
export function canonicalizePresentationCreateTaskAssigneeLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationCreateTaskAssigneeLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Create Task assignee label candidate (name or email).
 * Preserves soft empty → null (prior `.trim()` emptiness → next candidate
 * or i18n teammate fallback) while refusing to invent a clean label via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live fallback chain owns the
 * intentional teammate copy without inventing a clean assignee identity
 * from padding.
 */
export function normalizePresentationCreateTaskAssigneeLabelToken(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the next candidate / intentional i18n teammate
  // fallback. Do not invent a label token from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationCreateTaskAssigneeLabel(value);
}

/**
 * Resolve Create Task assignee chip label under ASCII C. Prefers a
 * canonical name, then a canonical email. Soft-null / empty candidates
 * leave the intentional `|| t("operatorTasks.assignee.teammate")`
 * fallback to the caller.
 */
export function presentationCreateTaskAssigneeLabel(
  name: string | null | undefined,
  email: string | null | undefined
): string | null {
  return (
    normalizePresentationCreateTaskAssigneeLabelToken(name) ??
    normalizePresentationCreateTaskAssigneeLabelToken(email)
  );
}

import type { MessageKey, MessageValues } from "../../i18n/catalog";
import type { RestaurantTaskEvidence } from "../domain/restaurantTasks";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const EVIDENCE_TYPE_LABEL_KEYS = {
  checklist_item: "tasks.shared.checklistItemCompleted",
  checklist: "tasks.shared.verification.checklist",
  photo: "tasks.shared.verification.photo",
  count: "tasks.shared.verification.count",
  receipt: "tasks.shared.verification.receipt",
  manager_review: "tasks.shared.verification.manager_review",
  source_state: "tasks.shared.verification.source_state"
} as const satisfies Record<string, MessageKey>;

/**
 * Checklist rows must never print machine type codes like `checklist_item`.
 * Operator-authored labels stay as written; otherwise fall back to a numbered
 * localized placeholder.
 */
export function sharedChecklistRowLabel(
  entry: RestaurantTaskEvidence,
  index: number,
  t: Translate
): string {
  const label = typeof entry.label === "string" ? entry.label.trim() : "";
  if (label) return label;
  return t("tasks.shared.checklistItem", { number: index + 1 });
}

/**
 * Completion evidence is stored locale-neutral. Prefer note, then operator
 * label, then a localized type label — never invent English text at write time.
 */
export function presentSharedTaskEvidence(entry: RestaurantTaskEvidence, t: Translate): string {
  const note = typeof entry.note === "string" ? entry.note.trim() : "";
  if (note) return note;
  const label = typeof entry.label === "string" ? entry.label.trim() : "";
  if (label) return label;
  const type = typeof entry.type === "string" ? entry.type.trim() : "";
  if (type && Object.prototype.hasOwnProperty.call(EVIDENCE_TYPE_LABEL_KEYS, type)) {
    return t(EVIDENCE_TYPE_LABEL_KEYS[type as keyof typeof EVIDENCE_TYPE_LABEL_KEYS]);
  }
  return t("tasks.shared.evidence");
}

/**
 * Build durable checklist completion evidence without baking UI locale into
 * stored labels. Machine type remains `checklist_item`; operator labels are
 * copied only when present.
 */
export function buildChecklistCompletionEvidence(
  checklist: readonly RestaurantTaskEvidence[]
): RestaurantTaskEvidence[] {
  return checklist.map((entry) => {
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    return {
      type: "checklist_item",
      ...(label ? { label } : {}),
      completed: true
    };
  });
}

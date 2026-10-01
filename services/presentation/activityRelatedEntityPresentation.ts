import type { ActivityRelatedEntityType } from "../domain/activityEvents";

/**
 * Resolves an Activity feed related-entity into an in-app route when the type
 * and id are known and safe. Returns null when Mise cannot deep-link (unknown
 * type, missing id, or unsafe id characters).
 */
export type ActivityRelatedEntityHref =
  | `/inventory/${string}`
  | `/orders/${string}`
  | `/tasks/${string}`;

const UNSAFE_ID = /[/?#\s]/;

export function resolveActivityRelatedEntityHref(input: {
  relatedEntityType: ActivityRelatedEntityType | string | null | undefined;
  relatedEntityId: string | null | undefined;
}): ActivityRelatedEntityHref | null {
  const id = typeof input.relatedEntityId === "string" ? input.relatedEntityId.trim() : "";
  if (!id || UNSAFE_ID.test(id)) {
    return null;
  }

  switch (input.relatedEntityType) {
    case "inventory_item":
      return `/inventory/${id}`;
    case "supplier_order":
      return `/orders/${id}`;
    case "restaurant_task":
    case "task":
      return `/tasks/${id}`;
    default:
      return null;
  }
}

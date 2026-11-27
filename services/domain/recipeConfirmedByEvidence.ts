/**
 * Structural audit evidence for menu-item recipe confirmation attribution.
 *
 * `menu_items.recipe_confirmed_by` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving the menu item's confirmation history (`ON DELETE SET NULL`).
 * Soft CHECK `menu_items_recipe_authority_check` already requires
 * `recipe_confirmed_revision` and `recipe_confirmed_at` together, but still
 * allows a confirmed row with `recipe_confirmed_by` null.
 *
 * Hosted `public.confirm_recipe_complete` stamps `auth.uid()` into
 * `recipe_confirmed_by` via UPDATE. Writers normally INSERT unconfirmed menu
 * items and only later UPDATE into a confirmed revision, so those
 * pre-confirmation inserts legitimately leave the actor null.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * confirmed recipe claim (`recipe_confirmed_revision` / `recipe_confirmed_at`
 * set) with `recipe_confirmed_by` null — an unattributable confirmation that
 * Activity / audit analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when confirmation evidence is present
 * without a non-null `recipe_confirmed_by`. It does not restore table-level
 * NOT NULL / CHECK (that would block auth anonymization UPDATEs), rewrite
 * `confirm_recipe_complete`, or require an actor when confirmation fields are
 * still null. Orthogonal to mise_actions / restaurant-memory / activity /
 * audit-log actor tips (#1298–#1306) and recipe ASCII-C / locale pins.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing confirmation-actor attribution on insert.
 * Returns null when recipe_confirmed_revision is unset (unconfirmed), or when a
 * non-empty recipe_confirmed_by id is present. Matches the SQL tip predicate
 * keyed on recipe_confirmed_revision; soft CHECK already pairs revision with
 * recipe_confirmed_at.
 */
export function validateRecipeConfirmedByEvidence(input: {
  recipeConfirmedRevision?: number | null;
  recipeConfirmedAt?: string | null;
  recipeConfirmedBy?: string | null;
}): string | null {
  if (input.recipeConfirmedRevision == null) {
    return null;
  }
  if (!hasActor(input.recipeConfirmedBy)) {
    return "missing_recipe_confirmed_by";
  }
  return null;
}

/**
 * Floor-notes / operator-task application object identity helpers (MISE-005MJ).
 *
 * Pins application-layer floorNotes.ts `taskId` (and `noteId` via
 * `completeFloorNote`) outside the AsyncStorage graph so Node tests can
 * exercise inventing proofs without loading React Native storage.
 * Complements open floor-note restaurant tip #730
 * (`Missing restaurant workspace.` / `requireCanonicalFloorNoteRestaurantId`)
 * without sharing its helper module or rewriting the restaurant workspace path.
 *
 * Intentionally does not change `restaurantId.trim()` /
 * `requireRestaurantId` on list/create/complete/reopen entry points. Those
 * remain on Unicode trim here and are owned by #730 / MISE-005LA.
 * Intentionally does not rewrite title/body/dueAt normalize surfaces.
 *
 * Operator task IDs are not UUID-shaped on every path (generated tokens such
 * as `floor_note_<uuid>` / `operator_task_<uuid>`). Only ASCII end trim is
 * pinned; case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized floor-note / operator-task object identity.
 */
export function asciiTrimFloorNotesObjectToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a floor-notes object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeFloorNotesObjectId(value: string): string | null {
  const trimmed = asciiTrimFloorNotesObjectToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed task require used by floor-notes
 * `completeOperatorTask` / `reopenOperatorTask` (and `completeFloorNote`
 * via `noteId` → `taskId`). Preserves the existing
 * `Missing operator task id.` error contract.
 */
export function requireCanonicalFloorNotesTaskId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing operator task id.");
  }
  const text = canonicalizeFloorNotesObjectId(value);
  if (!text) {
    throw new Error("Missing operator task id.");
  }
  return text;
}

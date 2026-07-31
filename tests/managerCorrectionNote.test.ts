import assert from "node:assert/strict";
import test from "node:test";

import { buildManagerCorrectionMetadata } from "../services/domain/managerCorrection";
import { requireManagerCorrectionNote } from "../services/miseValidation";

test("requireManagerCorrectionNote trims and bounds optional correction notes", () => {
  assert.equal(requireManagerCorrectionNote(undefined), null);
  assert.equal(requireManagerCorrectionNote(null), null);
  assert.equal(requireManagerCorrectionNote("   "), null);
  assert.equal(requireManagerCorrectionNote("  Delivery short  "), "Delivery short");
  assert.throws(() => requireManagerCorrectionNote("x".repeat(241)), /240/i);
});

test("buildManagerCorrectionMetadata stores optional note with par and reorder context", () => {
  const withNote = buildManagerCorrectionMetadata({
    parLevel: 20,
    reorderThreshold: 8,
    note: "  Cycle count fix  "
  });
  assert.deepEqual(withNote, {
    par_level: 20,
    reorder_threshold: 8,
    note: "Cycle count fix"
  });

  const withoutNote = buildManagerCorrectionMetadata({
    parLevel: 12,
    reorderThreshold: 4,
    note: null
  });
  assert.deepEqual(withoutNote, {
    par_level: 12,
    reorder_threshold: 4
  });
});

test("buildManagerCorrectionMetadata rejects oversized notes", () => {
  assert.throws(
    () =>
      buildManagerCorrectionMetadata({
        parLevel: 1,
        reorderThreshold: 1,
        note: "n".repeat(241)
      }),
    /240/i
  );
});

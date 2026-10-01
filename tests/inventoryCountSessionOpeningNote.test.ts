import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demoData";
import { requireInventoryCountSessionNote } from "../services/miseValidation";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("requireInventoryCountSessionNote trims, blanks to null, and bounds length", () => {
  assert.equal(requireInventoryCountSessionNote(null), null);
  assert.equal(requireInventoryCountSessionNote(undefined), null);
  assert.equal(requireInventoryCountSessionNote("   "), null);
  assert.equal(requireInventoryCountSessionNote("  after delivery  "), "after delivery");
  assert.equal(requireInventoryCountSessionNote("x".repeat(240)), "x".repeat(240));
  assert.throws(() => requireInventoryCountSessionNote("x".repeat(241)), /240/);
  assert.throws(() => requireInventoryCountSessionNote(12 as unknown as string), /text/i);
});

test("count session screen wires opening note into begin and surfaces session note", () => {
  const screen = source("app/inventory/count.tsx");
  const catalog = source("i18n/catalog.ts");
  const application = source("services/application/inventory.ts");

  assert.match(application, /requireInventoryCountSessionNote\(note\)/);
  assert.match(
    application,
    /beginInventoryCountSession\(restaurantId:\s*string,\s*note\?:\s*string\s*\|\s*null\)/
  );

  assert.match(screen, /draftOpeningNote/);
  assert.match(screen, /setDraftOpeningNote/);
  assert.match(screen, /beginInventoryCountSession\(restaurantId,\s*openingNoteRaw\s*\|\|\s*null\)/);
  assert.match(screen, /t\("inventory\.count\.sessionNotePlaceholder"\)/);
  assert.match(screen, /t\("inventory\.count\.sessionNoteAccessibility"\)/);
  assert.match(screen, /t\("inventory\.count\.sessionNoteTooLong"\)/);
  assert.match(screen, /visibleDetail\.session\.note/);
  assert.match(screen, /t\("inventory\.count\.sessionNoteLabel"/);
  assert.match(screen, /openingNoteRaw\.length\s*>\s*240/);

  for (const key of [
    "inventory.count.sessionNotePlaceholder",
    "inventory.count.sessionNoteAccessibility",
    "inventory.count.sessionNoteTooLong",
    "inventory.count.sessionNoteLabel"
  ]) {
    assert.equal((catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? []).length, 3);
  }
});

test("demo beginInventoryCountSession persists optional opening note", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  assert.ok(items.length > 0, "demo inventory should seed items");
  const first = items[0]!;
  await repository.verifyInventoryItemCanonicalUnit(
    DEMO_RESTAURANT_ID,
    first.id,
    first.canonical_unit === "g" || first.canonical_unit === "ml" || first.canonical_unit === "each"
      ? first.canonical_unit
      : "g",
    first.canonical_quantity_per_unit && first.canonical_quantity_per_unit > 0
      ? first.canonical_quantity_per_unit
      : 453.592
  );

  const openBefore = await repository.fetchOpenInventoryCountSession(DEMO_RESTAURANT_ID);
  if (openBefore) {
    await repository.cancelInventoryCountSession(DEMO_RESTAURANT_ID, openBefore.session.id);
  }

  const withNote = await repository.beginInventoryCountSession(
    DEMO_RESTAURANT_ID,
    "weekly close after delivery"
  );
  assert.equal(withNote.session.note, "weekly close after delivery");
  assert.equal(withNote.session.status, "in_progress");
  assert.ok(withNote.lines.length > 0);

  await repository.cancelInventoryCountSession(DEMO_RESTAURANT_ID, withNote.session.id);

  const withoutNote = await repository.beginInventoryCountSession(DEMO_RESTAURANT_ID, null);
  assert.equal(withoutNote.session.note, null);
  await repository.cancelInventoryCountSession(DEMO_RESTAURANT_ID, withoutNote.session.id);
});

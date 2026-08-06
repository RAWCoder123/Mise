import assert from "node:assert/strict";
import test from "node:test";

import {
  completeFloorNote,
  completeOperatorTask,
  createFloorNote,
  createOperatorTask,
  floorNoteFocusRoute,
  listFloorNotes,
  listOpenFloorNotes,
  listOpenOperatorTasks,
  listOperatorTasks,
  normalizeFloorNoteBody,
  normalizeFloorNoteTitle,
  normalizeOperatorTaskBody,
  reopenOperatorTask,
  setFloorNoteStorageForTesting,
  type FloorNoteStorage
} from "../services/application/floorNotes";

function memoryStorage(seed?: Record<string, string>): FloorNoteStorage {
  const values = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    }
  };
}

test("normalizeFloorNoteTitle trims and collapses whitespace", () => {
  assert.equal(normalizeFloorNoteTitle("  Check  walk-in  "), "Check walk-in");
});

test("normalizeOperatorTaskBody preserves newlines and trims ends", () => {
  assert.equal(
    normalizeOperatorTaskBody("  Line one  \n  Line two  \n"),
    "Line one\nLine two"
  );
  assert.equal(normalizeFloorNoteBody("  Ask  prep  "), "Ask prep");
});

test("createFloorNote persists per restaurant and lists open notes", async () => {
  const restore = setFloorNoteStorageForTesting(memoryStorage());
  try {
    const created = await createFloorNote({
      restaurantId: "restaurant-a",
      title: "  Label  produce  ",
      note: "  Ask prep  ",
      timing: "now",
      focusArea: "inventory",
      now: "2026-08-01T12:00:00.000Z"
    });

    assert.match(created.id, /^floor_note_/);
    assert.equal(created.title, "Label produce");
    assert.equal(created.note, "Ask prep");
    assert.equal(created.body, "Ask prep");
    assert.equal(created.priority, "normal");
    assert.equal(created.dueAt, null);
    assert.equal(created.status, "open");
    assert.equal(created.focusArea, "inventory");

    const openA = await listOpenFloorNotes("restaurant-a");
    const openB = await listOpenFloorNotes("restaurant-b");
    assert.equal(openA.length, 1);
    assert.equal(openA[0]!.id, created.id);
    assert.deepEqual(openB, []);
  } finally {
    restore();
  }
});

test("completeFloorNote marks a note done and removes it from open list", async () => {
  const restore = setFloorNoteStorageForTesting(memoryStorage());
  try {
    const created = await createFloorNote({
      restaurantId: "restaurant-a",
      title: "Sweep line",
      timing: "up_next",
      now: "2026-08-01T12:00:00.000Z"
    });

    const completed = await completeFloorNote({
      restaurantId: "restaurant-a",
      noteId: created.id,
      now: "2026-08-01T13:00:00.000Z"
    });

    assert.equal(completed?.status, "done");
    assert.equal(completed?.completedAt, "2026-08-01T13:00:00.000Z");
    assert.deepEqual(await listOpenFloorNotes("restaurant-a"), []);

    const all = await listFloorNotes("restaurant-a");
    assert.equal(all.length, 1);
    assert.equal(all[0]!.status, "done");
  } finally {
    restore();
  }
});

test("createFloorNote rejects blank titles", async () => {
  const restore = setFloorNoteStorageForTesting(memoryStorage());
  try {
    await assert.rejects(
      () =>
        createFloorNote({
          restaurantId: "restaurant-a",
          title: "   ",
          timing: "later"
        }),
      /title is required/i
    );
  } finally {
    restore();
  }
});

test("floorNoteFocusRoute maps optional focus areas", () => {
  assert.equal(floorNoteFocusRoute("inventory"), "/inventory");
  assert.equal(floorNoteFocusRoute("orders"), "/orders");
  assert.equal(floorNoteFocusRoute("insights"), "/insights");
  assert.equal(floorNoteFocusRoute("ask"), "/ask-mise");
  assert.equal(floorNoteFocusRoute(null), null);
});

test("createOperatorTask stores priority, dueAt, and defaults timing without due", async () => {
  const restore = setFloorNoteStorageForTesting(memoryStorage());
  try {
    const created = await createOperatorTask({
      restaurantId: "restaurant-a",
      title: "Count oysters",
      body: "Walk-in shelf B\nCheck temp",
      priority: "urgent",
      dueAt: "2026-08-05",
      now: "2026-08-01T12:00:00.000Z"
    });

    assert.match(created.id, /^operator_task_/);
    assert.equal(created.priority, "urgent");
    assert.equal(created.dueAt, "2026-08-05T00:00:00.000Z");
    assert.equal(created.body, "Walk-in shelf B\nCheck temp");
    assert.equal(created.note, created.body);
    assert.equal(created.timing, "later");

    const withoutDue = await createOperatorTask({
      restaurantId: "restaurant-a",
      title: "Wipe boards",
      now: "2026-08-01T12:01:00.000Z"
    });
    assert.equal(withoutDue.timing, "now");
    assert.equal(withoutDue.priority, "normal");
    assert.equal(withoutDue.dueAt, null);
  } finally {
    restore();
  }
});

test("reopenOperatorTask restores a completed task to open", async () => {
  const restore = setFloorNoteStorageForTesting(memoryStorage());
  try {
    const created = await createOperatorTask({
      restaurantId: "restaurant-a",
      title: "Prep garnish",
      priority: "high",
      timing: "up_next",
      now: "2026-08-01T12:00:00.000Z"
    });

    await completeOperatorTask({
      restaurantId: "restaurant-a",
      taskId: created.id,
      now: "2026-08-01T13:00:00.000Z"
    });
    assert.deepEqual(await listOpenOperatorTasks("restaurant-a"), []);

    const reopened = await reopenOperatorTask({
      restaurantId: "restaurant-a",
      taskId: created.id
    });
    assert.equal(reopened?.status, "open");
    assert.equal(reopened?.completedAt, null);

    const open = await listOpenOperatorTasks("restaurant-a");
    assert.equal(open.length, 1);
    assert.equal(open[0]!.id, created.id);
  } finally {
    restore();
  }
});

test("migrates legacy floor-notes storage into operator-tasks v1", async () => {
  const legacyNote = {
    id: "floor_note_legacy",
    restaurantId: "restaurant-a",
    title: "Legacy note",
    note: "From old key",
    timing: "now",
    focusArea: "orders",
    status: "open",
    createdAt: "2026-07-01T10:00:00.000Z",
    completedAt: null
  };
  const storage = memoryStorage({
    "mise.floor-notes.v1:restaurant-a": JSON.stringify([legacyNote])
  });
  const restore = setFloorNoteStorageForTesting(storage);
  try {
    const listed = await listOperatorTasks("restaurant-a");
    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.id, "floor_note_legacy");
    assert.equal(listed[0]!.body, "From old key");
    assert.equal(listed[0]!.note, "From old key");
    assert.equal(listed[0]!.priority, "normal");
    assert.equal(listed[0]!.dueAt, null);

    const v1Raw = await storage.getItem("mise.operator-tasks.v1:restaurant-a");
    assert.ok(v1Raw);
    const parsed = JSON.parse(v1Raw!) as Array<{ body: string; priority: string }>;
    assert.equal(parsed[0]!.body, "From old key");
    assert.equal(parsed[0]!.priority, "normal");
  } finally {
    restore();
  }
});

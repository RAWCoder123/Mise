import AsyncStorage from "@react-native-async-storage/async-storage";

import { createId } from "../domain/miseDomain";

/**
 * Operator tasks stored on-device.
 * These are intentionally separate from OperationalTodayTask projections,
 * which are never independently persisted.
 *
 * Legacy floor-note storage (`mise.floor-notes.v1`) is migrated on read.
 */
export type OperatorTaskTiming = "now" | "up_next" | "later";
export type OperatorTaskFocusArea = "inventory" | "orders" | "insights" | "ask";
export type OperatorTaskStatus = "open" | "done";
export type OperatorTaskPriority = "urgent" | "high" | "normal" | "low";

export type FloorNoteTiming = OperatorTaskTiming;
export type FloorNoteFocusArea = OperatorTaskFocusArea;
export type FloorNoteStatus = OperatorTaskStatus;

export interface OperatorTask {
  id: string;
  restaurantId: string;
  title: string;
  /** Free-text description; newlines preserved. */
  body: string | null;
  /** Alias of `body` for floor-note migration / callers. */
  note: string | null;
  priority: OperatorTaskPriority;
  dueAt: string | null;
  timing: OperatorTaskTiming;
  focusArea: OperatorTaskFocusArea | null;
  status: OperatorTaskStatus;
  createdAt: string;
  completedAt: string | null;
}

/** Floor notes are operator tasks with the legacy `note` field (= body). */
export type FloorNote = OperatorTask;

export interface CreateOperatorTaskInput {
  restaurantId: string;
  title: string;
  body?: string | null;
  /** Alias of body. */
  note?: string | null;
  priority?: OperatorTaskPriority;
  dueAt?: string | null;
  timing?: OperatorTaskTiming;
  focusArea?: OperatorTaskFocusArea | null;
  now?: string;
}

export interface CreateFloorNoteInput {
  restaurantId: string;
  title: string;
  note?: string | null;
  timing: FloorNoteTiming;
  focusArea?: FloorNoteFocusArea | null;
  now?: string;
}

export interface OperatorTaskStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type FloorNoteStorage = OperatorTaskStorage;

const STORAGE_PREFIX_V1 = "mise.operator-tasks.v1";
const STORAGE_PREFIX_LEGACY = "mise.floor-notes.v1";
const TITLE_MAX = 120;
const BODY_MAX = 2000;

let activeStorage: OperatorTaskStorage = AsyncStorage;
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const pending = writeQueue.then(operation, operation);
  writeQueue = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
}

function storageKeyV1(restaurantId: string) {
  return `${STORAGE_PREFIX_V1}:${restaurantId.trim()}`;
}

function storageKeyLegacy(restaurantId: string) {
  return `${STORAGE_PREFIX_LEGACY}:${restaurantId.trim()}`;
}

export function normalizeOperatorTaskTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, TITLE_MAX);
}

/** Alias kept for existing callers/tests. */
export const normalizeFloorNoteTitle = normalizeOperatorTaskTitle;

/**
 * Preserve newlines in body; only trim ends and collapse runs of spaces/tabs
 * on each line (not across line breaks).
 */
export function normalizeOperatorTaskBody(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.replace(/^\s+/, "").replace(/\s+$/, "");
  if (!trimmed) return null;
  const normalized = trimmed
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").replace(/^ +| +$/g, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  if (!normalized) return null;
  return normalized.slice(0, BODY_MAX);
}

/** Alias: same newline-preserving body normalize. */
export const normalizeFloorNoteBody = normalizeOperatorTaskBody;

export function isOperatorTaskTiming(value: unknown): value is OperatorTaskTiming {
  return value === "now" || value === "up_next" || value === "later";
}

export const isFloorNoteTiming = isOperatorTaskTiming;

export function isOperatorTaskFocusArea(value: unknown): value is OperatorTaskFocusArea {
  return value === "inventory" || value === "orders" || value === "insights" || value === "ask";
}

export const isFloorNoteFocusArea = isOperatorTaskFocusArea;

export function isOperatorTaskPriority(value: unknown): value is OperatorTaskPriority {
  return value === "urgent" || value === "high" || value === "normal" || value === "low";
}

export function operatorTaskFocusRoute(focusArea: OperatorTaskFocusArea | null): string | null {
  if (focusArea === "inventory") return "/inventory";
  if (focusArea === "orders") return "/orders";
  if (focusArea === "insights") return "/insights";
  if (focusArea === "ask") return "/ask-mise";
  return null;
}

export const floorNoteFocusRoute = operatorTaskFocusRoute;

function requireRestaurantId(restaurantId: string) {
  const normalized = restaurantId.trim();
  if (!normalized) throw new Error("Missing restaurant workspace.");
  return normalized;
}

function normalizeDueAt(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept date-only YYYY-MM-DD as start-of-day UTC, or full ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const iso = `${trimmed}T00:00:00.000Z`;
    if (!Number.isFinite(Date.parse(iso))) return null;
    return iso;
  }
  if (!Number.isFinite(Date.parse(trimmed))) return null;
  return new Date(trimmed).toISOString();
}

function coerceBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return normalizeOperatorTaskBody(value);
}

function migrateLegacyRecord(value: unknown, restaurantId: string): OperatorTask | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.restaurantId !== "string") return null;
  if (raw.restaurantId !== restaurantId) return null;
  if (typeof raw.title !== "string") return null;
  if (!isOperatorTaskTiming(raw.timing)) return null;
  if (!(raw.focusArea === null || isOperatorTaskFocusArea(raw.focusArea))) return null;
  if (!(raw.status === "open" || raw.status === "done")) return null;
  if (typeof raw.createdAt !== "string") return null;
  if (!(raw.completedAt === null || typeof raw.completedAt === "string")) return null;

  const body =
    coerceBody(raw.body) ??
    (raw.note === null || typeof raw.note === "string" ? coerceBody(raw.note) : null);

  return {
    id: raw.id,
    restaurantId: raw.restaurantId,
    title: normalizeOperatorTaskTitle(raw.title) || raw.title.slice(0, TITLE_MAX),
    body,
    note: body,
    priority: isOperatorTaskPriority(raw.priority) ? raw.priority : "normal",
    dueAt: normalizeDueAt(typeof raw.dueAt === "string" ? raw.dueAt : null),
    timing: raw.timing,
    focusArea: raw.focusArea,
    status: raw.status,
    createdAt: raw.createdAt,
    completedAt: raw.completedAt
  };
}

function isOperatorTask(value: unknown): value is OperatorTask {
  if (!value || typeof value !== "object") return false;
  const task = value as OperatorTask;
  const body =
    task.body === null || typeof task.body === "string"
      ? task.body
      : task.note === null || typeof task.note === "string"
        ? task.note
        : undefined;
  if (body === undefined) return false;
  return (
    typeof task.id === "string" &&
    typeof task.restaurantId === "string" &&
    typeof task.title === "string" &&
    isOperatorTaskPriority(task.priority) &&
    (task.dueAt === null || typeof task.dueAt === "string") &&
    isOperatorTaskTiming(task.timing) &&
    (task.focusArea === null || isOperatorTaskFocusArea(task.focusArea)) &&
    (task.status === "open" || task.status === "done") &&
    typeof task.createdAt === "string" &&
    (task.completedAt === null || typeof task.completedAt === "string")
  );
}

function normalizeTaskRecord(value: unknown, restaurantId: string): OperatorTask | null {
  if (isOperatorTask(value) && value.restaurantId === restaurantId) {
    const body = value.body ?? value.note ?? null;
    return { ...value, body, note: body };
  }
  return migrateLegacyRecord(value, restaurantId);
}

function parseTasks(raw: string, restaurantId: string): OperatorTask[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => normalizeTaskRecord(entry, restaurantId))
    .filter((task): task is OperatorTask => task != null)
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id)
    );
}

async function readTasks(restaurantId: string): Promise<OperatorTask[]> {
  const v1Key = storageKeyV1(restaurantId);
  const v1Raw = await activeStorage.getItem(v1Key);
  if (v1Raw !== null) {
    return parseTasks(v1Raw, restaurantId);
  }

  const legacyRaw = await activeStorage.getItem(storageKeyLegacy(restaurantId));
  if (legacyRaw === null) return [];

  const migrated = parseTasks(legacyRaw, restaurantId);
  if (migrated.length > 0) {
    await activeStorage.setItem(v1Key, JSON.stringify(migrated));
  }
  return migrated;
}

async function writeTasks(restaurantId: string, tasks: OperatorTask[]) {
  await activeStorage.setItem(storageKeyV1(restaurantId), JSON.stringify(tasks));
}

export async function listOperatorTasks(restaurantId: string): Promise<OperatorTask[]> {
  const normalized = requireRestaurantId(restaurantId);
  return enqueue(() => readTasks(normalized));
}

export async function listFloorNotes(restaurantId: string): Promise<FloorNote[]> {
  return listOperatorTasks(restaurantId);
}

export async function listOpenOperatorTasks(restaurantId: string): Promise<OperatorTask[]> {
  const tasks = await listOperatorTasks(restaurantId);
  return tasks.filter((task) => task.status === "open");
}

export async function listOpenFloorNotes(restaurantId: string): Promise<FloorNote[]> {
  return listOpenOperatorTasks(restaurantId);
}

export async function createOperatorTask(input: CreateOperatorTaskInput): Promise<OperatorTask> {
  const restaurantId = requireRestaurantId(input.restaurantId);
  const title = normalizeOperatorTaskTitle(input.title);
  if (!title) throw new Error("Operator task title is required.");

  const dueAt = normalizeDueAt(input.dueAt);
  const timingInput = input.timing;
  const timing: OperatorTaskTiming =
    timingInput != null && isOperatorTaskTiming(timingInput)
      ? timingInput
      : dueAt
        ? "later"
        : "now";

  const priority =
    input.priority != null && isOperatorTaskPriority(input.priority) ? input.priority : "normal";

  const focusArea =
    input.focusArea == null || input.focusArea === undefined
      ? null
      : isOperatorTaskFocusArea(input.focusArea)
        ? input.focusArea
        : null;

  const body = normalizeOperatorTaskBody(input.body ?? input.note);

  const task: OperatorTask = {
    id: createId("operator_task"),
    restaurantId,
    title,
    body,
    note: body,
    priority,
    dueAt,
    timing,
    focusArea,
    status: "open",
    createdAt: input.now ?? new Date().toISOString(),
    completedAt: null
  };

  return enqueue(async () => {
    const existing = await readTasks(restaurantId);
    const next = [task, ...existing];
    await writeTasks(restaurantId, next);
    return task;
  });
}

export async function createFloorNote(input: CreateFloorNoteInput): Promise<FloorNote> {
  const restaurantId = requireRestaurantId(input.restaurantId);
  const title = normalizeOperatorTaskTitle(input.title);
  if (!title) throw new Error("Floor note title is required.");
  if (!isOperatorTaskTiming(input.timing)) throw new Error("Floor note timing is invalid.");

  const focusArea =
    input.focusArea == null || input.focusArea === undefined
      ? null
      : isOperatorTaskFocusArea(input.focusArea)
        ? input.focusArea
        : null;

  const body = normalizeOperatorTaskBody(input.note);

  const note: FloorNote = {
    id: createId("floor_note"),
    restaurantId,
    title,
    body,
    note: body,
    priority: "normal",
    dueAt: null,
    timing: input.timing,
    focusArea,
    status: "open",
    createdAt: input.now ?? new Date().toISOString(),
    completedAt: null
  };

  return enqueue(async () => {
    const existing = await readTasks(restaurantId);
    const next = [note, ...existing];
    await writeTasks(restaurantId, next);
    return note;
  });
}

export async function completeOperatorTask(input: {
  restaurantId: string;
  taskId: string;
  now?: string;
}): Promise<OperatorTask | null> {
  const restaurantId = requireRestaurantId(input.restaurantId);
  const taskId = input.taskId.trim();
  if (!taskId) throw new Error("Missing operator task id.");

  return enqueue(async () => {
    const existing = await readTasks(restaurantId);
    const index = existing.findIndex((candidate) => candidate.id === taskId);
    if (index < 0) return null;
    const current = existing[index]!;
    if (current.status === "done") return current;
    const completed: OperatorTask = {
      ...current,
      status: "done",
      completedAt: input.now ?? new Date().toISOString()
    };
    const next = [...existing];
    next[index] = completed;
    await writeTasks(restaurantId, next);
    return completed;
  });
}

export async function completeFloorNote(input: {
  restaurantId: string;
  noteId: string;
  now?: string;
}): Promise<FloorNote | null> {
  return completeOperatorTask({
    restaurantId: input.restaurantId,
    taskId: input.noteId,
    now: input.now
  });
}

export async function reopenOperatorTask(input: {
  restaurantId: string;
  taskId: string;
}): Promise<OperatorTask | null> {
  const restaurantId = requireRestaurantId(input.restaurantId);
  const taskId = input.taskId.trim();
  if (!taskId) throw new Error("Missing operator task id.");

  return enqueue(async () => {
    const existing = await readTasks(restaurantId);
    const index = existing.findIndex((candidate) => candidate.id === taskId);
    if (index < 0) return null;
    const current = existing[index]!;
    if (current.status === "open") return current;
    const reopened: OperatorTask = {
      ...current,
      status: "open",
      completedAt: null
    };
    const next = [...existing];
    next[index] = reopened;
    await writeTasks(restaurantId, next);
    return reopened;
  });
}

/** Test-only seam for deterministic in-memory storage. */
export function setOperatorTaskStorageForTesting(storage: OperatorTaskStorage) {
  const previous = activeStorage;
  activeStorage = storage;
  writeQueue = Promise.resolve();
  return () => {
    activeStorage = previous;
    writeQueue = Promise.resolve();
  };
}

export const setFloorNoteStorageForTesting = setOperatorTaskStorageForTesting;

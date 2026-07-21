import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createInitialDemoState,
  DEMO_DATASET,
  repairDemoState,
  type DemoSetupProfile,
  type DemoState,
  type StoredDemoState
} from "./demoData";
import type { PosProvider } from "../types/mise";

const STORAGE_KEY = "mise:demo-store:v1";
let demoStoreQueue: Promise<unknown> = Promise.resolve();

function enqueueDemoStoreOperation<T>(operation: () => Promise<T>): Promise<T> {
  const pending = demoStoreQueue.then(operation, operation);
  demoStoreQueue = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
}

async function readDemoStateUnqueued(): Promise<DemoState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = createInitialDemoState(DEMO_DATASET.defaultPosProvider, { preset: DEMO_DATASET.id });
    await writeDemoStateUnqueued(seeded);
    return seeded;
  }

  try {
    const repaired = repairDemoState(JSON.parse(raw) as StoredDemoState);
    if (repaired.migrated) await writeDemoStateUnqueued(repaired.state);
    return repaired.state;
  } catch {
    const seeded = createInitialDemoState(DEMO_DATASET.defaultPosProvider, { preset: DEMO_DATASET.id });
    await writeDemoStateUnqueued(seeded);
    return seeded;
  }
}

async function writeDemoStateUnqueued(state: DemoState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function readDemoState() {
  return enqueueDemoStoreOperation(readDemoStateUnqueued);
}

export async function writeDemoState(state: DemoState) {
  return enqueueDemoStoreOperation(() => writeDemoStateUnqueued(state));
}

/**
 * Serializes every demo read-modify-write transaction. AsyncStorage does not
 * provide compare-and-swap, so without this queue two quick approvals can both
 * read the same snapshot and the last write silently drops the first action.
 */
export async function mutateDemoState<T>(mutation: (state: DemoState) => T | Promise<T>): Promise<T> {
  return enqueueDemoStoreOperation(async () => {
    const state = await readDemoStateUnqueued();
    const result = await mutation(state);
    await writeDemoStateUnqueued(state);
    return result;
  });
}

export async function resetDemoStore(
  provider: PosProvider | null = DEMO_DATASET.defaultPosProvider,
  setupProfile?: DemoSetupProfile,
  prepare?: (state: DemoState) => void | Promise<void>
) {
  return enqueueDemoStoreOperation(async () => {
    const seeded = createInitialDemoState(provider, setupProfile);
    await prepare?.(seeded);
    await writeDemoStateUnqueued(seeded);
    return seeded;
  });
}

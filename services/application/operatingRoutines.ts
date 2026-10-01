import {
  buildOperatingRoutineDrafts,
  getOperatingRoutine,
  listOperatingRoutines,
  planOperatingRoutineMaterialization,
  type MaterializeOperatingRoutinePlan,
  type OperatingRoutineDefinition,
  type OperatingRoutineId
} from "../domain/operatingRoutines";
import type { RestaurantTask } from "../domain/restaurantTasks";
import { canManageRestaurantData } from "../tenantAccess";
import {
  createSharedRestaurantTask,
  listSharedRestaurantTasks
} from "./restaurantTasks";
import type { RestaurantMembership } from "../../types/mise";

export type {
  MaterializeOperatingRoutinePlan,
  OperatingRoutineDefinition,
  OperatingRoutineId
} from "../domain/operatingRoutines";

export function fetchOperatingRoutineDefinitions(): OperatingRoutineDefinition[] {
  return listOperatingRoutines();
}

export function fetchOperatingRoutineDefinition(
  routineId: OperatingRoutineId
): OperatingRoutineDefinition {
  return getOperatingRoutine(routineId);
}

export interface MaterializeOperatingRoutineResult {
  plan: MaterializeOperatingRoutinePlan;
  created: RestaurantTask[];
  skippedExisting: number;
}

export async function materializeOperatingRoutine(input: {
  restaurantId: string;
  routineId: OperatingRoutineId;
  operatingDate: string;
  memberships: readonly RestaurantMembership[];
}): Promise<MaterializeOperatingRoutineResult> {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Missing restaurant workspace.");
  if (!canManageRestaurantData([...input.memberships], restaurantId)) {
    throw new Error("Only owners, admins, or managers can add operating routines.");
  }

  const existingTasks = await listSharedRestaurantTasks(restaurantId, {
    includeCompleted: true
  });
  const plan = planOperatingRoutineMaterialization({
    restaurantId,
    routineId: input.routineId,
    operatingDate: input.operatingDate,
    existingTasks
  });

  const created: RestaurantTask[] = [];
  for (const draft of plan.create) {
    const {
      routineId: _routineId,
      stepKey: _stepKey,
      ...createInput
    } = draft;
    const task = await createSharedRestaurantTask(createInput);
    if (task.restaurantId !== restaurantId) {
      throw new Error("Created routine task failed restaurant scope validation.");
    }
    created.push(task);
  }

  return {
    plan,
    created,
    skippedExisting: plan.alreadyPresent.length
  };
}

export function previewOperatingRoutineDrafts(input: {
  restaurantId: string;
  routineId: OperatingRoutineId;
  operatingDate: string;
}) {
  return buildOperatingRoutineDrafts(input);
}

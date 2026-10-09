import type {
  CompleteRestaurantTaskInput,
  CreateRestaurantTaskInput,
  RestaurantTask
} from "../domain/restaurantTasks";
import { isOpenRestaurantTask } from "../domain/restaurantTasks";
import {
  requireCanonicalRestaurantTasksReopenRestaurantId,
  requireCanonicalRestaurantTasksWorkspaceId
} from "../domain/restaurantTasksRestaurantIdentity";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/** MISE-005LI: ASCII-C restaurant workspace identity for restaurant-task entry points. */
function requireRestaurantId(restaurantId: string) {
  return requireCanonicalRestaurantTasksWorkspaceId(restaurantId);
}

export type {
  CompleteRestaurantTaskInput,
  CreateRestaurantTaskInput,
  RestaurantTask,
  RestaurantTaskCategory,
  RestaurantTaskEvidence,
  RestaurantTaskOrigin,
  RestaurantTaskPriority,
  RestaurantTaskRequiredRole,
  RestaurantTaskServiceWindow,
  RestaurantTaskStatus,
  RestaurantTaskTimingBucket,
  RestaurantTaskVerificationMethod
} from "../domain/restaurantTasks";

export async function listSharedRestaurantTasks(
  restaurantId: string,
  options: { includeCompleted?: boolean } = {}
): Promise<RestaurantTask[]> {
  const normalizedRestaurantId = requireRestaurantId(restaurantId);
  const tasks = await repository.listRestaurantTasks(normalizedRestaurantId);
  if (tasks.some((task) => task.restaurantId !== normalizedRestaurantId)) {
    throw new Error("Restaurant tasks failed restaurant scope validation.");
  }
  const visible = options.includeCompleted ? tasks : tasks.filter(isOpenRestaurantTask);
  return visible.sort(compareRestaurantTasks);
}

export async function createSharedRestaurantTask(
  input: CreateRestaurantTaskInput
): Promise<RestaurantTask> {
  return repository.createRestaurantTask(input);
}

export async function completeSharedRestaurantTask(
  input: CompleteRestaurantTaskInput
): Promise<RestaurantTask> {
  return repository.completeRestaurantTask(input);
}

export async function reopenSharedRestaurantTask(
  restaurantId: string,
  taskId: string
): Promise<RestaurantTask> {
  const normalizedRestaurantId = requireCanonicalRestaurantTasksReopenRestaurantId(restaurantId);
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) {
    throw new Error("Restaurant and task are required.");
  }
  return repository.reopenRestaurantTask(normalizedRestaurantId, normalizedTaskId);
}

function compareRestaurantTasks(left: RestaurantTask, right: RestaurantTask) {
  const statusRank = (task: RestaurantTask) =>
    task.status === "could_not_verify" ? 0 : task.status === "blocked" ? 1 : task.status === "waiting" ? 2 : task.status === "in_progress" ? 3 : 4;
  const timingRank = (task: RestaurantTask) =>
    task.timingBucket === "now" ? 0 : task.timingBucket === "up_next" ? 1 : 2;
  const priorityRank = (task: RestaurantTask) =>
    task.priority === "urgent" ? 0 : task.priority === "high" ? 1 : task.priority === "normal" ? 2 : 3;
  return (
    statusRank(left) - statusRank(right) ||
    timingRank(left) - timingRank(right) ||
    priorityRank(left) - priorityRank(right) ||
    (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999") ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

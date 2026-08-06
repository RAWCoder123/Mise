import type {
  CompleteRestaurantTaskInput,
  CreateRestaurantTaskInput,
  RestaurantTask
} from "../domain/restaurantTasks";
import { isOpenRestaurantTask } from "../domain/restaurantTasks";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

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
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
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
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedTaskId = taskId.trim();
  if (!normalizedRestaurantId || !normalizedTaskId) {
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

import {
  filterActivities,
  groupRelatedActivities,
  summarizeActivityWindow,
  type ActivityFeedFilter,
  type ActivityEvent,
  type ActivityStory,
  type ActivityWindowSummary
} from "../domain/activityEvents";
import { requireCanonicalActivityWorkspaceId } from "../domain/activityRestaurantIdentity";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/** MISE-005LW: ASCII-C restaurant workspace identity for activity entry points. */
function requireRestaurantId(restaurantId: string) {
  return requireCanonicalActivityWorkspaceId(restaurantId);
}

export async function fetchActivityEvents(
  restaurantId: string,
  options: {
    since?: string;
    until?: string;
    limit?: number;
    filter?: ActivityFeedFilter;
    attentionOnly?: boolean;
  } = {}
): Promise<ActivityEvent[]> {
  const normalizedRestaurantId = requireRestaurantId(restaurantId);
  const events = await repository.listActivityEvents(normalizedRestaurantId, options);
  if (events.some((event) => event.restaurantId !== normalizedRestaurantId)) {
    throw new Error("Activity events failed restaurant scope validation.");
  }
  return options.filter && options.filter !== "all"
    ? filterActivities(events, options.filter)
    : events;
}

export async function fetchActivityStories(
  restaurantId: string,
  options: { since?: string; limit?: number } = {}
): Promise<ActivityStory[]> {
  const events = await fetchActivityEvents(restaurantId, options);
  return groupRelatedActivities(events);
}

export async function fetchActivityWindowSummary(
  restaurantId: string,
  since: string
): Promise<ActivityWindowSummary> {
  const events = await fetchActivityEvents(restaurantId, { since, limit: 200 });
  return summarizeActivityWindow(events, since);
}

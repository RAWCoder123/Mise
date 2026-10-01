/** Operator-controlled POS location sync authorization. */
export const POS_LOCATION_OPERATOR_STATUSES = ["active", "paused"] as const;

export type PosLocationOperatorStatus = (typeof POS_LOCATION_OPERATOR_STATUSES)[number];

export type PosLocationStatus = PosLocationOperatorStatus | "disconnected";

export function isPosLocationOperatorStatus(value: unknown): value is PosLocationOperatorStatus {
  return value === "active" || value === "paused";
}

export function isPosLocationStatus(value: unknown): value is PosLocationStatus {
  return value === "active" || value === "paused" || value === "disconnected";
}

export function requirePosLocationOperatorStatus(value: unknown): PosLocationOperatorStatus {
  if (!isPosLocationOperatorStatus(value)) {
    throw new Error("POS location status must be active or paused.");
  }
  return value;
}

import type {
  CreateRestaurantTaskInput,
  RestaurantTask,
  RestaurantTaskCategory,
  RestaurantTaskPriority,
  RestaurantTaskServiceWindow,
  RestaurantTaskVerificationMethod
} from "./restaurantTasks";

export type OperatingRoutineId = "opening" | "closing" | "food_safety";

export interface OperatingRoutineTemplateStep {
  key: string;
  title: string;
  detail: string;
  operationalCategory: RestaurantTaskCategory;
  priority: RestaurantTaskPriority;
  timingBucket: "now" | "up_next" | "later";
  serviceWindow: RestaurantTaskServiceWindow;
  verificationMethod: RestaurantTaskVerificationMethod;
  checklist: Array<{ type: string; label: string }>;
  requiredRole: "member" | "manager";
}

export interface OperatingRoutineDefinition {
  id: OperatingRoutineId;
  title: string;
  summary: string;
  steps: readonly OperatingRoutineTemplateStep[];
}

export interface OperatingRoutineDraft extends CreateRestaurantTaskInput {
  routineId: OperatingRoutineId;
  stepKey: string;
}

export interface MaterializeOperatingRoutinePlan {
  routineId: OperatingRoutineId;
  operatingDate: string;
  create: OperatingRoutineDraft[];
  alreadyPresent: OperatingRoutineDraft[];
}

const OPERATING_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ROUTINES: readonly OperatingRoutineDefinition[] = [
  {
    id: "opening",
    title: "Opening routine",
    summary: "Prep-window checks that keep inventory, deliveries, and food safety ready before service.",
    steps: [
      {
        key: "walk_in_temps",
        title: "Record opening walk-in temperatures",
        detail:
          "Confirm cold storage is in range before prep starts. Capture each cooler reading on the checklist so the shift has evidence.",
        operationalCategory: "cleaning",
        priority: "high",
        timingBucket: "now",
        serviceWindow: "before_prep",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "Walk-in cooler temperature recorded" },
          { type: "checklist_item", label: "Reach-in / prep cooler temperature recorded" },
          { type: "checklist_item", label: "Any out-of-range unit flagged to a manager" }
        ],
        requiredRole: "member"
      },
      {
        key: "high_risk_count",
        title: "Count high-risk opening ingredients",
        detail:
          "Spot-count the ingredients that can stock out during first service. Use Inventory count when quantities need a ledger update.",
        operationalCategory: "inventory",
        priority: "high",
        timingBucket: "now",
        serviceWindow: "before_prep",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "High-risk items identified for this service" },
          { type: "checklist_item", label: "Physical counts compared to Mise on-hand" },
          { type: "checklist_item", label: "Material differences recorded as a count" }
        ],
        requiredRole: "member"
      },
      {
        key: "expected_deliveries",
        title: "Confirm expected morning deliveries",
        detail:
          "Review sent supplier orders due today and prepare receiving. Do not mark received until goods are verified.",
        operationalCategory: "deliveries",
        priority: "normal",
        timingBucket: "up_next",
        serviceWindow: "before_prep",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "Today’s expected deliveries listed" },
          { type: "checklist_item", label: "Receiving space and labels ready" },
          { type: "checklist_item", label: "Missing or late orders escalated" }
        ],
        requiredRole: "member"
      }
    ]
  },
  {
    id: "closing",
    title: "Closing routine",
    summary: "End-of-day waste, handoff, and delivery checks so tomorrow starts from truthful evidence.",
    steps: [
      {
        key: "log_waste",
        title: "Log closing waste before leaving",
        detail:
          "Record spoilage and trim on the inventory ledger while quantities are still known. Skip guessing overnight.",
        operationalCategory: "closing",
        priority: "high",
        timingBucket: "now",
        serviceWindow: "during_closing",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "Spoiled or discarded items identified" },
          { type: "checklist_item", label: "Waste quantities entered in Mise" },
          { type: "checklist_item", label: "Manager notified for unusual waste" }
        ],
        requiredRole: "member"
      },
      {
        key: "closing_walkthrough",
        title: "Complete closing walk-through",
        detail:
          "Verify stations are reset, labels are current, and open risks are written down for the next shift.",
        operationalCategory: "cleaning",
        priority: "normal",
        timingBucket: "now",
        serviceWindow: "during_closing",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "Prep stations cleaned and reset" },
          { type: "checklist_item", label: "Date labels checked on opened product" },
          { type: "checklist_item", label: "Open risks noted for tomorrow’s opening" }
        ],
        requiredRole: "member"
      },
      {
        key: "open_deliveries",
        title: "Reconcile open deliveries",
        detail:
          "Confirm whether remaining sent orders arrived, need follow-up, or should stay open as receive tasks.",
        operationalCategory: "deliveries",
        priority: "normal",
        timingBucket: "later",
        serviceWindow: "end_of_day",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "Open sent orders reviewed" },
          { type: "checklist_item", label: "Partial receives documented" },
          { type: "checklist_item", label: "Supplier follow-ups assigned" }
        ],
        requiredRole: "manager"
      }
    ]
  },
  {
    id: "food_safety",
    title: "Food safety checks",
    summary: "Shift food-safety evidence that stays checklist-verified and tenant-scoped.",
    steps: [
      {
        key: "sanitation_stations",
        title: "Verify sanitation stations",
        detail:
          "Confirm handwash and sanitizer stations are stocked and measurable before service peaks.",
        operationalCategory: "cleaning",
        priority: "high",
        timingBucket: "now",
        serviceWindow: "before_lunch",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "Handwash sinks stocked with soap and towels" },
          { type: "checklist_item", label: "Sanitizer concentration checked" },
          { type: "checklist_item", label: "Secondary containers labeled" }
        ],
        requiredRole: "member"
      },
      {
        key: "cold_holding",
        title: "Verify cold-holding temperatures",
        detail:
          "Check cold-holding units that protect ready-to-eat product. Escalate any reading outside the restaurant’s standard.",
        operationalCategory: "service",
        priority: "high",
        timingBucket: "now",
        serviceWindow: "before_lunch",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "Cold-holding temperatures recorded" },
          { type: "checklist_item", label: "Out-of-range product segregated" },
          { type: "checklist_item", label: "Manager reviewed exceptions" }
        ],
        requiredRole: "member"
      },
      {
        key: "hot_holding_discard",
        title: "Verify hot-holding and discard times",
        detail:
          "Confirm hot-holding product is time-marked and discard rules are being followed for this service.",
        operationalCategory: "service",
        priority: "normal",
        timingBucket: "up_next",
        serviceWindow: "before_dinner_service",
        verificationMethod: "checklist",
        checklist: [
          { type: "checklist_item", label: "Hot-holding temperatures recorded" },
          { type: "checklist_item", label: "Discard times marked on open product" },
          { type: "checklist_item", label: "Expired product discarded and logged" }
        ],
        requiredRole: "member"
      }
    ]
  }
];

export function listOperatingRoutines(): OperatingRoutineDefinition[] {
  return ROUTINES.map((routine) => ({
    ...routine,
    steps: routine.steps.map((step) => ({
      ...step,
      checklist: step.checklist.map((entry) => ({ ...entry }))
    }))
  }));
}

export function getOperatingRoutine(routineId: OperatingRoutineId): OperatingRoutineDefinition {
  const routine = ROUTINES.find((entry) => entry.id === routineId);
  if (!routine) {
    throw new Error("Unknown operating routine.");
  }
  return {
    ...routine,
    steps: routine.steps.map((step) => ({
      ...step,
      checklist: step.checklist.map((entry) => ({ ...entry }))
    }))
  };
}

export function normalizeOperatingDate(operatingDate: string): string {
  const normalized = operatingDate.trim();
  if (!OPERATING_DATE_RE.test(normalized)) {
    throw new Error("Operating date must be YYYY-MM-DD.");
  }
  return normalized;
}

export function operatingRoutineClientTaskId(
  routineId: OperatingRoutineId,
  stepKey: string,
  operatingDate: string
): string {
  const date = normalizeOperatingDate(operatingDate);
  const key = stepKey.trim();
  if (!key) throw new Error("Routine step key is required.");
  return `routine:${routineId}:${key}:${date}`;
}

export function operatingRoutineSourceReference(
  routineId: OperatingRoutineId,
  stepKey: string,
  operatingDate: string
): string {
  return operatingRoutineClientTaskId(routineId, stepKey, operatingDate);
}

export function buildOperatingRoutineDrafts(input: {
  restaurantId: string;
  routineId: OperatingRoutineId;
  operatingDate: string;
}): OperatingRoutineDraft[] {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Restaurant id is required.");
  const operatingDate = normalizeOperatingDate(input.operatingDate);
  const routine = getOperatingRoutine(input.routineId);

  return routine.steps.map((step) => ({
    routineId: routine.id,
    stepKey: step.key,
    restaurantId,
    clientTaskId: operatingRoutineClientTaskId(routine.id, step.key, operatingDate),
    title: step.title,
    detail: step.detail,
    origin: "mise",
    operationalCategory: step.operationalCategory,
    priority: step.priority,
    timingBucket: step.timingBucket,
    dueAt: null,
    serviceWindow: step.serviceWindow,
    requiredRole: step.requiredRole,
    verificationMethod: step.verificationMethod,
    checklist: step.checklist.map((entry) => ({ ...entry })),
    sourceReference: operatingRoutineSourceReference(routine.id, step.key, operatingDate)
  }));
}

export function planOperatingRoutineMaterialization(input: {
  restaurantId: string;
  routineId: OperatingRoutineId;
  operatingDate: string;
  existingTasks: readonly RestaurantTask[];
}): MaterializeOperatingRoutinePlan {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Restaurant id is required.");
  if (input.existingTasks.some((task) => task.restaurantId !== restaurantId)) {
    throw new Error("Existing tasks failed restaurant scope validation.");
  }

  const drafts = buildOperatingRoutineDrafts({
    restaurantId,
    routineId: input.routineId,
    operatingDate: input.operatingDate
  });
  const existingIds = new Set(
    input.existingTasks
      .filter((task) => task.restaurantId === restaurantId)
      .map((task) => task.clientTaskId)
  );

  const create: OperatingRoutineDraft[] = [];
  const alreadyPresent: OperatingRoutineDraft[] = [];
  for (const draft of drafts) {
    if (existingIds.has(draft.clientTaskId)) {
      alreadyPresent.push(draft);
    } else {
      create.push(draft);
    }
  }

  return {
    routineId: input.routineId,
    operatingDate: normalizeOperatingDate(input.operatingDate),
    create,
    alreadyPresent
  };
}

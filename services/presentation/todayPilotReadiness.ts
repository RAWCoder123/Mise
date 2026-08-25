import type { MessageKey } from "../../i18n/catalog";
import type {
  PilotReadiness,
  PilotReadinessAreaId
} from "../domain/pilotReadiness";

export type TodayPilotReadinessBannerKind =
  | "unavailable"
  | "blocked"
  | "attention"
  | "ready";

export type TodayPilotReadinessActionRoute =
  | "/settings/pos"
  | "/inventory"
  | "/settings/recipes"
  | "/settings/suppliers"
  | "/settings/gmail";

export interface TodayPilotReadinessAction {
  areaId: PilotReadinessAreaId;
  route: TodayPilotReadinessActionRoute;
  labelKey: MessageKey;
}

export interface TodayPilotReadinessGate {
  /** True only when readiness loaded and every area is ready. */
  operatingLoopReady: boolean;
  showBanner: boolean;
  bannerKind: TodayPilotReadinessBannerKind;
  /** Incomplete area ids for banner copy, highest-impact first. */
  attentionAreaIds: PilotReadinessAreaId[];
  /** Operator fix actions for incomplete areas (max one per area). */
  actions: TodayPilotReadinessAction[];
  /** Primary CTA route for the banner action button. */
  primaryRoute: TodayPilotReadinessActionRoute | null;
}

const AREA_ORDER: readonly PilotReadinessAreaId[] = [
  "pos_sales",
  "inventory_counts",
  "recipe_coverage",
  "supplier_routing",
  "email_delivery"
];

const AREA_ROUTES: Record<PilotReadinessAreaId, TodayPilotReadinessActionRoute> = {
  pos_sales: "/settings/pos",
  inventory_counts: "/inventory",
  recipe_coverage: "/settings/recipes",
  supplier_routing: "/settings/suppliers",
  email_delivery: "/settings/gmail"
};

const AREA_ACTION_LABEL_KEYS: Record<PilotReadinessAreaId, MessageKey> = {
  pos_sales: "today.readiness.action.pos",
  inventory_counts: "today.readiness.action.counts",
  recipe_coverage: "today.readiness.action.recipes",
  supplier_routing: "today.readiness.action.suppliers",
  email_delivery: "today.readiness.action.gmail"
};

/**
 * Fail-closed Today gate for pilot readiness.
 * Missing or failed readiness never claims the operating loop is ready, and
 * still surfaces reconnect / mapping / recipient repair work for incomplete areas.
 */
export function todayPilotReadinessGate(
  readiness: PilotReadiness | null,
  loadFailed: boolean
): TodayPilotReadinessGate {
  if (loadFailed || !readiness) {
    return {
      operatingLoopReady: false,
      showBanner: true,
      bannerKind: "unavailable",
      attentionAreaIds: [],
      actions: [],
      primaryRoute: "/settings/pos"
    };
  }

  const incomplete = AREA_ORDER.filter((id) => {
    const area = readiness.areas.find((candidate) => candidate.id === id);
    return !area || area.status !== "ready";
  });

  if (incomplete.length === 0) {
    return {
      operatingLoopReady: true,
      showBanner: false,
      bannerKind: "ready",
      attentionAreaIds: [],
      actions: [],
      primaryRoute: null
    };
  }

  const actions = incomplete.map((areaId) => ({
    areaId,
    route: AREA_ROUTES[areaId],
    labelKey: AREA_ACTION_LABEL_KEYS[areaId]
  }));

  const blocked = incomplete.some((id) => {
    const area = readiness.areas.find((candidate) => candidate.id === id);
    return area?.status === "blocked" || area?.status === "external";
  });

  return {
    operatingLoopReady: false,
    showBanner: true,
    bannerKind: blocked ? "blocked" : "attention",
    attentionAreaIds: incomplete,
    actions,
    primaryRoute: actions[0]?.route ?? "/settings/pos"
  };
}

export function todayPilotReadinessAreaLabelKey(areaId: PilotReadinessAreaId): MessageKey {
  switch (areaId) {
    case "pos_sales":
      return "pos.readiness.area.posSales";
    case "inventory_counts":
      return "pos.readiness.area.inventoryCounts";
    case "recipe_coverage":
      return "pos.readiness.area.recipeCoverage";
    case "supplier_routing":
      return "pos.readiness.area.supplierRouting";
    case "email_delivery":
      return "pos.readiness.area.emailDelivery";
  }
}

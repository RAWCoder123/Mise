import type { MessageKey } from "../../i18n/catalog";
import type {
  PilotReadiness,
  PilotReadinessAreaId
} from "../domain/pilotReadiness";

export type PilotRecommendUiBannerKind =
  | "unavailable"
  | "blocked_recommend"
  | "blocked_send"
  | "ready";

export interface PilotRecommendUiGate {
  canOneTapRecommend: boolean;
  showBanner: boolean;
  bannerKind: PilotRecommendUiBannerKind;
  /** Area ids that should appear in the operator banner copy. */
  attentionAreaIds: PilotReadinessAreaId[];
}

/** @deprecated Prefer PilotRecommendUiGate — kept for Home call-site clarity. */
export type HomePilotReadinessGate = PilotRecommendUiGate;
/** @deprecated Prefer PilotRecommendUiBannerKind. */
export type HomePilotReadinessBannerKind = PilotRecommendUiBannerKind;

const RECOMMENDATION_AREA_IDS: readonly PilotReadinessAreaId[] = [
  "pos_sales",
  "inventory_counts",
  "recipe_coverage"
];

const SEND_AREA_IDS: readonly PilotReadinessAreaId[] = [
  "supplier_routing",
  "email_delivery"
];

/**
 * Fail-closed operator gate for pilot readiness.
 * A missing or failed readiness load never permits one-tap recommendation approve.
 */
export function pilotRecommendUiGate(
  readiness: PilotReadiness | null,
  loadFailed: boolean
): PilotRecommendUiGate {
  if (loadFailed || !readiness) {
    return {
      canOneTapRecommend: false,
      showBanner: true,
      bannerKind: "unavailable",
      attentionAreaIds: []
    };
  }

  if (!readiness.canRecommend) {
    return {
      canOneTapRecommend: false,
      showBanner: true,
      bannerKind: "blocked_recommend",
      attentionAreaIds: incompleteAreas(readiness, RECOMMENDATION_AREA_IDS)
    };
  }

  if (!readiness.canSend) {
    return {
      canOneTapRecommend: true,
      showBanner: true,
      bannerKind: "blocked_send",
      attentionAreaIds: incompleteAreas(readiness, [
        ...RECOMMENDATION_AREA_IDS,
        ...SEND_AREA_IDS
      ])
    };
  }

  return {
    canOneTapRecommend: true,
    showBanner: false,
    bannerKind: "ready",
    attentionAreaIds: []
  };
}

/** Home / Orders alias for the shared fail-closed recommend gate. */
export const homePilotReadinessGate = pilotRecommendUiGate;

export function pilotReadinessAreaLabelKey(areaId: PilotReadinessAreaId): MessageKey {
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

/** @deprecated Prefer pilotReadinessAreaLabelKey. */
export const homePilotReadinessAreaLabelKey = pilotReadinessAreaLabelKey;

function incompleteAreas(
  readiness: PilotReadiness,
  areaIds: readonly PilotReadinessAreaId[]
): PilotReadinessAreaId[] {
  const byId = new Map(readiness.areas.map((area) => [area.id, area]));
  return areaIds.filter((id) => byId.get(id)?.status !== "ready");
}

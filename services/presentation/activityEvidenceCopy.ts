import { formatLocalizedNumber } from "../../i18n/formatters";
import { translate, type AppLocale } from "../../i18n/catalog";
import type {
  ActivityEvidenceReference,
  ActivityEvent,
  ActivityType
} from "../domain/activityEvents";

type EvidenceParent = Pick<ActivityEvent, "activityType" | "metadata">;

function metaString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function metaNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function formatQuantity(locale: AppLocale, value: number): string {
  return formatLocalizedNumber(locale, value, { maximumFractionDigits: 3 });
}

/**
 * Locale-aware Activity hub evidence-line summary.
 *
 * Prefer parent activityType + structured metadata so historical English
 * evidence rows still localize. Free-form recommendation reasons, finding
 * evidence, and business names (items/suppliers) stay as durable stored copy.
 * Complements #239 (evidence type labels) and #271 (event title/summary).
 */
export function presentActivityEvidenceSummary(
  locale: AppLocale,
  evidence: ActivityEvidenceReference,
  parent?: EvidenceParent | null
): string {
  if (!parent) return evidence.summary;

  const synthesized = synthesizeEvidenceSummary(locale, evidence, parent);
  return synthesized ?? evidence.summary;
}

function synthesizeEvidenceSummary(
  locale: AppLocale,
  evidence: ActivityEvidenceReference,
  parent: EvidenceParent
): string | null {
  const { activityType, metadata } = parent;
  const unit = metaString(metadata, "unit");
  const canonicalUnit = metaString(metadata, "canonicalUnit");
  const quantity = metaNumber(metadata, "quantity");
  const projectedQuantity = metaNumber(metadata, "projectedQuantity");
  const itemName = metaString(metadata, "itemName");

  switch (activityType as ActivityType) {
    case "inventory_count_recorded": {
      if (evidence.type === "inventory_item" && unit != null && quantity != null) {
        return translate(locale, "activity.evidence.current_quantity", {
          quantity: formatQuantity(locale, quantity),
          unit
        });
      }
      return null;
    }
    case "waste_analysis_completed": {
      const wasteUnit = canonicalUnit ?? unit;
      if (
        (evidence.type === "inventory_event" || evidence.type === "inventory_item") &&
        wasteUnit != null &&
        quantity != null
      ) {
        return translate(locale, "activity.evidence.waste_recorded", {
          quantity: formatQuantity(locale, quantity),
          unit: wasteUnit
        });
      }
      return null;
    }
    case "inventory_risk_detected": {
      if (
        evidence.type === "inventory_item" &&
        itemName != null &&
        projectedQuantity != null &&
        unit != null
      ) {
        return translate(locale, "activity.evidence.projected_quantity", {
          itemName,
          quantity: formatQuantity(locale, projectedQuantity),
          unit
        });
      }
      return null;
    }
    default:
      return null;
  }
}

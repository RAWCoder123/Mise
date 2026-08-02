/**
 * Stable, locale-neutral presentation descriptors for generated operational
 * copy. Domain code emits codes and raw values; screens choose the operator's
 * locale at render time. Restaurant, supplier, provider, menu, and item names
 * intentionally remain values so they are never translated.
 */

export type BusinessInsightType =
  | "sales"
  | "inventory"
  | "waste"
  | "cost"
  | "prep"
  | "ordering";

export const TODAY_TASK_PRESENTATION_CODES = [
  "today.recommendation.review",
  "today.recommendation.prepare_draft",
  "today.inventory.confirm_count",
  "today.inventory.resolve_stock",
  "today.inventory_count_session.begin",
  "today.inventory_count_session.continue",
  "today.inventory_count_session.approve",
  "today.order.send",
  "today.order.receive",
  "today.order.review",
  "today.setup.profile.open",
  "today.setup.profile.complete",
  "today.setup.inventory.open",
  "today.setup.inventory.complete",
  "today.setup.recipes.open",
  "today.setup.recipes.complete",
  "today.setup.email.connect",
  "today.setup.email.reconnect",
  "today.setup.email.complete",
  "today.integration.connect",
  "today.integration.connected",
  "today.integration.repair",
  "today.insight.review",
  "today.recipe.map_unmapped",
  "today.recipe.repair_incompatible_units",
  "today.ordering.chronic_short_ship",
  "today.waste.chronic_waste",
  "today.inventory.chronic_count_shrink"
] as const;

export const INSIGHT_PRESENTATION_CODES = [
  "insight.rule.inventory.stock_risk",
  "insight.rule.sales.demand_rising",
  "insight.rule.prep.low_stock",
  "insight.rule.waste.overstock",
  "insight.rule.waste.chronic_waste",
  "insight.rule.inventory.chronic_count_shrink",
  "insight.rule.ordering.chronic_short_ship",
  "insight.evidence.opaque"
] as const;

export const LEARNING_MEMORY_SIGNAL_PRESENTATION_CODES = [
  "memory.signal.recipe_coverage",
  "memory.signal.pos_depletion",
  "memory.signal.demand",
  "memory.signal.orders",
  "memory.signal.insights"
] as const;

export type TodayTaskPresentationDescriptor =
  | {
      code: "today.recommendation.review";
      values: { itemName: string; rawReason: string };
    }
  | {
      code: "today.recommendation.prepare_draft";
      values: { itemName: string; supplierName: string };
    }
  | {
      code: "today.inventory.confirm_count";
      values: { itemName: string; projectedQuantity: number; unit: string };
    }
  | {
      code: "today.inventory.resolve_stock";
      values: {
        itemName: string;
        projectedQuantity: number;
        unit: string;
        status: "Low" | "Critical";
      };
    }
  | {
      code: "today.inventory_count_session.begin";
      values: { riskItemCount: number };
    }
  | {
      code: "today.inventory_count_session.continue" | "today.inventory_count_session.approve";
      values: { status: string };
    }
  | {
      code: "today.order.send" | "today.order.receive" | "today.order.review";
      values: { supplierName: string; deliveryDate: string | null };
    }
  | {
      code:
        | "today.setup.profile.open"
        | "today.setup.profile.complete"
        | "today.setup.inventory.open"
        | "today.setup.inventory.complete"
        | "today.setup.recipes.open"
        | "today.setup.recipes.complete"
        | "today.setup.email.connect"
        | "today.setup.email.reconnect"
        | "today.setup.email.complete";
      /** Raw readiness detail remains available as evidence, not translation input. */
      values: { rawEvidence: string };
    }
  | {
      code: "today.integration.connect";
      values: Record<never, never>;
    }
  | {
      code: "today.integration.connected" | "today.integration.repair";
      values: {
        providerName: string;
        status: "not_connected" | "connected" | "paused" | "error";
        lastSyncAt: string | null;
      };
    }
  | {
      code: "today.insight.review";
      values: {
        insightType: BusinessInsightType;
        /** Opaque/manual or already-rendered source copy is retained as evidence. */
        rawTitle: string;
        rawEvidence: string;
      };
    }
  | {
      code: "today.recipe.map_unmapped";
      values: {
        unmappedCount: number;
        /** First sold menu item needing a recipe baseline; never translated. */
        sampleItemName: string | null;
      };
    }
  | {
      code: "today.recipe.repair_incompatible_units";
      values: {
        incompatibleCount: number;
        /** First menu item with a unit-incompatible recipe link; never translated. */
        sampleItemName: string | null;
      };
    }
  | {
      code: "today.ordering.chronic_short_ship";
      values: {
        itemName: string;
        supplierName: string;
        fillPercent: number;
        sampleCount: number;
      };
    }
  | {
      code: "today.waste.chronic_waste";
      values: {
        itemName: string;
        lossPercent: number;
        sampleCount: number;
      };
    }
  | {
      code: "today.inventory.chronic_count_shrink";
      values: {
        itemName: string;
        lossPercent: number;
        sampleCount: number;
      };
    };

export type InsightPresentationDescriptor =
  | {
      code: "insight.rule.inventory.stock_risk";
      values: {
        itemName: string;
        projectedQuantity: number;
        unit: string;
        supplierName: string;
        suggestedOrderQuantity: number;
        status: "Low" | "Critical";
      };
    }
  | {
      code: "insight.rule.sales.demand_rising";
      values: { itemName: string; liftPercent: number };
    }
  | {
      code: "insight.rule.prep.low_stock";
      values: { menuItemName: string; inventoryItemName: string; supplierName: string };
    }
  | {
      code: "insight.rule.waste.overstock";
      values: { itemName: string; quantity: number; unit: string };
    }
  | {
      code: "insight.rule.waste.chronic_waste";
      values: {
        itemName: string;
        lossPercent: number;
        sampleCount: number;
      };
    }
  | {
      code: "insight.rule.inventory.chronic_count_shrink";
      values: {
        itemName: string;
        lossPercent: number;
        sampleCount: number;
      };
    }
  | {
      code: "insight.rule.ordering.chronic_short_ship";
      values: {
        itemName: string;
        supplierName: string;
        fillPercent: number;
        sampleCount: number;
      };
    }
  | {
      code: "insight.evidence.opaque";
      values: {
        insightType: BusinessInsightType;
        rawTitle: string;
        rawDescription: string;
        rawWhyItMatters: string | null;
        rawRecommendedAction: string;
      };
    };

export type LearningMemoryLabelCode =
  | "memory.label.reliable"
  | "memory.label.building"
  | "memory.label.needs_proof";

export type LearningMemoryOperatorCopyCode =
  | "memory.copy.reliable"
  | "memory.copy.building";

export type LearningMemoryNextStepCode =
  | "memory.next.recipe_coverage"
  | "memory.next.demand_history"
  | "memory.next.send_approved"
  | "memory.next.first_order"
  | "memory.next.keep_counts_current";

export interface LearningMemoryPresentationDescriptor {
  labelCode: LearningMemoryLabelCode;
  operatorCopyCode: LearningMemoryOperatorCopyCode;
  nextStepCode: LearningMemoryNextStepCode;
}

export type LearningMemorySignalPresentationDescriptor =
  | {
      code: "memory.signal.recipe_coverage";
      values: { coveragePercent: number; ingredientMappings: number };
    }
  | {
      code: "memory.signal.pos_depletion";
      values: { itemCount: number };
    }
  | {
      code: "memory.signal.demand";
      values: { historyDays: number; menuPatternCount: number };
    }
  | {
      code: "memory.signal.orders";
      values: { decisionCount: number };
    }
  | {
      code: "memory.signal.insights";
      values: { signalCount: number };
    };

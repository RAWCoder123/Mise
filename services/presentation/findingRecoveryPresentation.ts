import type { MessageKey } from "../../i18n/catalog";
import type {
  FindingEvidenceReference,
  OperationalFinding
} from "../domain/operationalFindings";

export type FindingRecoveryHref =
  | "/inventory"
  | "/inventory/count"
  | `/inventory/${string}`
  | "/orders"
  | "/settings/recipes"
  | "/settings/sales-import"
  | "/setup";

export type FindingRecoveryLabelKey =
  | "dailyBrief.recovery.count"
  | "dailyBrief.recovery.inventoryItem"
  | "dailyBrief.recovery.inventoryHub"
  | "dailyBrief.recovery.orders"
  | "dailyBrief.recovery.recipes"
  | "dailyBrief.recovery.salesImport"
  | "dailyBrief.recovery.setup";

export interface FindingRecoveryAction {
  href: FindingRecoveryHref;
  labelKey: FindingRecoveryLabelKey;
  /** Stable reason code used for tests and dedupe; never shown to operators. */
  reason: string;
}

export type FindingMissingDataPresentation =
  | { kind: "known"; labelKey: MessageKey }
  | { kind: "mapping"; labelKey: MessageKey; name: string }
  | { kind: "raw"; code: string };

const MAX_RECOVERY_ACTIONS = 3;

type FindingRecoveryInput = Pick<
  OperationalFinding,
  "evidence" | "freshness" | "affectedWorkflow" | "category"
>;

/**
 * Maps a Daily Brief finding's missing-data codes and typed evidence to existing
 * operator recovery routes. Presentation-only: never invents facts or mutates
 * inventory, orders, or feedback.
 */
export function presentFindingRecoveryActions(
  finding: FindingRecoveryInput
): FindingRecoveryAction[] {
  const actions: FindingRecoveryAction[] = [];
  const seenHrefs = new Set<string>();

  const push = (action: FindingRecoveryAction | null) => {
    if (!action || seenHrefs.has(action.href) || actions.length >= MAX_RECOVERY_ACTIONS) {
      return;
    }
    seenHrefs.add(action.href);
    actions.push(action);
  };

  const inventoryItemId = firstEvidenceId(finding.evidence, "inventory_item");
  const inventoryHref = inventoryItemId
    ? (`/inventory/${encodeURIComponent(inventoryItemId)}` as const)
    : null;

  for (const code of finding.freshness.missingData) {
    push(recoveryForMissingDataCode(code, inventoryHref));
  }

  for (const entry of finding.evidence) {
    push(recoveryForEvidence(entry));
  }

  push(recoveryForWorkflow(finding.affectedWorkflow, inventoryHref));

  return actions;
}

/**
 * Localize machine missing-data codes for the Daily Brief card. Unknown codes
 * stay visible as raw tokens so operators still see the gap without inventing
 * a friendly label.
 */
export function presentFindingMissingDataLabels(
  missingData: readonly string[]
): FindingMissingDataPresentation[] {
  const labels: FindingMissingDataPresentation[] = [];
  const seen = new Set<string>();

  for (const code of missingData) {
    const normalized = code.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    if (normalized.startsWith("menu_mapping:")) {
      const name = normalized.slice("menu_mapping:".length).trim() || "menu item";
      labels.push({
        kind: "mapping",
        labelKey: "dailyBrief.missing.menu_mapping_named",
        name: name.slice(0, 80)
      });
      continue;
    }

    const knownKey = knownMissingDataLabelKey(normalized);
    if (knownKey) {
      labels.push({ kind: "known", labelKey: knownKey });
      continue;
    }

    labels.push({ kind: "raw", code: normalized.slice(0, 80) });
  }

  return labels.slice(0, 8);
}

export function formatFindingMissingDataLabels(
  missingData: readonly string[],
  t: (key: MessageKey, values?: Readonly<Record<string, string | number>>) => string
): string {
  return presentFindingMissingDataLabels(missingData)
    .map((entry) => {
      if (entry.kind === "known") return t(entry.labelKey);
      if (entry.kind === "mapping") return t(entry.labelKey, { name: entry.name });
      return entry.code;
    })
    .join(", ");
}

function knownMissingDataLabelKey(code: string): MessageKey | null {
  switch (code) {
    case "verified_physical_count":
      return "dailyBrief.missing.verified_physical_count";
    case "verified_canonical_unit":
      return "dailyBrief.missing.verified_canonical_unit";
    case "menu_mapping":
      return "dailyBrief.missing.menu_mapping";
    case "daily_sales":
      return "dailyBrief.missing.daily_sales";
    case "inventory_item":
      return "dailyBrief.missing.inventory_item";
    case "inventory_items":
      return "dailyBrief.missing.inventory_items";
    default:
      return null;
  }
}

function recoveryForMissingDataCode(
  code: string,
  inventoryHref: `/inventory/${string}` | null
): FindingRecoveryAction | null {
  const normalized = code.trim();
  if (!normalized) return null;

  if (normalized === "verified_physical_count") {
    return {
      href: "/inventory/count",
      labelKey: "dailyBrief.recovery.count",
      reason: "verified_physical_count"
    };
  }

  if (normalized === "verified_canonical_unit") {
    return inventoryHref
      ? {
          href: inventoryHref,
          labelKey: "dailyBrief.recovery.inventoryItem",
          reason: "verified_canonical_unit"
        }
      : {
          href: "/inventory",
          labelKey: "dailyBrief.recovery.inventoryHub",
          reason: "verified_canonical_unit"
        };
  }

  if (normalized === "menu_mapping" || normalized.startsWith("menu_mapping:")) {
    return {
      href: "/settings/recipes",
      labelKey: "dailyBrief.recovery.recipes",
      reason: "menu_mapping"
    };
  }

  if (normalized === "daily_sales") {
    return {
      href: "/settings/sales-import",
      labelKey: "dailyBrief.recovery.salesImport",
      reason: "daily_sales"
    };
  }

  if (normalized === "inventory_items") {
    return {
      href: "/setup",
      labelKey: "dailyBrief.recovery.setup",
      reason: "inventory_items"
    };
  }

  if (normalized === "inventory_item") {
    return {
      href: "/inventory",
      labelKey: "dailyBrief.recovery.inventoryHub",
      reason: "inventory_item"
    };
  }

  return null;
}

function recoveryForEvidence(
  entry: FindingEvidenceReference
): FindingRecoveryAction | null {
  switch (entry.type) {
    case "inventory_item": {
      const id = entry.id.trim();
      if (!id) return null;
      return {
        href: `/inventory/${encodeURIComponent(id)}`,
        labelKey: "dailyBrief.recovery.inventoryItem",
        reason: "evidence:inventory_item"
      };
    }
    case "purchase_recommendation":
      return {
        href: "/orders",
        labelKey: "dailyBrief.recovery.orders",
        reason: "evidence:purchase_recommendation"
      };
    case "pos_sale":
      return {
        href: "/settings/recipes",
        labelKey: "dailyBrief.recovery.recipes",
        reason: "evidence:pos_sale"
      };
    case "menu_mapping":
      return {
        href: "/settings/recipes",
        labelKey: "dailyBrief.recovery.recipes",
        reason: "evidence:menu_mapping"
      };
    case "data_gap":
      return null;
    case "insight":
      return null;
    default:
      return null;
  }
}

function recoveryForWorkflow(
  workflow: string,
  inventoryHref: `/inventory/${string}` | null
): FindingRecoveryAction | null {
  switch (workflow) {
    case "daily_sales_import":
      return {
        href: "/settings/sales-import",
        labelKey: "dailyBrief.recovery.salesImport",
        reason: "workflow:daily_sales_import"
      };
    case "inventory_setup":
      return {
        href: "/setup",
        labelKey: "dailyBrief.recovery.setup",
        reason: "workflow:inventory_setup"
      };
    case "recipe_mapping":
      return {
        href: "/settings/recipes",
        labelKey: "dailyBrief.recovery.recipes",
        reason: "workflow:recipe_mapping"
      };
    case "inventory_and_ordering":
      return {
        href: "/orders",
        labelKey: "dailyBrief.recovery.orders",
        reason: "workflow:inventory_and_ordering"
      };
    case "inventory":
      return inventoryHref
        ? {
            href: inventoryHref,
            labelKey: "dailyBrief.recovery.inventoryItem",
            reason: "workflow:inventory"
          }
        : {
            href: "/inventory",
            labelKey: "dailyBrief.recovery.inventoryHub",
            reason: "workflow:inventory"
          };
    default:
      return null;
  }
}

function firstEvidenceId(
  evidence: readonly FindingEvidenceReference[],
  type: FindingEvidenceReference["type"]
): string | null {
  const match = evidence.find((entry) => entry.type === type && entry.id.trim());
  return match?.id.trim() ?? null;
}

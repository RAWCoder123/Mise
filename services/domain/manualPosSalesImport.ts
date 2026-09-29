import { setupImportLimits, type SetupPosSaleDraft } from "./setupDrafts";
import { operatingLimits } from "../miseValidation";

export interface ManualPosSalesImportRow {
  restaurant_id: string;
  source_record_id: string;
  sale_date: string;
  item_name: string;
  category: string;
  quantity_sold: number;
  gross_sales: number;
  net_sales: number;
  source_pos: "Manual CSV Upload";
}

export interface ManualPosSalesImportSummary {
  posSalesRowsSaved: number;
  importId: string | null;
}

/**
 * Map validated CSV drafts into the durable Manual CSV Upload sale rows used by
 * the post-setup import RPC. Net sales keep the same bounded setup heuristic.
 */
export function planManualPosSalesImport(
  restaurantId: string,
  rows: readonly SetupPosSaleDraft[]
): ManualPosSalesImportRow[] {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) {
    throw new Error("Missing restaurant workspace.");
  }
  if (rows.length === 0) {
    throw new Error("Paste at least one valid sales row before importing.");
  }
  if (rows.length > setupImportLimits.rows) {
    throw new Error(`POS import is limited to ${setupImportLimits.rows.toLocaleString()} rows.`);
  }

  const planned: ManualPosSalesImportRow[] = [];
  const seenIds = new Set<string>();

  for (const sale of rows) {
    if (sale.sourcePos !== "Manual CSV Upload") {
      throw new Error("Only Manual CSV Upload rows can use this import path.");
    }
    const sourceRecordId = sale.id.trim();
    if (
      !sourceRecordId ||
      sourceRecordId.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(sourceRecordId)
    ) {
      throw new Error("POS sale identity is invalid.");
    }
    if (seenIds.has(sourceRecordId)) {
      throw new Error("POS import contains a duplicate sale identity.");
    }
    seenIds.add(sourceRecordId);

    const itemName = sale.itemName.trim();
    const category = sale.category.trim() || "Sales";
    const saleDate = sale.saleDate.trim();
    if (!itemName || itemName.length > 200) {
      throw new Error("POS item name is invalid.");
    }
    if (!category || category.length > 120) {
      throw new Error("POS category is invalid.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
      throw new Error("POS sale date must use YYYY-MM-DD.");
    }
    assertBoundedNumber(
      sale.quantitySold,
      Number.EPSILON,
      operatingLimits.posQuantitySold,
      "POS quantity sold"
    );
    assertBoundedNumber(sale.grossSales, 0, operatingLimits.posSalesAmount, "POS gross sales");

    const netSales = Math.round(sale.grossSales * 0.93 * 100) / 100;
    assertBoundedNumber(netSales, 0, operatingLimits.posSalesAmount, "POS net sales");

    planned.push({
      restaurant_id: normalizedRestaurantId,
      source_record_id: sourceRecordId,
      sale_date: saleDate,
      item_name: itemName,
      category,
      quantity_sold: sale.quantitySold,
      gross_sales: sale.grossSales,
      net_sales: netSales,
      source_pos: "Manual CSV Upload"
    });
  }

  return planned;
}

function assertBoundedNumber(value: unknown, minimum: number, maximum: number, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum.toLocaleString()}.`);
  }
}

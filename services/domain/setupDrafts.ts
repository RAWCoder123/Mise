import { operatingLimits } from "../miseValidation";

export const setupImportLimits = {
  characters: 256_000,
  rows: 1_000
} as const;

export type SetupStepId = "profile" | "inventory" | "recipes" | "email";

export interface SetupInventoryDraftItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  parLevel: string;
  supplier: string;
}

export interface SetupSupplierDraft {
  id: string;
  name: string;
  email: string;
}

export interface SetupRecipeIngredientDraft {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  /** Optional link to a setup inventory draft id when the operator picked a match. */
  inventoryItemId?: string | null;
}

export interface SetupRecipeDraft {
  id: string;
  dishName: string;
  ingredients: SetupRecipeIngredientDraft[];
}

export interface SetupAttachmentDraft {
  id: string;
  label: string;
  kind: "csv" | "screenshot";
  status: "queued" | "review_needed";
}

export interface SetupPosSaleDraft {
  id: string;
  saleDate: string;
  itemName: string;
  category: string;
  quantitySold: number;
  grossSales: number;
  sourcePos: "Manual CSV Upload";
}

export interface SetupImportValidationIssue {
  row: number;
  field: string;
  message: string;
}

export interface SetupPosSalesImportResult {
  status: "empty" | "ready" | "needs_review";
  rows: SetupPosSaleDraft[];
  issues: SetupImportValidationIssue[];
  acceptedRowCount: number;
  rejectedRowCount: number;
  metadataOnly: false;
}

export interface SetupDraftReadiness {
  profileReady: boolean;
  inventoryReady: boolean;
  recipesReady: boolean;
  emailReady: boolean;
  posSalesReady: boolean;
  currentStep: SetupStepId;
  missingTasks: string[];
}

export interface SetupPersistencePreview {
  inventoryItems: number;
  suppliers: number;
  recipeMappings: number;
  posSalesRows: number;
  attachmentMetadata: number;
  metadataOnlyAttachments: boolean;
}

export interface SetupPersistenceSummary {
  inventoryItemsSaved: number;
  supplierRecipientsSaved: number;
  recipeMappingsSaved: number;
  posSalesRowsSaved: number;
  attachmentMetadataSaved: number;
  skippedRecipeIngredients: number;
}

export interface SetupStarterDrafts {
  inventoryItems: SetupInventoryDraftItem[];
  suppliers: SetupSupplierDraft[];
  recipes: SetupRecipeDraft[];
}

export interface SetupDataHealthSummary {
  score: number;
  label: string;
  signals: Array<{ id: string; label: string; value: string; ready: boolean }>;
  nextBestAction: string;
}

export function buildSetupDraftReadiness({
  restaurantName,
  cuisineType,
  inventoryItems,
  suppliers,
  recipes,
  posSales,
  emailConnected
}: {
  restaurantName: string;
  cuisineType: string;
  inventoryItems: SetupInventoryDraftItem[];
  suppliers: SetupSupplierDraft[];
  recipes: SetupRecipeDraft[];
  posSales?: SetupPosSaleDraft[];
  emailConnected: boolean;
}): SetupDraftReadiness {
  const profileReady = Boolean(restaurantName.trim() && cuisineType.trim());
  const supplierReady = suppliers.some((supplier) => supplier.name.trim());
  const inventoryReady =
    supplierReady &&
    inventoryItems.filter((item) => item.name.trim() && item.quantity.trim() && item.unit.trim()).length >= 3;
  const recipesReady = recipes.some(
    (recipe) =>
      recipe.dishName.trim() &&
      recipe.ingredients.some((ingredient) => ingredient.itemName.trim() && ingredient.quantity.trim() && ingredient.unit.trim())
  );
  const posSalesReady = (posSales ?? []).length >= 3;
  const emailReady = emailConnected;
  const steps: Array<[SetupStepId, boolean]> = [
    ["profile", profileReady],
    ["inventory", inventoryReady],
    ["recipes", recipesReady],
    ["email", emailReady]
  ];
  const currentStep = steps.find(([, ready]) => !ready)?.[0] ?? "email";
  const missingTasks = [
    !profileReady ? "restaurant profile" : null,
    !inventoryReady ? "at least 3 inventory items with suppliers" : null,
    !recipesReady ? "ingredient-per-dish baselines" : null,
    !emailReady ? "restaurant Gmail sender" : null
  ].filter((task): task is string => Boolean(task));

  return {
    profileReady,
    inventoryReady,
    recipesReady,
    emailReady,
    posSalesReady,
    currentStep,
    missingTasks
  };
}

export function recipeDraftsToBaselineText(recipes: SetupRecipeDraft[]) {
  return recipes
    .map((recipe) => {
      const dishName = recipe.dishName.trim();
      const ingredientText = recipe.ingredients
        .map((ingredient) => {
          const itemName = ingredient.itemName.trim();
          const quantity = ingredient.quantity.trim();
          const unit = ingredient.unit.trim();
          if (!itemName || !quantity || !unit) return null;
          return `${itemName} ${quantity} ${unit}`;
        })
        .filter(Boolean)
        .join(", ");
      if (!dishName || !ingredientText) return null;
      return `${dishName}: ${ingredientText}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function buildSetupPersistencePreview({
  inventoryItems,
  suppliers,
  recipes,
  posSales,
  attachments
}: {
  inventoryItems: SetupInventoryDraftItem[];
  suppliers: SetupSupplierDraft[];
  recipes: SetupRecipeDraft[];
  posSales?: SetupPosSaleDraft[];
  attachments: SetupAttachmentDraft[];
}): SetupPersistencePreview {
  return {
    inventoryItems: inventoryItems.filter((item) => item.name.trim()).length,
    suppliers: suppliers.filter((supplier) => supplier.name.trim()).length,
    recipeMappings: recipes.reduce((count, recipe) => {
      if (!recipe.dishName.trim()) return count;
      return count + recipe.ingredients.filter((ingredient) =>
        ingredient.itemName.trim() && ingredient.quantity.trim() && ingredient.unit.trim()
      ).length;
    }, 0),
    posSalesRows: (posSales ?? []).length,
    attachmentMetadata: attachments.length,
    metadataOnlyAttachments: attachments.every((attachment) =>
      Boolean(attachment.id && attachment.label && (attachment.kind === "csv" || attachment.kind === "screenshot"))
    )
  };
}

export function buildSetupCompletionAuditMetadata(summary: SetupPersistenceSummary): Record<string, number> {
  return {
    inventory_items_saved: normalizeAuditCount(summary.inventoryItemsSaved),
    supplier_recipients_saved: normalizeAuditCount(summary.supplierRecipientsSaved),
    recipe_mappings_saved: normalizeAuditCount(summary.recipeMappingsSaved),
    pos_sales_rows_saved: normalizeAuditCount(summary.posSalesRowsSaved),
    attachment_metadata_saved: normalizeAuditCount(summary.attachmentMetadataSaved),
    skipped_recipe_ingredients: normalizeAuditCount(summary.skippedRecipeIngredients)
  };
}

export function parseSetupPosSalesCsv(input: string): SetupPosSalesImportResult {
  if (input.length > setupImportLimits.characters) {
    return rejectedSetupImport(
      `POS CSV is limited to ${setupImportLimits.characters.toLocaleString()} characters.`
    );
  }

  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      status: "empty",
      rows: [],
      issues: [],
      acceptedRowCount: 0,
      rejectedRowCount: 0,
      metadataOnly: false
    };
  }

  const firstCells = splitCsvLine(lines[0]!);
  const hasHeader = firstCells.some((cell) => normalizeHeader(cell) in headerAliases);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length > setupImportLimits.rows) {
    return rejectedSetupImport(
      `POS CSV is limited to ${setupImportLimits.rows.toLocaleString()} sales rows.`
    );
  }

  const headers = hasHeader ? firstCells.map(resolveHeader) : ["saleDate", "itemName", "category", "quantitySold", "grossSales"];
  const rows: SetupPosSaleDraft[] = [];
  const issues: SetupImportValidationIssue[] = [];
  const sourceOccurrences = new Map<string, number>();

  dataLines.forEach((line, index) => {
    const rowNumber = (hasHeader ? index + 2 : index + 1);
    const cells = splitCsvLine(line);
    const record = headers.reduce<Record<string, string>>((entry, header, cellIndex) => {
      if (header) entry[header] = cells[cellIndex]?.trim() ?? "";
      return entry;
    }, {});
    const rowIssues: SetupImportValidationIssue[] = [];
    const saleDate = normalizeSaleDate(record.saleDate ?? "");
    const itemName = (record.itemName ?? "").trim();
    const category = (record.category ?? "").trim() || "Sales";
    const quantitySold = parseSetupNumber(record.quantitySold ?? "");
    const grossSales = parseSetupNumber(record.grossSales ?? "");

    if (!saleDate) rowIssues.push({ row: rowNumber, field: "sale_date", message: "Use YYYY-MM-DD for the sale date." });
    if (!itemName) rowIssues.push({ row: rowNumber, field: "item_name", message: "Add the POS item or dish name." });
    if (!Number.isFinite(quantitySold) || quantitySold <= 0 || quantitySold > operatingLimits.posQuantitySold) {
      rowIssues.push({
        row: rowNumber,
        field: "quantity_sold",
        message: `Quantity must be between 0 and ${operatingLimits.posQuantitySold.toLocaleString()}.`
      });
    }
    if (!Number.isFinite(grossSales) || grossSales < 0 || grossSales > operatingLimits.posSalesAmount) {
      rowIssues.push({
        row: rowNumber,
        field: "gross_sales",
        message: `Gross sales must be between 0 and ${operatingLimits.posSalesAmount.toLocaleString()}.`
      });
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      return;
    }

    const roundedQuantity = roundOperatingNumber(quantitySold);
    const roundedSales = roundOperatingNumber(grossSales);
    if (!Number.isFinite(roundedQuantity) || !Number.isFinite(roundedSales)) {
      issues.push({ row: rowNumber, field: "values", message: "The rounded values are outside the supported range." });
      return;
    }

    const sourceFingerprint = setupPosSourceFingerprint([
      saleDate,
      itemName.trim().toLowerCase(),
      category.trim().toLowerCase(),
      String(roundedQuantity),
      String(roundedSales)
    ].join("\u001f"));
    const occurrence = (sourceOccurrences.get(sourceFingerprint) ?? 0) + 1;
    sourceOccurrences.set(sourceFingerprint, occurrence);
    rows.push({
      id: `pos_import_${sourceFingerprint}_${occurrence}`,
      saleDate,
      itemName,
      category,
      quantitySold: roundedQuantity,
      grossSales: roundedSales,
      sourcePos: "Manual CSV Upload"
    });
  });

  return {
    status: rows.length === 0 && issues.length === 0 ? "empty" : issues.length > 0 ? "needs_review" : "ready",
    rows,
    issues,
    acceptedRowCount: rows.length,
    rejectedRowCount: dataLines.length - rows.length,
    metadataOnly: false
  };
}

function setupPosSourceFingerprint(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function rejectedSetupImport(message: string): SetupPosSalesImportResult {
  return {
    status: "needs_review",
    rows: [],
    issues: [{ row: 0, field: "file", message }],
    acceptedRowCount: 0,
    rejectedRowCount: 0,
    metadataOnly: false
  };
}

export function buildSetupDataHealthSummary({
  restaurantName,
  cuisineType,
  inventoryItems,
  suppliers,
  recipes,
  posSales,
  emailConnected
}: {
  restaurantName: string;
  cuisineType: string;
  inventoryItems: SetupInventoryDraftItem[];
  suppliers: SetupSupplierDraft[];
  recipes: SetupRecipeDraft[];
  posSales: SetupPosSaleDraft[];
  emailConnected: boolean;
}): SetupDataHealthSummary {
  const profileReady = Boolean(restaurantName.trim() && cuisineType.trim());
  const inventoryCount = inventoryItems.filter((item) => item.name.trim() && item.quantity.trim() && item.unit.trim()).length;
  const supplierCount = suppliers.filter((supplier) => supplier.name.trim()).length;
  const recipeCount = recipes.filter((recipe) =>
    recipe.dishName.trim() &&
    recipe.ingredients.some((ingredient) => ingredient.itemName.trim() && ingredient.quantity.trim() && ingredient.unit.trim())
  ).length;
  const posRowCount = posSales.length;
  const signals = [
    { id: "profile", label: "Profile", value: profileReady ? "Ready" : "Missing", ready: profileReady },
    { id: "inventory", label: "Inventory", value: `${inventoryCount} items`, ready: inventoryCount >= 3 },
    { id: "suppliers", label: "Suppliers", value: `${supplierCount} suppliers`, ready: supplierCount >= 1 },
    { id: "recipes", label: "Recipes", value: `${recipeCount} dishes`, ready: recipeCount >= 1 },
    { id: "pos", label: "POS sales", value: posRowCount > 0 ? `${posRowCount} rows` : "Sample ready", ready: true },
    { id: "email", label: "Email", value: emailConnected ? "Connected" : "Setup later", ready: true }
  ];
  const score = Math.round((signals.filter((signal) => signal.ready).length / signals.length) * 100);
  const nextBestAction =
    !profileReady ? "Finish the restaurant profile." :
    inventoryCount < 3 ? "Add at least three starting inventory items." :
    supplierCount < 1 ? "Add the first supplier." :
    recipeCount < 1 ? "Map one dish to its ingredients." :
    posRowCount < 3 ? "Paste a few POS rows or use the local demo sample while testing." :
    "Open Today and review Mise's first recommendations.";

  return {
    score,
    label: score >= 84 ? "Demo-ready" : score >= 67 ? "Almost ready" : "Needs setup",
    signals,
    nextBestAction
  };
}

const headerAliases: Record<string, "saleDate" | "itemName" | "category" | "quantitySold" | "grossSales"> = {
  date: "saleDate",
  sale_date: "saleDate",
  saledate: "saleDate",
  day: "saleDate",
  item: "itemName",
  item_name: "itemName",
  itemname: "itemName",
  menu_item: "itemName",
  menuitem: "itemName",
  dish: "itemName",
  category: "category",
  qty: "quantitySold",
  quantity: "quantitySold",
  quantity_sold: "quantitySold",
  quantitysold: "quantitySold",
  sold: "quantitySold",
  gross: "grossSales",
  gross_sales: "grossSales",
  grosssales: "grossSales",
  sales: "grossSales",
  revenue: "grossSales"
};

function resolveHeader(value: string) {
  return headerAliases[normalizeHeader(value)] ?? null;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

function normalizeSaleDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && isExactCalendarDate(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, month, day, year] = match;
  const normalized = `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
  return isExactCalendarDate(normalized) ? normalized : "";
}

function isExactCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseSetupNumber(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function roundOperatingNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeAuditCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

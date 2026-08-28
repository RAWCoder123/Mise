export const MAX_INVENTORY_ITEMS_PER_RESTAURANT = 250;

export type InventoryItemCreateFields = {
  item_name: string;
  category: string;
  unit: string;
  current_quantity: number;
  par_level: number;
  reorder_threshold: number;
  estimated_unit_cost: number;
  supplier_id: string;
};

export type PlannedInventoryItemCreate = InventoryItemCreateFields & {
  eventType: "count";
  sourceWorkflow: "create_inventory_item";
  metadata: {
    created: true;
    item_name: string;
    category: string;
    unit: string;
    supplier_id: string;
  };
};

export function inventoryItemNameKey(itemName: string) {
  return itemName.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findDuplicateInventoryItemName(
  existingNames: readonly string[],
  candidateName: string
) {
  const key = inventoryItemNameKey(candidateName);
  if (!key) return null;
  return existingNames.find((name) => inventoryItemNameKey(name) === key) ?? null;
}

export function assertInventoryItemCreateCapacity(existingCount: number) {
  if (!Number.isInteger(existingCount) || existingCount < 0) {
    throw new Error("Inventory item count is invalid.");
  }
  if (existingCount >= MAX_INVENTORY_ITEMS_PER_RESTAURANT) {
    throw new Error(
      `This restaurant already has the maximum of ${MAX_INVENTORY_ITEMS_PER_RESTAURANT} inventory items.`
    );
  }
}

export function planInventoryItemCreate(input: InventoryItemCreateFields): PlannedInventoryItemCreate {
  const item_name = input.item_name.trim().replace(/\s+/g, " ");
  const category = input.category.trim().replace(/\s+/g, " ");
  const unit = input.unit.trim().replace(/\s+/g, " ");
  const supplier_id = input.supplier_id.trim();
  const current_quantity = Number(input.current_quantity);
  const par_level = Number(input.par_level);
  const reorder_threshold = Number(input.reorder_threshold);
  const estimated_unit_cost = Number(input.estimated_unit_cost);

  if (!item_name) throw new Error("Item name is required.");
  if (!category) throw new Error("Category is required.");
  if (!unit) throw new Error("Unit is required.");
  if (!supplier_id) throw new Error("Supplier is required.");
  for (const [label, value] of [
    ["Current quantity", current_quantity],
    ["Par level", par_level],
    ["Reorder threshold", reorder_threshold],
    ["Estimated unit cost", estimated_unit_cost]
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label} must be zero or greater.`);
    }
  }

  return {
    item_name,
    category,
    unit,
    current_quantity,
    par_level,
    reorder_threshold,
    estimated_unit_cost,
    supplier_id,
    eventType: "count",
    sourceWorkflow: "create_inventory_item",
    metadata: {
      created: true,
      item_name,
      category,
      unit,
      supplier_id
    }
  };
}

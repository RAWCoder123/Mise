import type { SetupStarterDrafts } from "../domain/setupDrafts";

/**
 * Replaceable sample rows used only to prefill the local guided setup.
 * They live with the main demo fixture so domain logic remains data-agnostic.
 */
export function createDemoSetupStarterDrafts(): SetupStarterDrafts {
  return {
    inventoryItems: [
      {
        id: "starter_inventory_chicken",
        name: "Chicken thigh",
        quantity: "26",
        unit: "lb",
        parLevel: "95",
        supplier: "Regional Protein Co."
      },
      {
        id: "starter_inventory_rice",
        name: "Jasmine rice",
        quantity: "88",
        unit: "lb",
        parLevel: "190",
        supplier: "Pantry Wholesale"
      },
      {
        id: "starter_inventory_peppers",
        name: "Bell peppers",
        quantity: "18",
        unit: "lb",
        parLevel: "52",
        supplier: "Metro Produce Supply"
      }
    ],
    suppliers: [
      {
        id: "starter_supplier_produce",
        name: "Metro Produce Supply",
        email: "orders@metro-produce.example"
      },
      {
        id: "starter_supplier_pantry",
        name: "Pantry Wholesale",
        email: "orders@pantry-wholesale.example"
      }
    ],
    recipes: [
      {
        id: "starter_recipe_chicken_rice_bowl",
        dishName: "Chicken Rice Bowl",
        ingredients: [
          {
            id: "starter_ingredient_chicken",
            itemName: "Chicken thigh",
            quantity: "0.42",
            unit: "lb"
          },
          {
            id: "starter_ingredient_rice",
            itemName: "Jasmine rice",
            quantity: "0.24",
            unit: "lb"
          },
          {
            id: "starter_ingredient_peppers",
            itemName: "Bell peppers",
            quantity: "0.12",
            unit: "lb"
          }
        ]
      }
    ]
  };
}

export const DEMO_SETUP_POS_SALES_PLACEHOLDER = [
  "sale_date,item_name,category,quantity_sold,gross_sales",
  "2026-06-30,Chicken Rice Bowl,Entrees,86,1290",
  "2026-06-30,Grilled Veggie Bowl,Entrees,54,702"
].join("\n");

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertStagingPreflight } from "./staging-preflight.mjs";

const url = process.env.SUPABASE_STAGING_URL;
const secretKey = process.env.SUPABASE_STAGING_SECRET_KEY;
const password = process.env.MISE_STAGING_SEED_PASSWORD;

if (!url || !secretKey || !password || !process.env.SUPABASE_STAGING_ANON_KEY || !process.env.SUPABASE_STAGING_PROJECT_REF || !process.env.MISE_STAGING_MARKER) {
  console.error(
    "Set the staging URL, project ref, anon/secret keys, identity marker, and seed password before seeding staging."
  );
  process.exit(1);
}

if (secretKey === process.env.SUPABASE_STAGING_ANON_KEY) {
  throw new Error("The staging bootstrap requires a server-only secret key, not the public anon key.");
}

await assertStagingPreflight();

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tenantC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const fixtureTenantIds = [tenantA, tenantB, tenantC];
const fixtureEmails = {
  ownerA: "owner-a@mise-staging.test",
  adminA: "admin-a@mise-staging.test",
  managerA: "manager-a@mise-staging.test",
  staffA: "staff-a@mise-staging.test",
  ownerB: "owner-b@mise-staging.test",
  switcher: "switcher@mise-staging.test"
};

async function allUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function recreateFixtureUsers() {
  const fixtureEmailSet = new Set(Object.values(fixtureEmails));
  const existing = (await allUsers()).filter((user) => user.email && fixtureEmailSet.has(user.email));
  for (const user of existing) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  const users = {};
  for (const [key, email] of Object.entries(fixtureEmails)) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { provider: "email", providers: ["email"], mise_staging_fixture: true }
    });
    if (error) throw error;
    assert.ok(data.user, `Auth Admin API did not return ${email}`);
    users[key] = data.user;
  }
  return users;
}

async function upsert(table, rows, onConflict = "id") {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function clearFixtureTable(table) {
  const { error } = await admin.from(table).delete().in("restaurant_id", fixtureTenantIds);
  if (error) throw new Error(`${table} fixture cleanup: ${error.message}`);
}

const users = await recreateFixtureUsers();
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

// Keep the bootstrap rerunnable after destructive workflow and race tests. The
// cleanup is deliberately limited to the two reserved fixture tenant IDs.
for (const table of [
  "audit_logs",
  "setup_attachments",
  "supplier_recipients",
  "restaurant_email_connections",
  "ai_insights",
  "sales_imports",
  "pos_integrations",
  "insights",
  "purchase_recommendations",
  "supplier_orders",
  "menu_item_ingredients",
  "pos_sales",
  "supplier_items",
  "purchase_orders",
  "inventory_count_lines",
  "inventory_count_sessions",
  "inventory_location_balances",
  "storage_locations",
  "inventory_movements",
  "inventory_items"
]) {
  await clearFixtureTable(table);
}

await upsert("restaurants", [
  {
    id: tenantA,
    name: "Luna Bistro",
    cuisine_type: "Fast casual Mediterranean",
    brand_color: "#EF3F27",
    accent_color: "#EF3F27",
    service_style: "fast_casual",
    timezone: "America/New_York",
    currency: "USD",
    operational_profile: {
      serviceStyle: "fast_casual",
      orderCadence: ["Mon", "Thu"],
      prepWindows: ["Pre-service count"],
      primarySuppliers: ["Fresh Produce Co."],
      inventoryReviewDays: ["Mon", "Thu"],
      notes: "Staging tenant A."
    }
  },
  {
    id: tenantB,
    name: "Northside Cafe",
    cuisine_type: "Cafe",
    brand_color: "#EF3F27",
    accent_color: "#EF3F27",
    service_style: "cafe",
    timezone: "America/New_York",
    currency: "USD",
    operational_profile: {
      serviceStyle: "cafe",
      orderCadence: ["Tue", "Fri"],
      prepWindows: ["Morning prep"],
      primarySuppliers: ["Cafe Supply"],
      inventoryReviewDays: ["Tue", "Fri"],
      notes: "Staging tenant B."
    }
  },
  {
    id: tenantC,
    name: "Unrelated Tenant Fixture",
    cuisine_type: "Test fixture",
    brand_color: "#EF3F27",
    accent_color: "#EF3F27",
    service_style: "cafe",
    timezone: "America/New_York",
    currency: "USD",
    operational_profile: {
      serviceStyle: "cafe",
      orderCadence: ["Wed"],
      prepWindows: ["Fixture prep"],
      primarySuppliers: ["Fixture Supply"],
      inventoryReviewDays: ["Wed"],
      notes: "Reserved for cross-tenant staging probes."
    }
  }
]);

await upsert("restaurant_memberships", [
  { restaurant_id: tenantA, user_id: users.ownerA.id, role: "owner", status: "active" },
  { restaurant_id: tenantA, user_id: users.adminA.id, role: "admin", status: "active" },
  { restaurant_id: tenantA, user_id: users.managerA.id, role: "manager", status: "active" },
  { restaurant_id: tenantA, user_id: users.staffA.id, role: "staff", status: "active" },
  { restaurant_id: tenantB, user_id: users.ownerB.id, role: "owner", status: "active" },
  { restaurant_id: tenantC, user_id: users.ownerB.id, role: "owner", status: "active" },
  { restaurant_id: tenantA, user_id: users.switcher.id, role: "manager", status: "active" },
  { restaurant_id: tenantB, user_id: users.switcher.id, role: "manager", status: "active" }
], "restaurant_id,user_id");

await upsert("inventory_items", [
  {
    id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    item_name: "Chicken Breast",
    category: "Protein",
    unit: "lb",
    current_quantity: 20,
    par_level: 30,
    reorder_threshold: 10,
    estimated_unit_cost: 4.25,
    supplier_name: "Fresh Produce Co."
  },
  {
    id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    item_name: "Espresso Beans",
    category: "Beverage",
    unit: "lb",
    current_quantity: 10,
    par_level: 16,
    reorder_threshold: 6,
    estimated_unit_cost: 7.5,
    supplier_name: "Cafe Supply"
  },
  {
    id: "cccccccc-1111-4111-8111-cccccccccccc",
    restaurant_id: tenantC,
    item_name: "Fixture Flour",
    category: "Dry goods",
    unit: "lb",
    current_quantity: 5,
    par_level: 10,
    reorder_threshold: 3,
    estimated_unit_cost: 2,
    supplier_name: "Fixture Supply"
  }
]);

await upsert("menu_item_ingredients", [
  {
    id: "aaaaaaaa-1313-4131-8131-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    menu_item_name: "Chicken Bowl",
    inventory_item_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    quantity_used_per_sale: 0.5,
    unit: "lb"
  },
  {
    id: "bbbbbbbb-1313-4131-8131-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    menu_item_name: "Northside Latte",
    inventory_item_id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
    quantity_used_per_sale: 0.05,
    unit: "lb"
  }
]);

await upsert("pos_sales", [
  {
    id: "aaaaaaaa-1212-4121-8121-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    source_record_id: "staging-tenant-a-sale",
    sale_date: today,
    item_name: "Chicken Bowl",
    category: "Entree",
    quantity_sold: 12,
    gross_sales: 188,
    net_sales: 175,
    source_pos: "Staging POS"
  },
  {
    id: "bbbbbbbb-1212-4121-8121-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    source_record_id: "staging-tenant-b-sale",
    sale_date: today,
    item_name: "Northside Latte",
    category: "Beverage",
    quantity_sold: 9,
    gross_sales: 54,
    net_sales: 50,
    source_pos: "Staging POS"
  }
]);

await upsert("purchase_recommendations", [
  {
    id: "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    inventory_item_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    item_name: "Chicken Breast",
    supplier_name: "Fresh Produce Co.",
    recommended_quantity: 12,
    unit: "lb",
    reason: "Below par",
    urgency: "high",
    status: "pending",
    supplier_order_id: null
  },
  {
    id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    inventory_item_id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
    item_name: "Espresso Beans",
    supplier_name: "Cafe Supply",
    recommended_quantity: 6,
    unit: "lb",
    reason: "Below par",
    urgency: "medium",
    status: "pending",
    supplier_order_id: null
  }
]);

await upsert("supplier_orders", [
  {
    id: "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    supplier_name: "Fresh Produce Co.",
    order_message: "Order chicken",
    status: "draft"
  },
  {
    id: "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    supplier_name: "Cafe Supply",
    order_message: "Order beans",
    status: "draft"
  }
]);

await upsert("insights", [
  {
    id: "aaaaaaaa-6161-4616-8616-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    insight_type: "inventory",
    title: "Luna chicken count needs review",
    description: "Tenant A inventory signal.",
    why_it_matters: "Luna dinner prep depends on this count.",
    recommended_action: "Review the Fresh Produce Co. draft.",
    severity: "warning",
    generation_source: "manual",
    planning_revision: null
  },
  {
    id: "bbbbbbbb-6161-4616-8616-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    insight_type: "inventory",
    title: "Northside espresso count needs review",
    description: "Tenant B inventory signal.",
    why_it_matters: "Northside morning service depends on this count.",
    recommended_action: "Review the Cafe Supply draft.",
    severity: "warning",
    generation_source: "manual",
    planning_revision: null
  }
]);

await upsert("pos_integrations", [
  {
    id: "aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    provider: "square",
    status: "connected",
    settings: { mode: "staging", secret_storage: "server_only" }
  },
  {
    id: "bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    provider: "toast",
    status: "connected",
    settings: { mode: "staging", secret_storage: "server_only" }
  },
  {
    id: "cccccccc-4444-4444-8444-cccccccccccc",
    restaurant_id: tenantC,
    provider: "demo",
    status: "connected",
    settings: { mode: "staging", secret_storage: "server_only" }
  }
], "restaurant_id,provider");

await upsert("sales_imports", [
  {
    id: "aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    pos_integration_id: "aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa",
    import_type: "pos_sync",
    status: "completed",
    records_processed: 4,
    metadata: { source: "staging_seed" }
  },
  {
    id: "bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    pos_integration_id: "bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb",
    import_type: "pos_sync",
    status: "completed",
    records_processed: 5,
    metadata: { source: "staging_seed" }
  }
]);

await upsert("supplier_items", [
  {
    id: "aaaaaaaa-1515-4515-8515-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    supplier_name: "Fresh Produce Co.",
    item_name: "Chicken Breast",
    unit: "lb",
    estimated_unit_cost: 4.25,
    preferred: true
  },
  {
    id: "bbbbbbbb-1515-4515-8515-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    supplier_name: "Cafe Supply",
    item_name: "Espresso Beans",
    unit: "lb",
    estimated_unit_cost: 7.5,
    preferred: true
  }
]);

await upsert("purchase_orders", [
  {
    id: "aaaaaaaa-1616-4616-8616-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    supplier_name: "Fresh Produce Co.",
    status: "draft",
    order_payload: { items: [] },
    subtotal_estimate: 0
  },
  {
    id: "bbbbbbbb-1616-4616-8616-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    supplier_name: "Cafe Supply",
    status: "draft",
    order_payload: { items: [] },
    subtotal_estimate: 0
  }
]);

await upsert("ai_insights", [
  {
    id: "aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    output: {
      title: "Prep chicken",
      summary: "Chicken is trending below par.",
      recommended_action: "Review the chicken prep and purchasing plan.",
      risk_level: "medium",
      confidence: 0.7,
      affected_workflow: "inventory",
      evidence: ["Staging inventory fixture indicates chicken is below par."]
    },
    risk_level: "medium",
    confidence: 0.7,
    status: "generated",
    generated_by: "staging_seed"
  },
  {
    id: "bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    output: {
      title: "Prep coffee",
      summary: "Espresso beans need review.",
      recommended_action: "Review the espresso bean order before service.",
      risk_level: "low",
      confidence: 0.6,
      affected_workflow: "inventory",
      evidence: ["Staging inventory fixture indicates espresso beans need review."]
    },
    risk_level: "low",
    confidence: 0.6,
    status: "generated",
    generated_by: "staging_seed"
  }
]);

await upsert("audit_logs", [
  {
    id: "aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    actor_user_id: users.ownerA.id,
    action: "seed",
    entity_table: "inventory_items",
    entity_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    metadata: { source: "staging_seed" }
  },
  {
    id: "bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    actor_user_id: users.ownerB.id,
    action: "seed",
    entity_table: "inventory_items",
    entity_id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
    metadata: { source: "staging_seed" }
  }
]);

await upsert("restaurant_email_connections", [
  {
    id: "aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa",
    restaurant_id: tenantA,
    provider: "gmail",
    status: "not_connected",
    sender_email: null
  },
  {
    id: "bbbbbbbb-8888-4888-8888-bbbbbbbbbbbb",
    restaurant_id: tenantB,
    provider: "gmail",
    status: "connected",
    sender_email: "orders@northside.example"
  }
], "restaurant_id,provider");

await upsert("supplier_recipients", [
  { id: "aaaaaaaa-9999-4999-8999-aaaaaaaaaaaa", restaurant_id: tenantA, supplier_name: "Fresh Produce Co.", email: "fresh@luna.example" },
  { id: "bbbbbbbb-9999-4999-8999-bbbbbbbbbbbb", restaurant_id: tenantB, supplier_name: "Cafe Supply", email: "orders@cafe-supply.example" }
], "restaurant_id,supplier_name,email");

await upsert("setup_attachments", [
  {
    id: "aaaaaaaa-aaaa-4aaa-9aaa-aaaaaaaaaa01",
    restaurant_id: tenantA,
    kind: "screenshot",
    label: "Opening inventory screenshot",
    status: "review_needed",
    metadata: { source: "staging_seed", storage_status: "metadata_only" },
    created_by: users.ownerA.id
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbb01",
    restaurant_id: tenantB,
    kind: "csv",
    label: "Northside opening inventory CSV",
    status: "queued",
    metadata: { source: "staging_seed", storage_status: "metadata_only" },
    created_by: users.ownerB.id
  }
]);

await upsert("storage_locations", [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa101",
    restaurant_id: tenantA,
    name: "Main",
    sort_order: 0,
    is_active: true
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101",
    restaurant_id: tenantB,
    name: "Main",
    sort_order: 0,
    is_active: true
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccc101",
    restaurant_id: tenantC,
    name: "Main",
    sort_order: 0,
    is_active: true
  }
]);

await upsert("inventory_location_balances", [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa201",
    restaurant_id: tenantA,
    inventory_item_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    storage_location_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa101",
    quantity: 20
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb201",
    restaurant_id: tenantB,
    inventory_item_id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
    storage_location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101",
    quantity: 10
  }
]);

await upsert("inventory_movements", [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa501",
    restaurant_id: tenantA,
    inventory_item_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    actor_user_id: users.ownerA.id,
    reason: "manual_count",
    quantity_before: 0,
    quantity_after: 20,
    source_workflow: "staging_seed"
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb501",
    restaurant_id: tenantB,
    inventory_item_id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
    actor_user_id: users.ownerB.id,
    reason: "manual_count",
    quantity_before: 0,
    quantity_after: 10,
    source_workflow: "staging_seed"
  }
]);

await upsert("inventory_count_sessions", [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa301",
    restaurant_id: tenantA,
    status: "cancelled",
    started_by: users.ownerA.id,
    cancelled_by: users.ownerA.id,
    started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    cancelled_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb301",
    restaurant_id: tenantB,
    status: "cancelled",
    started_by: users.ownerB.id,
    cancelled_by: users.ownerB.id,
    started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    cancelled_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  }
]);

await upsert("inventory_count_lines", [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa401",
    restaurant_id: tenantA,
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa301",
    inventory_item_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    item_name: "Chicken Breast",
    unit: "lb",
    system_quantity_at_start: 20,
    counted_quantity: 19
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb401",
    restaurant_id: tenantB,
    session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb301",
    inventory_item_id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
    item_name: "Espresso Beans",
    unit: "lb",
    system_quantity_at_start: 10,
    counted_quantity: 9
  }
]);

console.log("Mise staging fixtures created through the server-only Auth Admin bootstrap.");

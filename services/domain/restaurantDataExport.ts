export const RESTAURANT_DATA_EXPORT_SCHEMA_VERSION = 1 as const;
export const DEFAULT_POS_SALES_EXPORT_DAYS = 90;

export type RestaurantDataExportSource =
  | "edge_export_restaurant_data"
  | "demo_export_restaurant_data";

type JsonRecord = Record<string, unknown>;

const SECRET_SETTING_KEY_PATTERN =
  /(token|secret|password|passwd|api[_-]?key|authorization|credential|refresh|access[_-]?key)/i;

const EMAIL_CONNECTION_EXPORT_KEYS = [
  "id",
  "restaurant_id",
  "provider",
  "status",
  "sender_email",
  "last_verified_at",
  "created_at",
  "updated_at"
] as const;

export type RestaurantDataExportTables = {
  restaurants: JsonRecord[];
  users: JsonRecord[];
  restaurant_memberships: JsonRecord[];
  restaurant_member_invites: JsonRecord[];
  inventory_items: JsonRecord[];
  inventory_movements: JsonRecord[];
  inventory_count_sessions: JsonRecord[];
  inventory_count_lines: JsonRecord[];
  storage_locations: JsonRecord[];
  inventory_location_balances: JsonRecord[];
  menu_item_ingredients: JsonRecord[];
  pos_sales: JsonRecord[];
  pos_integrations: JsonRecord[];
  sales_imports: JsonRecord[];
  purchase_recommendations: JsonRecord[];
  supplier_orders: JsonRecord[];
  purchase_orders: JsonRecord[];
  supplier_items: JsonRecord[];
  supplier_recipients: JsonRecord[];
  insights: JsonRecord[];
  ai_insights: JsonRecord[];
  setup_attachments: JsonRecord[];
  restaurant_email_connections: JsonRecord[];
  audit_logs: JsonRecord[];
};

export type RestaurantDataExportDocument = {
  schema_version: typeof RESTAURANT_DATA_EXPORT_SCHEMA_VERSION;
  exported_at: string;
  restaurant_id: string;
  source: RestaurantDataExportSource;
  tables: RestaurantDataExportTables;
  summary: {
    table_count: number;
    pos_sales_exported: number;
    pos_sales_window_days: number;
  };
};

export type RestaurantDataExportInput = {
  restaurantId: string;
  exportedAt: string;
  source: RestaurantDataExportSource;
  restaurants?: unknown[];
  users?: unknown[];
  memberships?: unknown[];
  memberInvites?: unknown[];
  inventoryItems?: unknown[];
  inventoryMovements?: unknown[];
  inventoryCountSessions?: unknown[];
  inventoryCountLines?: unknown[];
  storageLocations?: unknown[];
  inventoryLocationBalances?: unknown[];
  menuItemIngredients?: unknown[];
  posSales?: unknown[];
  posIntegrations?: unknown[];
  salesImports?: unknown[];
  purchaseRecommendations?: unknown[];
  supplierOrders?: unknown[];
  purchaseOrders?: unknown[];
  supplierItems?: unknown[];
  supplierRecipients?: unknown[];
  insights?: unknown[];
  aiInsights?: unknown[];
  setupAttachments?: unknown[];
  emailConnections?: unknown[];
  auditLogs?: unknown[];
  posSalesWindowDays?: number;
  now?: Date;
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as JsonRecord) };
}

function cloneRecords(values: unknown[] | undefined): JsonRecord[] {
  return (values ?? []).map((value) => asRecord(value));
}

function sortById(records: JsonRecord[]): JsonRecord[] {
  return [...records].sort((left, right) => {
    const leftId = String(left.id ?? "");
    const rightId = String(right.id ?? "");
    return leftId.localeCompare(rightId);
  });
}

export function redactInviteForExport(invite: unknown): JsonRecord {
  const record = asRecord(invite);
  const {
    token_hash: _tokenHash,
    claim_token: _claimToken,
    token: _token,
    ...safe
  } = record;
  return safe;
}

export function sanitizeSettingsForExport(settings: unknown): JsonRecord {
  const record = asRecord(settings);
  const sanitized: JsonRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (SECRET_SETTING_KEY_PATTERN.test(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

export function sanitizePosIntegrationForExport(integration: unknown): JsonRecord {
  const record = asRecord(integration);
  return {
    ...record,
    settings: sanitizeSettingsForExport(record.settings)
  };
}

export function sanitizeEmailConnectionForExport(connection: unknown): JsonRecord {
  const record = asRecord(connection);
  const sanitized: JsonRecord = {};
  for (const key of EMAIL_CONNECTION_EXPORT_KEYS) {
    if (key in record) {
      sanitized[key] = record[key];
    }
  }
  return sanitized;
}

function saleTimestampMs(sale: { sale_date?: unknown; sold_at?: unknown; created_at?: unknown }) {
  const candidates = [sale.sale_date, sale.sold_at, sale.created_at];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.trim().length === 0) continue;
    const parsed = Date.parse(candidate.includes("T") ? candidate : `${candidate}T00:00:00.000Z`);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function filterPosSalesForExport<T extends {
  sale_date?: unknown;
  sold_at?: unknown;
  created_at?: unknown;
}>(
  sales: T[],
  now: Date = new Date(),
  windowDays: number = DEFAULT_POS_SALES_EXPORT_DAYS
): T[] {
  const cutoffMs = now.getTime() - Math.max(0, windowDays) * 24 * 60 * 60 * 1000;
  return sales.filter((sale) => {
    const timestampMs = saleTimestampMs(sale);
    return timestampMs != null && timestampMs >= cutoffMs;
  });
}

function extractCountSessionRows(sessions: unknown[] | undefined): {
  sessions: JsonRecord[];
  lines: JsonRecord[];
} {
  const sessionRows: JsonRecord[] = [];
  const lineRows: JsonRecord[] = [];

  for (const entry of sessions ?? []) {
    const record = asRecord(entry);
    if (record.session && typeof record.session === "object" && !Array.isArray(record.session)) {
      sessionRows.push(asRecord(record.session));
      if (Array.isArray(record.lines)) {
        for (const line of record.lines) {
          lineRows.push(asRecord(line));
        }
      }
      continue;
    }
    sessionRows.push(record);
  }

  return { sessions: sessionRows, lines: lineRows };
}

export function buildRestaurantDataExport(input: RestaurantDataExportInput): RestaurantDataExportDocument {
  const windowDays = input.posSalesWindowDays ?? DEFAULT_POS_SALES_EXPORT_DAYS;
  const now = input.now ?? new Date(input.exportedAt);
  const extractedSessions = extractCountSessionRows(input.inventoryCountSessions);
  const explicitLines = cloneRecords(input.inventoryCountLines);
  const countLines =
    explicitLines.length > 0 ? explicitLines : extractedSessions.lines;

  const filteredSales = filterPosSalesForExport(
    cloneRecords(input.posSales) as Array<JsonRecord & { sold_at?: unknown }>,
    now,
    windowDays
  );

  const tables: RestaurantDataExportTables = {
    restaurants: sortById(cloneRecords(input.restaurants)),
    users: sortById(cloneRecords(input.users)),
    restaurant_memberships: sortById(cloneRecords(input.memberships)),
    restaurant_member_invites: sortById(
      (input.memberInvites ?? []).map((invite) => redactInviteForExport(invite))
    ),
    inventory_items: sortById(cloneRecords(input.inventoryItems)),
    inventory_movements: sortById(cloneRecords(input.inventoryMovements)),
    inventory_count_sessions: sortById(extractedSessions.sessions),
    inventory_count_lines: sortById(countLines),
    storage_locations: sortById(cloneRecords(input.storageLocations)),
    inventory_location_balances: sortById(cloneRecords(input.inventoryLocationBalances)),
    menu_item_ingredients: sortById(cloneRecords(input.menuItemIngredients)),
    pos_sales: sortById(filteredSales),
    pos_integrations: sortById(
      (input.posIntegrations ?? []).map((integration) =>
        sanitizePosIntegrationForExport(integration)
      )
    ),
    sales_imports: sortById(cloneRecords(input.salesImports)),
    purchase_recommendations: sortById(cloneRecords(input.purchaseRecommendations)),
    supplier_orders: sortById(cloneRecords(input.supplierOrders)),
    purchase_orders: sortById(cloneRecords(input.purchaseOrders)),
    supplier_items: sortById(cloneRecords(input.supplierItems)),
    supplier_recipients: sortById(cloneRecords(input.supplierRecipients)),
    insights: sortById(cloneRecords(input.insights)),
    ai_insights: sortById(cloneRecords(input.aiInsights)),
    setup_attachments: sortById(cloneRecords(input.setupAttachments)),
    restaurant_email_connections: sortById(
      (input.emailConnections ?? []).map((connection) =>
        sanitizeEmailConnectionForExport(connection)
      )
    ),
    audit_logs: sortById(cloneRecords(input.auditLogs))
  };

  return {
    schema_version: RESTAURANT_DATA_EXPORT_SCHEMA_VERSION,
    exported_at: input.exportedAt,
    restaurant_id: input.restaurantId,
    source: input.source,
    tables,
    summary: {
      table_count: Object.keys(tables).length,
      pos_sales_exported: tables.pos_sales.length,
      pos_sales_window_days: windowDays
    }
  };
}

export function serializeRestaurantDataExport(document: RestaurantDataExportDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function posSalesExportCutoffDate(
  now: Date = new Date(),
  windowDays: number = DEFAULT_POS_SALES_EXPORT_DAYS
): string {
  const cutoff = new Date(now.getTime() - Math.max(0, windowDays) * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().slice(0, 10);
}

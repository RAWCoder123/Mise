// Square OAuth and Orders/Catalog helpers for backend-only Edge Functions.
// Access tokens stay ephemeral; refresh credentials live in Vault only.

import { randomBase64Url, sha256Base64Url, sha256Hex } from "./gmail.ts";

export { randomBase64Url, sha256Base64Url, sha256Hex };

export const SQUARE_API_VERSION = "2024-01-18";
export const SQUARE_OAUTH_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "ITEMS_READ",
  "ORDERS_READ",
] as const;

const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;

export type SquareFailureDisposition = "rejected" | "reauthorize" | "ambiguous";

export class SquareProviderError extends Error {
  constructor(
    public readonly safeCode: string,
    public readonly disposition: SquareFailureDisposition,
    public readonly status: number,
  ) {
    super("Square provider request failed.");
    this.name = "SquareProviderError";
  }
}

export interface SquareOAuthConfig {
  applicationId: string;
  applicationSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
}

export interface SquareTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  merchantId: string;
  grantedScopes: string[];
}

export interface SquareLocation {
  externalLocationId: string;
  displayName: string;
  timezone: string | null;
}

export interface SquareSaleRow {
  sale_date: string;
  item_name: string;
  category: string;
  quantity_sold: number;
  gross_sales: number;
  net_sales: number;
  source_record_id: string;
  /** Positive quantity; returns reverse inventory depletion downstream. */
  record_kind: "sale" | "return";
  provider_location_id?: string;
  provider_catalog_item_id?: string;
  provider_variation_id?: string;
}

export interface SquareCatalogRow {
  external_catalog_item_id: string;
  external_variation_id: string;
  external_name: string;
  category: string;
}

function oauthBase(environment: SquareOAuthConfig["environment"]) {
  return environment === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function apiBase(environment: SquareOAuthConfig["environment"]) {
  return `${oauthBase(environment)}/v2`;
}

export function buildSquareAuthorizationUrl(
  config: Pick<SquareOAuthConfig, "applicationId" | "redirectUri" | "environment">,
  state: string,
) {
  requireBoundedString(config.applicationId, "applicationId", 128);
  requireHttpsUrl(config.redirectUri, "redirectUri");
  requireOpaqueToken(state, "state", 32, 512);

  const url = new URL(`${oauthBase(config.environment)}/oauth2/authorize`);
  url.searchParams.set("client_id", config.applicationId);
  url.searchParams.set("scope", SQUARE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("session", "false");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);
  return url.toString();
}

export async function exchangeSquareAuthorizationCode(
  config: SquareOAuthConfig,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SquareTokenSet> {
  requireSquareOAuthConfig(config);
  requireOpaqueToken(code, "authorization code", 8, 4096);

  const response = await fetchImpl(`${oauthBase(config.environment)}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
    body: JSON.stringify({
      client_id: config.applicationId,
      client_secret: config.applicationSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });
  const payload = await readProviderJson(response);
  if (!response.ok) throw tokenEndpointError(response.status, payload);
  return parseTokenSet(payload, true);
}

export async function refreshSquareAccessToken(
  config: SquareOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SquareTokenSet> {
  requireSquareOAuthConfig(config);
  requireOpaqueToken(refreshToken, "refresh credential", 8, 4096);

  const response = await fetchImpl(`${oauthBase(config.environment)}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
    body: JSON.stringify({
      client_id: config.applicationId,
      client_secret: config.applicationSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await readProviderJson(response);
  if (!response.ok) throw tokenEndpointError(response.status, payload);
  return parseTokenSet(payload, false);
}

export async function revokeSquareToken(
  config: SquareOAuthConfig,
  accessOrRefreshToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  requireSquareOAuthConfig(config);
  requireOpaqueToken(accessOrRefreshToken, "revoke credential", 8, 4096);
  const response = await fetchImpl(`${oauthBase(config.environment)}/oauth2/revoke`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
      authorization: `Client ${config.applicationSecret}`,
    },
    body: JSON.stringify({
      client_id: config.applicationId,
      access_token: accessOrRefreshToken,
    }),
  });
  if (response.status === 200 || response.status === 204) return;
  const payload = await readProviderJson(response);
  if (response.status === 404 || response.status === 401) return;
  throw tokenEndpointError(response.status, payload);
}

export async function listSquareLocations(
  config: Pick<SquareOAuthConfig, "environment">,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SquareLocation[]> {
  requireOpaqueToken(accessToken, "access credential", 8, 4096);
  const response = await fetchImpl(`${apiBase(config.environment)}/locations`, {
    headers: squareHeaders(accessToken),
  });
  const payload = await readProviderJson(response);
  if (!response.ok) throw providerHttpError(response.status, "locations_failed");
  const locations = Array.isArray(payload.locations) ? payload.locations : [];
  return locations
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const id = stringField(record, "id", 128);
      const name = stringField(record, "name", 200) || "Square location";
      const timezone =
        typeof record.timezone === "string" && record.timezone.length <= 64
          ? record.timezone
          : null;
      if (!id) return null;
      return {
        externalLocationId: id,
        displayName: name,
        timezone,
      } satisfies SquareLocation;
    })
    .filter((row): row is SquareLocation => row !== null);
}

export async function searchSquareOrders(
  config: Pick<SquareOAuthConfig, "environment">,
  accessToken: string,
  locationIds: string[],
  fromIsoDate: string,
  toIsoDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SquareSaleRow[]> {
  requireOpaqueToken(accessToken, "access credential", 8, 4096);
  if (!Array.isArray(locationIds) || locationIds.length === 0) return [];
  const sales: SquareSaleRow[] = [];
  for (let locationOffset = 0; locationOffset < locationIds.length; locationOffset += 10) {
    const locationBatch = locationIds.slice(locationOffset, locationOffset + 10);
    let cursor: string | undefined;
    do {
      const body: Record<string, unknown> = {
        location_ids: locationBatch,
        query: {
          filter: {
            state_filter: { states: ["COMPLETED"] },
            date_time_filter: {
              closed_at: {
                start_at: `${fromIsoDate}T00:00:00.000Z`,
                end_at: `${toIsoDate}T23:59:59.999Z`,
              },
            },
          },
        },
        limit: 100,
      };
      if (cursor) body.cursor = cursor;
      const response = await fetchImpl(`${apiBase(config.environment)}/orders/search`, {
        method: "POST",
        headers: squareHeaders(accessToken),
        body: JSON.stringify(body),
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw providerHttpError(response.status, "orders_search_failed");
      const orders = Array.isArray(payload.orders) ? payload.orders : [];
      for (const order of orders) {
        sales.push(...normalizeOrderSales(order));
      }
      cursor = typeof payload.cursor === "string" ? payload.cursor : undefined;
    } while (cursor);
  }
  return sales;
}

export async function listSquareCatalogItems(
  config: Pick<SquareOAuthConfig, "environment">,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SquareCatalogRow[]> {
  requireOpaqueToken(accessToken, "access credential", 8, 4096);
  const items: SquareCatalogRow[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`${apiBase(config.environment)}/catalog/list`);
    url.searchParams.set("types", "ITEM");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetchImpl(url, { headers: squareHeaders(accessToken) });
    const payload = await readProviderJson(response);
    if (!response.ok) throw providerHttpError(response.status, "catalog_list_failed");
    const objects = Array.isArray(payload.objects) ? payload.objects : [];
    for (const object of objects) {
      items.push(...normalizeCatalogItem(object));
    }
    cursor = typeof payload.cursor === "string" ? payload.cursor : undefined;
  } while (cursor);
  return items;
}

export function normalizeOrderSales(order: unknown): SquareSaleRow[] {
  if (!order || typeof order !== "object") return [];
  const record = order as Record<string, unknown>;
  const orderId = stringField(record, "id", 128);
  if (!orderId) return [];
  const closedAt =
    stringField(record, "closed_at", 64) ||
    stringField(record, "created_at", 64) ||
    new Date().toISOString();
  const saleDate = closedAt.slice(0, 10);
  const providerLocationId = stringField(record, "location_id", 128) || undefined;
  const lineItems = Array.isArray(record.line_items) ? record.line_items : [];
  const rows: SquareSaleRow[] = [];
  for (const [index, line] of lineItems.entries()) {
    if (!line || typeof line !== "object") continue;
    const item = line as Record<string, unknown>;
    const name = stringField(item, "name", 160) || "Untitled item";
    const quantity = Math.min(100000, Math.max(0, Number(item.quantity ?? 0)));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const uid = stringField(item, "uid", 128) || String(index);
    const gross = moneyAmount(item.gross_sales_money) ?? moneyAmount(item.total_money) ?? 0;
    const net = moneyAmount(item.total_money) ?? gross;
    const variationId = stringField(item, "catalog_object_id", 128);
    const category =
      variationId ||
      stringField(item, "variation_name", 80) ||
      "Square";
    rows.push({
      sale_date: saleDate,
      item_name: name,
      category: category.slice(0, 80),
      quantity_sold: quantity,
      gross_sales: clampMoney(gross),
      net_sales: clampMoney(net),
      source_record_id: `square_${orderId}_${uid}`.slice(0, 200),
      record_kind: "sale",
      provider_location_id: providerLocationId,
      provider_variation_id: variationId || undefined,
    });
  }

  // Itemized returns live on the return/exchange order (often a separate COMPLETED
  // order). Keep quantity_sold positive and mark record_kind so depletion can reverse.
  const returns = Array.isArray(record.returns) ? record.returns : [];
  for (const [returnIndex, returnEntry] of returns.entries()) {
    if (!returnEntry || typeof returnEntry !== "object") continue;
    const returnRecord = returnEntry as Record<string, unknown>;
    const returnUid = stringField(returnRecord, "uid", 128) || String(returnIndex);
    const returnLineItems = Array.isArray(returnRecord.return_line_items)
      ? returnRecord.return_line_items
      : [];
    for (const [lineIndex, line] of returnLineItems.entries()) {
      if (!line || typeof line !== "object") continue;
      const item = line as Record<string, unknown>;
      const name = stringField(item, "name", 160) || "Untitled item";
      const quantity = Math.min(100000, Math.max(0, Number(item.quantity ?? 0)));
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      const uid = stringField(item, "uid", 128) || `${returnUid}_${lineIndex}`;
      const gross =
        moneyAmount(item.gross_return_money) ??
        moneyAmount(item.total_money) ??
        moneyAmount(item.variation_total_price_money) ??
        0;
      const net = moneyAmount(item.total_money) ?? gross;
      const variationId = stringField(item, "catalog_object_id", 128);
      const category =
        variationId ||
        stringField(item, "variation_name", 80) ||
        "Square";
      rows.push({
        sale_date: saleDate,
        item_name: name,
        category: category.slice(0, 80),
        quantity_sold: quantity,
        gross_sales: clampMoney(Math.abs(gross)),
        net_sales: clampMoney(Math.abs(net)),
        source_record_id: `square_${orderId}_return_${uid}`.slice(0, 200),
        record_kind: "return",
        provider_location_id: providerLocationId,
        provider_variation_id: variationId || undefined,
      });
    }
  }
  return rows;
}

export function normalizeCatalogItem(object: unknown): SquareCatalogRow[] {
  if (!object || typeof object !== "object") return [];
  const record = object as Record<string, unknown>;
  if (record.type !== "ITEM") return [];
  const itemData =
    record.item_data && typeof record.item_data === "object"
      ? (record.item_data as Record<string, unknown>)
      : null;
  if (!itemData) return [];
  const itemId = stringField(record, "id", 128);
  const itemName = stringField(itemData, "name", 160) || "Untitled item";
  const category =
    stringField(itemData, "product_type", 80) ||
    stringField(itemData, "category_id", 80) ||
    "Square";
  const variations = Array.isArray(itemData.variations) ? itemData.variations : [];
  if (variations.length === 0) {
    return [
      {
        external_catalog_item_id: itemId,
        external_variation_id: "",
        external_name: itemName,
        category: category.slice(0, 80),
      },
    ];
  }
  return variations
    .map((variation) => {
      if (!variation || typeof variation !== "object") return null;
      const row = variation as Record<string, unknown>;
      const variationData =
        row.item_variation_data && typeof row.item_variation_data === "object"
          ? (row.item_variation_data as Record<string, unknown>)
          : {};
      const variationId = stringField(row, "id", 128);
      const variationName = stringField(variationData, "name", 160);
      const externalName =
        variationName && variationName !== "Regular"
          ? `${itemName} — ${variationName}`
          : itemName;
      return {
        external_catalog_item_id: itemId,
        external_variation_id: variationId,
        external_name: externalName.slice(0, 160),
        category: category.slice(0, 80),
      } satisfies SquareCatalogRow;
    })
    .filter((row): row is SquareCatalogRow => row !== null && Boolean(row.external_catalog_item_id));
}

function squareHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "content-type": "application/json",
    "Square-Version": SQUARE_API_VERSION,
  };
}

function parseTokenSet(payload: Record<string, unknown>, requireRefresh: boolean): SquareTokenSet {
  const accessToken = stringField(payload, "access_token", 4096);
  const refreshToken = stringField(payload, "refresh_token", 4096);
  const merchantId = stringField(payload, "merchant_id", 128);
  if (!accessToken || !merchantId) {
    throw new SquareProviderError("token_response_invalid", "ambiguous", 502);
  }
  if (requireRefresh && !refreshToken) {
    throw new SquareProviderError("refresh_token_missing", "reauthorize", 400);
  }
  const scopeValue = stringField(payload, "scope", 2000) || "";
  const grantedScopes = scopeValue
    .split(/[,\s]+/u)
    .map((scope) => scope.trim())
    .filter(Boolean);
  for (const required of SQUARE_OAUTH_SCOPES) {
    if (!grantedScopes.includes(required)) {
      throw new SquareProviderError("square_scope_missing", "rejected", 403);
    }
  }
  return {
    accessToken,
    refreshToken: refreshToken || null,
    expiresAt: stringField(payload, "expires_at", 64),
    merchantId,
    grantedScopes,
  };
}

function moneyAmount(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const amount = Number((value as Record<string, unknown>).amount);
  if (!Number.isFinite(amount)) return null;
  return amount / 100;
}

function clampMoney(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(10_000_000, Math.round(value * 100) / 100);
}

function tokenEndpointError(status: number, payload: Record<string, unknown>) {
  const code = stringField(payload, "code", 80) || stringField(payload, "error", 80);
  if (status === 401 || code === "unauthorized_client") {
    return new SquareProviderError("square_unauthorized", "reauthorize", status);
  }
  if (status === 403) {
    return new SquareProviderError("square_forbidden", "rejected", status);
  }
  return new SquareProviderError("square_token_exchange_failed", "ambiguous", status || 502);
}

function providerHttpError(status: number, code: string) {
  if (status === 401 || status === 403) {
    return new SquareProviderError(code, "reauthorize", status);
  }
  return new SquareProviderError(code, "ambiguous", status || 502);
}

async function readProviderJson(response: Response) {
  const raw = await response.arrayBuffer();
  if (raw.byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new SquareProviderError("provider_response_too_large", "ambiguous", 502);
  }
  if (raw.byteLength === 0) return {};
  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw new SquareProviderError("provider_response_invalid", "ambiguous", 502);
  }
}

function requireSquareOAuthConfig(config: SquareOAuthConfig) {
  requireBoundedString(config.applicationId, "applicationId", 128);
  requireBoundedString(config.applicationSecret, "applicationSecret", 256);
  requireHttpsUrl(config.redirectUri, "redirectUri");
  if (config.environment !== "sandbox" && config.environment !== "production") {
    throw new Error("Square environment is invalid.");
  }
}

function requireHttpsUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an https URL.`);
  }
  if (url.protocol !== "https:") throw new Error(`${label} must be an https URL.`);
}

function requireBoundedString(value: string, label: string, max: number) {
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    throw new Error(`${label} length is outside the supported boundary.`);
  }
}

function requireOpaqueToken(value: string, label: string, min: number, max: number) {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`${label} is invalid.`);
  }
}

function stringField(record: Record<string, unknown>, key: string, max: number) {
  const value = record[key];
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || /[\u0000-\u001f\u007f]/u.test(trimmed)) return "";
  return trimmed;
}

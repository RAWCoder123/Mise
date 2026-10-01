import type { SupplierOrder } from "../types/mise";
import { ORDER_MESSAGE_MAX_BYTES, truncateUtf8 } from "../services/domain/securityLimits";

export interface SupplierDraftLine {
  itemName: string;
  quantityLabel: string;
  priceLabel: string | null;
  estimatedCents: number;
}

export interface SupplierDraftPresentation {
  itemCount: number;
  lines: SupplierDraftLine[];
  hiddenLineCount: number;
  estimatedTotalCents: number;
  deliveryCopy: string;
  totalLabel: string | null;
}

const nonItemLinePatterns = [
  /^order draft for/i,
  /^borrador de pedido para/i,
  /的订单草稿$/,
  /^delivery requested/i,
  /^entrega solicitada/i,
  /^请求送达[：:]/,
  /^notes:?$/i,
  /^notas:?$/i,
  /^备注：?$/,
  /^recommended based/i
];

export function parseSupplierOrderLines(orderMessage: string): SupplierDraftLine[] {
  return scanSupplierOrderLines(orderMessage, Number.POSITIVE_INFINITY).lines;
}

export function buildSupplierDraftPresentation(order: SupplierOrder, maxLines = 5): SupplierDraftPresentation {
  const scanned = scanSupplierOrderLines(order.order_message, Math.max(0, Math.floor(maxLines)));
  return {
    itemCount: scanned.itemCount,
    lines: scanned.lines,
    hiddenLineCount: Math.max(0, scanned.itemCount - scanned.lines.length),
    estimatedTotalCents: scanned.estimatedTotalCents,
    deliveryCopy: order.delivery_date ? "Due tomorrow morning" : "Delivery timing pending",
    totalLabel: scanned.estimatedTotalCents > 0 ? formatCents(scanned.estimatedTotalCents) : null
  };
}

function scanSupplierOrderLines(orderMessage: string, maximumStoredLines: number) {
  const boundedMessage = truncateUtf8(orderMessage, ORDER_MESSAGE_MAX_BYTES);
  const lines: SupplierDraftLine[] = [];
  let itemCount = 0;
  let estimatedTotalCents = 0;
  let cursor = 0;

  while (cursor <= boundedMessage.length) {
    const nextBreak = boundedMessage.indexOf("\n", cursor);
    const end = nextBreak === -1 ? boundedMessage.length : nextBreak;
    const rawLine = boundedMessage.slice(cursor, end).replace(/\r$/, "").trim();
    cursor = nextBreak === -1 ? boundedMessage.length + 1 : nextBreak + 1;
    if (!rawLine || nonItemLinePatterns.some((pattern) => pattern.test(rawLine))) continue;

    const match = rawLine.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    const itemName = match?.[1]?.trim();
    const quantityLabel = match?.[2]?.trim();
    if (!itemName || !quantityLabel) continue;

    const estimatedCents = estimateLineCents(itemName, quantityLabel);
    itemCount += 1;
    estimatedTotalCents += estimatedCents;
    if (lines.length < maximumStoredLines) {
      lines.push({
        itemName,
        quantityLabel,
        estimatedCents,
        priceLabel: estimatedCents > 0 ? formatCents(estimatedCents) : null
      });
    }
  }

  return { lines, itemCount, estimatedTotalCents };
}

function estimateLineCents(itemName: string, quantityLabel: string) {
  const quantity = Number.parseFloat(quantityLabel.replace(/,/g, ""));
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const normalized = itemName.toLowerCase();
  const unitCents =
    normalized.includes("tomato") ? 163 :
    normalized.includes("onion") ? 182 :
    normalized.includes("lemon") ? 295 :
    normalized.includes("cilantro") ? 420 :
    normalized.includes("garlic") ? 455 :
    normalized.includes("cabbage") ? 210 :
    normalized.includes("pepper") ? 235 :
    normalized.includes("scallion") ? 385 :
    normalized.includes("ginger") ? 315 :
    normalized.includes("wrapper") ? 220 :
    normalized.includes("soy sauce") ? 850 :
    normalized.includes("sesame oil") ? 1125 :
    normalized.includes("chicken") ? 370 :
    normalized.includes("rice") ? 95 :
    normalized.includes("beef") ? 545 :
    normalized.includes("lettuce") ? 230 :
    0;
  return Math.round(quantity * unitCents);
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

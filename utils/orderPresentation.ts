import type { SupplierOrder } from "../types/mise";
import { estimateOrderPresentationUnitCents } from "../services/domain/orderPresentationIdentity";
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
  /^delivery requested/i,
  /^notes:?$/i,
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
  // Demo unit cents must use ASCII C fold — Unicode toLowerCase invents
  // Kelvin-sign matches such as chicKen → chicken (MISE-005KH).
  return Math.round(quantity * estimateOrderPresentationUnitCents(itemName));
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

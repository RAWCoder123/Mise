/**
 * Structural audit evidence for supplier-order send-time attribution.
 *
 * `supplier_orders.sent_at` is nullable so draft rows legitimately leave it
 * null until a later send / complete UPDATE stamps the timestamp, and so
 * history can keep a completed order after later corrections without rewriting
 * send time. There is intentionally no table-level NOT NULL /
 * status-implies-timestamp CHECK, because drafts are the normal INSERT shape
 * and account/history flows must not rewrite send attribution.
 *
 * The existing `supplier_orders_email_delivery_check` only requires `sent_at`
 * when `email_provider` is set and status is not draft. On current main, any
 * INSERT that reaches the table can still mint a terminal claim
 * (`status = 'sent'` or `status = 'completed'`) with `email_provider` null and
 * `sent_at` null — a supplier order Activity / audit analysis cannot place the
 * send claim in time. Client and service_role DML are revoked, but SECURITY
 * DEFINER / direct INSERT paths still reach the table.
 *
 * This tip fails closed on INSERT when status is already `sent` or
 * `completed` without a non-null `sent_at`. It does not restore table-level
 * NOT NULL / status-implies-timestamp CHECK (that would couple every mark-sent
 * UPDATE path and block draft inserts), rewrite any supplier-order writer, or
 * require a timestamp when status is still draft. Orthogonal to supplier-order
 * locale / cntrl pins, Gmail delivery CHECK pairing, and the sibling
 * sent_by_user_id INSERT tip.
 */

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function requiresSendTime(status: string | null | undefined): boolean {
  return status === "sent" || status === "completed";
}

/**
 * Domain rejection reason for missing send-time attribution on insert.
 * Returns null when status is not sent/completed, or when a non-empty
 * sent_at value is present. Matches the SQL tip predicate keyed on status.
 */
export function validateSupplierOrderSentAtEvidence(input: {
  status?: string | null;
  sentAt?: string | null;
}): string | null {
  if (!requiresSendTime(input.status)) {
    return null;
  }
  if (!hasTimestamp(input.sentAt)) {
    return "missing_sent_at";
  }
  return null;
}

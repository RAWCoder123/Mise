/**
 * Structural audit evidence for supplier-order send-actor attribution.
 *
 * `supplier_orders.sent_by_user_id` is nullable so draft rows legitimately
 * leave it null until a later send / complete UPDATE stamps the actor, and so
 * history can keep a completed order after the sending operator's auth identity
 * is cleared. There is intentionally no table-level NOT NULL /
 * status-implies-actor CHECK, because drafts are the normal INSERT shape and
 * account/history flows must not rewrite send attribution.
 *
 * The existing `supplier_orders_email_delivery_check` only requires
 * `sent_by_user_id` when `email_provider` is set and status is not draft. On
 * current main, any INSERT that reaches the table can still mint a terminal
 * claim (`status = 'sent'` or `status = 'completed'`) with
 * `email_provider` null and `sent_by_user_id` null — a supplier order Activity
 * / audit analysis cannot pin to an operator. Client and service_role DML are
 * revoked, but SECURITY DEFINER / direct INSERT paths still reach the table.
 *
 * This tip fails closed on INSERT when status is already `sent` or
 * `completed` without a non-null `sent_by_user_id`. It does not restore
 * table-level NOT NULL / status-implies-actor CHECK (that would couple every
 * mark-sent UPDATE path and block draft inserts), rewrite any supplier-order
 * writer, or require an actor when status is still draft. Orthogonal to
 * supplier-order locale / cntrl pins, Gmail delivery CHECK pairing, and
 * purchase-order submitted_at tips.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function requiresSendActor(status: string | null | undefined): boolean {
  return status === "sent" || status === "completed";
}

/**
 * Domain rejection reason for missing send-actor attribution on insert.
 * Returns null when status is not sent/completed, or when a non-empty
 * sent_by_user_id value is present. Matches the SQL tip predicate keyed on
 * status.
 */
export function validateSupplierOrderSentByEvidence(input: {
  status?: string | null;
  sentByUserId?: string | null;
}): string | null {
  if (!requiresSendActor(input.status)) {
    return null;
  }
  if (!hasActor(input.sentByUserId)) {
    return "missing_sent_by_user_id";
  }
  return null;
}

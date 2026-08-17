import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AUTHORIZED_RETRY_AFTER_REVIEW,
  CONFIRM_SENT_AFTER_REVIEW,
  confirmationForResolution,
  normalizeSupplierEmailDeliveryReview,
  supplierEmailDeliveryRequiresReview
} from "../services/domain/supplierEmailDeliveryReview";

const migration = readFileSync(
  "supabase/migrations/20260817120000_supplier_email_delivery_review_resolution.sql",
  "utf8"
);
const orderDetail = readFileSync("app/orders/[id].tsx", "utf8");
const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const application = readFileSync("services/application/supplierEmailDeliveryReview.ts", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");
const docs = readFileSync("docs/gmail-backend.md", "utf8");

test("supplier email delivery review normalization stays bounded and secret-free", () => {
  const review = normalizeSupplierEmailDeliveryReview(
    {
      requiresReview: true,
      orderStatus: "draft",
      deliveryStatus: "unknown",
      lastErrorCode: "stale_send_claim",
      updatedAt: "2026-08-17T03:00:00.000Z",
      providerMessageIdPresent: false,
      resolution: null,
      actionId: "action-1",
      actionStatus: "unverified"
    },
    "restaurant-1",
    "order-1"
  );
  assert.equal(review.requiresReview, true);
  assert.equal(review.deliveryStatus, "unknown");
  assert.equal(review.lastErrorCode, "stale_send_claim");
  assert.equal(review.actionStatus, "unverified");
  assert.equal(supplierEmailDeliveryRequiresReview(review), true);
  assert.equal(supplierEmailDeliveryRequiresReview(null, "unverified"), true);
  assert.equal(supplierEmailDeliveryRequiresReview({ ...review, requiresReview: false }, "failed"), false);
  assert.equal(confirmationForResolution("confirm_sent"), CONFIRM_SENT_AFTER_REVIEW);
  assert.equal(confirmationForResolution("allow_retry"), AUTHORIZED_RETRY_AFTER_REVIEW);
  assert.throws(() => normalizeSupplierEmailDeliveryReview(null, "restaurant-1", "order-1"));
});

test("delivery review migration installs authenticated manager resolution without service-role forgery", () => {
  assert.match(migration, /create or replace function public\.get_supplier_email_delivery_review/);
  assert.match(migration, /create or replace function public\.resolve_supplier_email_delivery/);
  assert.match(migration, /confirmed_sent_after_review/);
  assert.match(migration, /authorized_retry_after_review/);
  assert.match(migration, /manager_attested:/);
  assert.match(migration, /supplier_email_delivery_confirmed_after_review/);
  assert.match(migration, /supplier_email_delivery_retry_authorized/);
  assert.match(migration, /resolution = 'allow_retry'/);
  assert.match(migration, /status = 'failed'/);
  assert.match(
    migration,
    /grant execute on function public\.resolve_supplier_email_delivery[\s\S]*to authenticated;/i
  );
  assert.match(
    migration,
    /grant execute on function public\.get_supplier_email_delivery_review[\s\S]*to authenticated;/i
  );
  assert.match(
    migration,
    /revoke all on function public\.resolve_supplier_email_delivery\(uuid, uuid, text, text, text\)\s+from public, anon, authenticated, service_role;/i
  );
  assert.match(
    migration,
    /revoke all on function public\.get_supplier_email_delivery_review\(uuid, uuid\)\s+from public, anon, authenticated, service_role;/i
  );
  assert.match(migration, /resolution = null[\s\S]*resolved_at = null[\s\S]*resolved_by_user_id = null/);
  const resolveStart = migration.indexOf(
    "create or replace function public.resolve_supplier_email_delivery"
  );
  const resolveSql = migration.slice(resolveStart);
  assert.doesNotMatch(resolveSql, /refresh_token|access_token/i);
  assert.doesNotMatch(
    resolveSql,
    /grant execute on function public\.resolve_supplier_email_delivery\([^;]*to service_role/i
  );
});

test("client wiring keeps delivery review tenant-scoped and behind explicit confirmation", () => {
  assert.match(application, /export async function fetchSupplierEmailDeliveryReview/);
  assert.match(application, /export async function resolveSupplierEmailDelivery/);
  assert.match(application, /confirmationForResolution\(resolution\)/);
  assert.match(hostedRepository, /client\.rpc\("get_supplier_email_delivery_review"/);
  assert.match(hostedRepository, /client\.rpc\("resolve_supplier_email_delivery"/);
  assert.match(hostedRepository, /normalizeSupplierEmailDeliveryReview\(data, restaurantId, orderId\)/);
  assert.match(demoRepository, /action\.status !== "unverified"/);
  assert.match(demoRepository, /CONFIRM_SENT_AFTER_REVIEW/);
  assert.match(demoRepository, /AUTHORIZED_RETRY_AFTER_REVIEW/);
  assert.match(orderDetail, /resolveSupplierEmailDelivery/);
  assert.match(orderDetail, /needsDeliveryReview/);
  assert.match(orderDetail, /resolveDeliveryReview\("confirm_sent"\)/);
  assert.match(orderDetail, /resolveDeliveryReview\("allow_retry"\)/);
  assert.match(orderDetail, /!needsDeliveryReview/);
  assert.match(catalog, /orders\.detail\.reviewResolution\.title/);
  assert.match(catalog, /orders\.detail\.reviewResolution\.allowRetry/);
  assert.match(docs, /resolve_supplier_email_delivery|delivery review/i);
});

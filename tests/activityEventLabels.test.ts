import assert from "node:assert/strict";
import test from "node:test";

import { translate, type MessageKey } from "../i18n/catalog";
import {
  activityCategoryLabel,
  activityCategoryLabelKey,
  activityEvidenceTypeLabel,
  activityRelatedEntityLabel,
  activityStatusLabel,
  activityTriggerLabel,
  humanizeActivityToken
} from "../services/presentation/activityEventLabels";

const tEn = (key: MessageKey) => translate("en", key);
const tEs = (key: MessageKey) => translate("es", key);
const tZh = (key: MessageKey) => translate("zh-Hans", key);

test("activity category and status labels stay localized for operator locales", () => {
  assert.equal(activityCategoryLabelKey("inventory"), "activity.category.inventory");
  assert.equal(activityCategoryLabel("approvals", tEn), "Approvals");
  assert.equal(activityCategoryLabel("approvals", tEs), "Aprobaciones");
  assert.equal(activityCategoryLabel("approvals", tZh), "审批");

  assert.equal(activityStatusLabel("waiting_for_approval", tEn), "Waiting for approval");
  assert.equal(activityStatusLabel("waiting_for_approval", tEs), "Esperando aprobación");
  assert.equal(activityStatusLabel("waiting_for_approval", tZh), "等待审批");
  assert.equal(activityStatusLabel("could_not_verify", tEs), "No se pudo verificar");
});

test("activity related entity and known trigger labels localize without raw snake_case", () => {
  assert.equal(activityRelatedEntityLabel("supplier_order", tEn), "Supplier order");
  assert.equal(activityRelatedEntityLabel("supplier_order", tEs), "Pedido a proveedor");
  assert.equal(activityRelatedEntityLabel("recalculation_run", tZh), "重新计算");

  assert.equal(activityTriggerLabel("pos_sync", tEn), "POS sync");
  assert.equal(activityTriggerLabel("pos_sync", tEs), "Sincronización POS");
  assert.equal(activityTriggerLabel("owner_approval", tZh), "所有者批准");
  assert.equal(activityTriggerLabel("inventory_count_recorded", tEs), "Conteo de inventario registrado");
});

test("unknown activity tokens humanize instead of crashing", () => {
  assert.equal(humanizeActivityToken("custom_source_token"), "custom source token");
  assert.equal(activityTriggerLabel("brand_new_trigger", tEn), "brand new trigger");
  assert.equal(activityEvidenceTypeLabel("inventory_item", tEs), "Artículo de inventario");
  assert.equal(activityEvidenceTypeLabel("opaque_evidence_type", tEn), "opaque evidence type");
});

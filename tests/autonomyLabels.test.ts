import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog.ts";
import { autonomyLevelLabel } from "../services/domain/operationalStatus.ts";
import {
  autonomyActionTypeLabelKey,
  autonomyCategoryLabelKey,
  autonomyLevelLabelKey,
  presentAutonomyActionTypeLabel,
  presentAutonomyCategoryLabel,
  presentAutonomyLevelLabel
} from "../services/presentation/autonomyLabels.ts";

test("autonomy level label keys stay aligned with English domain fallbacks", () => {
  const levels = [1, 2, 3, 4, 5] as const;
  for (const level of levels) {
    assert.equal(translate("en", autonomyLevelLabelKey(level)), autonomyLevelLabel(level));
  }
  assert.equal(presentAutonomyLevelLabel(1, (key) => translate("es", key)), "Observar");
  assert.equal(presentAutonomyLevelLabel(5, (key) => translate("zh-Hans", key)), "优化");
});

test("autonomy category and known action-type labels localize without inventing keys", () => {
  assert.equal(autonomyCategoryLabelKey("orders"), "autonomy.category.orders");
  assert.equal(autonomyActionTypeLabelKey("send_supplier_order"), "autonomy.actionType.send_supplier_order");
  assert.equal(autonomyActionTypeLabelKey("not_a_real_action"), null);

  assert.equal(presentAutonomyCategoryLabel("waste", (key) => translate("es", key)), "Merma");
  assert.equal(
    presentAutonomyActionTypeLabel("prepare_supplier_order_draft", (key) => translate("zh-Hans", key)),
    "准备供应商订单草稿"
  );
  assert.equal(
    presentAutonomyActionTypeLabel("legacy_custom_action", (key) => translate("en", key)),
    "legacy custom action"
  );
  assert.equal(presentAutonomyActionTypeLabel("   ", (key) => translate("en", key)), "—");
});

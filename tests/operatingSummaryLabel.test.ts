import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog.ts";
import {
  OPERATING_SUMMARY_ATTENTION_RE,
  operatingSummaryLabelKey,
  parseOperatingSummary,
  presentOperatingSummaryLabel
} from "../services/presentation/operatingSummaryLabel.ts";

test("operating summary parses only the exact domain attention template", () => {
  assert.deepEqual(parseOperatingSummary("Mise found 1 item that may need attention before tomorrow."), {
    kind: "attention",
    count: 1
  });
  assert.deepEqual(parseOperatingSummary("Mise found 0 items that may need attention before tomorrow."), {
    kind: "attention",
    count: 0
  });
  assert.deepEqual(parseOperatingSummary("Mise found 12 items that may need attention before tomorrow."), {
    kind: "attention",
    count: 12
  });
  assert.match("Mise found 3 items that may need attention before tomorrow.", OPERATING_SUMMARY_ATTENTION_RE);
  assert.equal(parseOperatingSummary("Two items need attention before tomorrow.").kind, "unknown");
  assert.equal(parseOperatingSummary("Mise found two items that may need attention before tomorrow.").kind, "unknown");
  assert.equal(parseOperatingSummary("Invented operational fact").kind, "unknown");
});

test("operating summary label keys pluralize by count", () => {
  assert.equal(operatingSummaryLabelKey(1), "dailyReport.operatingSummary.attention.one");
  assert.equal(operatingSummaryLabelKey(0), "dailyReport.operatingSummary.attention.other");
  assert.equal(operatingSummaryLabelKey(2), "dailyReport.operatingSummary.attention.other");
});

test("daily report operatingSummary localizes known templates without inventing facts", () => {
  assert.equal(
    presentOperatingSummaryLabel("Mise found 1 item that may need attention before tomorrow.", (key, values) =>
      translate("es", key, values)
    ),
    "Mise encontró 1 artículo que puede necesitar atención antes de mañana."
  );
  assert.equal(
    presentOperatingSummaryLabel("Mise found 3 items that may need attention before tomorrow.", (key, values) =>
      translate("zh-Hans", key, values)
    ),
    "Mise 发现 3 个项目在明天前可能需要关注。"
  );
  assert.equal(
    presentOperatingSummaryLabel("Mise found 2 items that may need attention before tomorrow.", (key, values) =>
      translate("en", key, values)
    ),
    "Mise found 2 items that may need attention before tomorrow."
  );
  assert.equal(
    presentOperatingSummaryLabel("Custom hosted summary", (key) => translate("en", key)),
    "Custom hosted summary"
  );
  assert.equal(presentOperatingSummaryLabel("   ", (key) => translate("en", key)), "—");
});

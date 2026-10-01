import assert from "node:assert/strict";
import test from "node:test";

import type { MessageKey, MessageValues } from "../i18n/catalog";
import {
  MISE_STATUS_MONITORING_EN,
  miseStatusLabelKey,
  presentMiseStatusLabel
} from "../services/presentation/miseStatusLabel";

const t = (key: MessageKey, _values?: MessageValues) => `translated:${key}`;

test("miseStatusLabelKey maps known Ready/Watch/Attention badges", () => {
  assert.equal(miseStatusLabelKey("Ready"), "dailyReport.miseStatus.ready");
  assert.equal(miseStatusLabelKey("Watch"), "dailyReport.miseStatus.watch");
  assert.equal(miseStatusLabelKey("Attention"), "dailyReport.miseStatus.attention");
});

test("miseStatusLabelKey maps the exact monitoring sentence from buildTodaySummary", () => {
  assert.equal(miseStatusLabelKey(MISE_STATUS_MONITORING_EN), "dailyReport.miseStatus.monitoring");
});

test("miseStatusLabelKey leaves unknown or invented status facts unmapped", () => {
  assert.equal(miseStatusLabelKey("Ready "), null);
  assert.equal(miseStatusLabelKey("ready"), null);
  assert.equal(miseStatusLabelKey("Critical"), null);
  assert.equal(miseStatusLabelKey(""), null);
});

test("presentMiseStatusLabel localizes known statuses and preserves unknown copy", () => {
  assert.equal(presentMiseStatusLabel("Watch", t), "translated:dailyReport.miseStatus.watch");
  assert.equal(
    presentMiseStatusLabel(MISE_STATUS_MONITORING_EN, t),
    "translated:dailyReport.miseStatus.monitoring"
  );
  assert.equal(presentMiseStatusLabel("Custom vendor note", t), "Custom vendor note");
  assert.equal(presentMiseStatusLabel("  ", t), "—");
});

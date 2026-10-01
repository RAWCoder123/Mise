import assert from "node:assert/strict";
import test from "node:test";

import { translate, type AppLocale, type MessageKey, type MessageValues } from "../i18n/catalog";
import {
  buildChecklistCompletionEvidence,
  presentSharedTaskEvidence,
  sharedChecklistRowLabel
} from "../services/presentation/sharedTaskEvidence";

const locales: AppLocale[] = ["en", "es", "zh-Hans"];

function tFor(locale: AppLocale) {
  return (key: MessageKey, values: MessageValues = {}) => translate(locale, key, values);
}

test("checklist completion evidence stays locale-neutral and omits invented English labels", () => {
  const evidence = buildChecklistCompletionEvidence([
    { type: "checklist_item", label: "Walk-in temps logged" },
    { type: "checklist_item" },
    { type: "checklist_item", label: "  " },
    { label: "Close register" }
  ]);

  assert.deepEqual(evidence, [
    { type: "checklist_item", label: "Walk-in temps logged", completed: true },
    { type: "checklist_item", completed: true },
    { type: "checklist_item", completed: true },
    { type: "checklist_item", label: "Close register", completed: true }
  ]);
  assert.equal(
    JSON.stringify(evidence).includes("Completed checklist item"),
    false,
    "must not bake English UI fallback into durable evidence"
  );
});

test("shared checklist rows never print machine type codes", () => {
  for (const locale of locales) {
    const t = tFor(locale);
    assert.equal(
      sharedChecklistRowLabel({ type: "checklist_item", label: "Sanitizer buckets" }, 0, t),
      "Sanitizer buckets"
    );
    assert.equal(
      sharedChecklistRowLabel({ type: "checklist_item" }, 2, t),
      t("tasks.shared.checklistItem", { number: 3 })
    );
    assert.doesNotMatch(
      sharedChecklistRowLabel({ type: "checklist_item" }, 0, t),
      /checklist_item/
    );
  }
});

test("completion evidence presentation localizes type fallbacks in every locale", () => {
  for (const locale of locales) {
    const t = tFor(locale);
    assert.equal(
      presentSharedTaskEvidence({ type: "checklist_item", note: "Counted 18 lb" }, t),
      "Counted 18 lb"
    );
    assert.equal(
      presentSharedTaskEvidence({ type: "checklist_item", label: "Walk-in temps" }, t),
      "Walk-in temps"
    );
    assert.equal(
      presentSharedTaskEvidence({ type: "checklist_item" }, t),
      t("tasks.shared.checklistItemCompleted")
    );
    assert.equal(
      presentSharedTaskEvidence({ type: "count" }, t),
      t("tasks.shared.verification.count")
    );
    assert.equal(
      presentSharedTaskEvidence({ type: "receipt" }, t),
      t("tasks.shared.verification.receipt")
    );
    assert.doesNotMatch(presentSharedTaskEvidence({ type: "checklist_item" }, t), /checklist_item/);
    if (locale !== "en") {
      assert.doesNotMatch(
        presentSharedTaskEvidence({ type: "checklist_item" }, t),
        /Completed checklist item/
      );
    }
  }

  assert.equal(
    presentSharedTaskEvidence({ type: "checklist_item" }, tFor("es")),
    "Elemento de lista completado"
  );
  assert.equal(
    presentSharedTaskEvidence({ type: "checklist_item" }, tFor("zh-Hans")),
    "已完成的检查项"
  );
});

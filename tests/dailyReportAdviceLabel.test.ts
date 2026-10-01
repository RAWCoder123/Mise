import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog.ts";
import {
  credibilityLabelKey,
  credibilityNextStepKey,
  presentCredibilityLabel,
  presentCredibilityNextStep
} from "../services/presentation/credibilityLabel.ts";
import {
  presentManagerAdviceDetail,
  presentManagerAdviceTitle
} from "../services/presentation/dailyReportAdviceLabel.ts";
import {
  emptySignalLineKey,
  parseEmptySignalLine,
  presentDailyReportSignalLine
} from "../services/presentation/dailyReportSignalLine.ts";

test("manager advice titles localize known templates without inventing facts", () => {
  assert.equal(
    presentManagerAdviceTitle("1 stock item need attention", (key, values) =>
      translate("es", key, values)
    ),
    "1 artículo de stock necesita atención"
  );
  assert.equal(
    presentManagerAdviceTitle("3 stock items need attention", (key, values) =>
      translate("zh-Hans", key, values)
    ),
    "3 个库存品需要关注"
  );
  assert.equal(
    presentManagerAdviceTitle("2 order recommendations waiting", (key, values) =>
      translate("en", key, values)
    ),
    "2 order recommendations waiting"
  );
  assert.equal(
    presentManagerAdviceTitle("1 open task still on the board", (key, values) =>
      translate("es", key, values)
    ),
    "1 tarea abierta sigue en el tablero"
  );
  assert.equal(
    presentManagerAdviceTitle("Closeout looks clear", (key) => translate("zh-Hans", key)),
    "收工状态清晰"
  );
  assert.equal(
    presentManagerAdviceTitle("Suggested order is ready to approve", (key) => translate("es", key)),
    "El pedido sugerido está listo para aprobar"
  );
  assert.equal(
    presentManagerAdviceTitle("2 inventory alerts need review", (key, values) =>
      translate("es", key, values)
    ),
    "2 alertas de inventario necesitan revisión"
  );
  assert.equal(
    presentManagerAdviceTitle("Chicken thighs looks stable", (key, values) =>
      translate("zh-Hans", key, values)
    ),
    "Chicken thighs 看起来稳定"
  );
  assert.equal(
    presentManagerAdviceTitle("Custom hosted insight title", (key) => translate("en", key)),
    "Custom hosted insight title"
  );
  assert.equal(presentManagerAdviceTitle("   ", (key) => translate("en", key)), "—");
});

test("manager advice details localize known templates without inventing facts", () => {
  assert.equal(
    presentManagerAdviceDetail(
      "Review critical and low projected coverage before the next service.",
      (key) => translate("es", key)
    ),
    "Revisa la cobertura crítica y baja proyectada antes del próximo servicio."
  );
  assert.equal(
    presentManagerAdviceDetail("Mise prepared 1 item for supplier review.", (key, values) =>
      translate("zh-Hans", key, values)
    ),
    "Mise 已准备 1 个品项供供应商复核。"
  );
  assert.equal(
    presentManagerAdviceDetail("Mise prepared 4 items for supplier review.", (key, values) =>
      translate("en", key, values)
    ),
    "Mise prepared 4 items for supplier review."
  );
  assert.equal(
    presentManagerAdviceDetail("Insight-specific detail stays English", (key) =>
      translate("es", key)
    ),
    "Insight-specific detail stays English"
  );
  assert.equal(presentManagerAdviceDetail("   ", (key) => translate("en", key)), "—");
});

test("credibility labels and next steps localize only known domain strings", () => {
  assert.equal(
    credibilityLabelKey("Automation credibility high"),
    "dailyReport.learning.credibility.high"
  );
  assert.equal(credibilityLabelKey("Invented operational fact"), null);
  assert.equal(
    presentCredibilityLabel("Credibility building", (key) => translate("es", key)),
    "Credibilidad en construcción"
  );
  assert.equal(
    presentCredibilityLabel("More operator evidence needed", (key) => translate("zh-Hans", key)),
    "需要更多运营方证据"
  );
  assert.equal(
    presentCredibilityLabel("Custom hosted label", (key) => translate("en", key)),
    "Custom hosted label"
  );

  assert.equal(
    credibilityNextStepKey(
      "Add missing recipe baselines before trusting automated ordering."
    ),
    "dailyReport.learning.nextStep.addRecipes"
  );
  assert.equal(credibilityNextStepKey("Invented next step"), null);
  assert.equal(
    presentCredibilityNextStep(
      "Approve or adjust the supplier queue so Mise learns your ordering judgment.",
      (key) => translate("es", key)
    ),
    "Aprueba o ajusta la cola de proveedores para que Mise aprenda tu criterio de pedido."
  );
  assert.equal(
    presentCredibilityNextStep(
      "Keep updating counts after service so Mise can sharpen reorder timing.",
      (key) => translate("zh-Hans", key)
    ),
    "服务结束后继续更新盘点，以便 Mise 精进补货时机。"
  );
});

test("empty closeout signal lines localize by type; insight lines pass through", () => {
  assert.deepEqual(parseEmptySignalLine("No waste signal for closeout."), {
    kind: "empty",
    type: "waste"
  });
  assert.equal(emptySignalLineKey("prep"), "dailyReport.signal.empty.prep");
  assert.equal(parseEmptySignalLine("Waste spiked today — review herbs.").kind, "unknown");
  assert.equal(
    presentDailyReportSignalLine("No inventory signal for closeout.", (key) =>
      translate("es", key)
    ),
    "Sin señal de inventario para el cierre."
  );
  assert.equal(
    presentDailyReportSignalLine("No sales signal for closeout.", (key) =>
      translate("zh-Hans", key)
    ),
    "收工时无销售信号。"
  );
  assert.equal(
    presentDailyReportSignalLine("Do the thing — It matters", (key) => translate("es", key)),
    "Do the thing — It matters"
  );
  assert.equal(presentDailyReportSignalLine("   ", (key) => translate("en", key)), "—");
});

import assert from "node:assert/strict";
import test from "node:test";

import { presentDailyReportMemory } from "../services/presentation/dailyReportMemoryLabel";

const buildingMemory = {
  memoryLabel: "Mise memory is building",
  memoryCopy:
    "Mise is collecting recipe, sales, count, and ordering evidence before it should automate more of the workflow.",
  memoryNextStep:
    "Map the missing POS items to ingredients before relying on automated ordering.",
  memoryPresentation: {
    labelCode: "memory.label.building" as const,
    operatorCopyCode: "memory.copy.building" as const,
    nextStepCode: "memory.next.recipe_coverage" as const
  }
};

test("presentDailyReportMemory localizes structured codes for ES and zh-Hans", () => {
  const english = presentDailyReportMemory("en", buildingMemory);
  const spanish = presentDailyReportMemory("es", buildingMemory);
  const chinese = presentDailyReportMemory("zh-Hans", buildingMemory);

  assert.ok(english.memoryCopy);
  assert.ok(english.memoryNextStep);
  assert.notEqual(spanish.memoryCopy, buildingMemory.memoryCopy);
  assert.notEqual(spanish.memoryNextStep, buildingMemory.memoryNextStep);
  assert.notEqual(chinese.memoryCopy, buildingMemory.memoryCopy);
  assert.notEqual(chinese.memoryNextStep, buildingMemory.memoryNextStep);
  assert.match(spanish.memoryCopy ?? "", /recetas|evidencia|pedidos/i);
  assert.match(chinese.memoryCopy ?? "", /配方|销售|盘点|订/);
});

test("presentDailyReportMemory keeps raw evidence when presentation is absent", () => {
  const raw = presentDailyReportMemory("es", {
    memoryLabel: "Friday demand",
    memoryCopy: "Friday dinner demand is usually higher.",
    memoryNextStep: "Review the next Friday.",
    memoryPresentation: null
  });
  assert.equal(raw.memoryCopy, "Friday dinner demand is usually higher.");
  assert.equal(raw.memoryNextStep, "Review the next Friday.");
});

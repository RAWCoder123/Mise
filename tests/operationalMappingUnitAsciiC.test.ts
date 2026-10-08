import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeOperationalQuantity } from "../services/domain/operationalMapping";

const mappingSource = readFileSync(
  new URL("../services/domain/operationalMapping.ts", import.meta.url),
  "utf8"
);

test("MISE-005KN pins operationalMapping unit identity to ASCII C case fold", () => {
  assert.match(mappingSource, /MISE-005KN/);
  assert.match(
    mappingSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = mappingSource.slice(
    mappingSource.indexOf("function normalizeUnit(value: string)"),
    mappingSource.indexOf("function failedQuantity(")
  );

  assert.match(normalizeBody, /asciiCLower\(value\)/);
  assert.match(normalizeBody, /\[ \\t\\n\\r\\f\\v\]\+/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);
});

test("ASCII C fold keeps ordinary operational unit aliases stable", () => {
  assert.deepEqual(normalizeOperationalQuantity({ quantity: 1, unit: "KG" }), {
    ok: true,
    quantity: 1000,
    unit: "g",
    blockers: []
  });
  assert.deepEqual(normalizeOperationalQuantity({ quantity: 1, unit: "  Lb  " }), {
    ok: true,
    quantity: 453.59237,
    unit: "g",
    blockers: []
  });
  assert.equal(
    normalizeOperationalQuantity({ quantity: 1, unit: "fl. oz." }).unit,
    "ml"
  );
  assert.equal(
    normalizeOperationalQuantity({ quantity: 1, unit: "FL. OZ." }).quantity,
    29.5735295625
  );
});

test("ASCII C fold does not invent Kelvin-sign kg mass alias", () => {
  // Unicode toLocaleLowerCase / toLowerCase would fold K → k and invent kg.
  assert.equal("Kg".toLowerCase(), "kg");
  assert.equal("Kg".toLocaleLowerCase(), "kg");
  assert.equal("KG".toLowerCase(), "kg");

  assert.deepEqual(normalizeOperationalQuantity({ quantity: 1, unit: "Kg" }), {
    ok: false,
    quantity: null,
    unit: null,
    blockers: ["unknown_unit"]
  });
  assert.deepEqual(normalizeOperationalQuantity({ quantity: 1, unit: "KG" }), {
    ok: false,
    quantity: null,
    unit: null,
    blockers: ["unknown_unit"]
  });
  assert.notDeepEqual(normalizeOperationalQuantity({ quantity: 1, unit: "Kg" }), {
    ok: true,
    quantity: 1000,
    unit: "g",
    blockers: []
  });
});

test("ASCII C unit trim ignores NBSP; controls are not Unicode \\s collapse", () => {
  // NBSP-only padding is outside ASCII whitespace; do not treat it as a trim break.
  assert.deepEqual(
    normalizeOperationalQuantity({ quantity: 1, unit: "\u00a0kg\u00a0" }),
    {
      ok: false,
      quantity: null,
      unit: null,
      blockers: ["unknown_unit"]
    }
  );
  assert.equal("\u00a0kg\u00a0".trim().toLocaleLowerCase(), "kg");

  assert.deepEqual(
    normalizeOperationalQuantity({ quantity: 1, unit: "k\ng" }),
    {
      ok: false,
      quantity: null,
      unit: null,
      blockers: ["unknown_unit"]
    }
  );
});

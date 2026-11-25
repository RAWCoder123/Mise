import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_LINE_NORMALIZATION_VERSION,
  foldPurchaseLineAccents,
  markCurrentPurchaseLines,
  normalizePurchaseLineDescription,
  normalizePurchaseLineInput,
  purchaseLineUnitDimension,
  resolvePurchaseLineConfidence,
  type PurchaseLine
} from "../services/domain/purchaseLines";

function key(raw: string) {
  return normalizePurchaseLineDescription(raw).normalizedItemKey;
}

function pack(raw: string) {
  return normalizePurchaseLineDescription(raw).packSize;
}

test("normalization folds case, whitespace, and punctuation deterministically", () => {
  const variants = [
    "Chicken Thighs Boneless 40 LB Case",
    "  chicken   thighs   boneless  40lb  case ",
    "CHICKEN THIGHS, BONELESS - 40 LB CASE",
    "chicken thighs; boneless -- 40lb case"
  ];
  for (const variant of variants) {
    assert.equal(key(variant), "chicken thighs boneless case", variant);
    assert.equal(pack(variant), "40lb", variant);
  }
});

test("pack and size are lifted out of the key into their own field", () => {
  assert.equal(key("Olive Oil X-Virgin 6/1GAL"), "olive oil x virgin");
  assert.equal(pack("Olive Oil X-Virgin 6/1GAL"), "6x1gal");
  assert.equal(pack("OLIVE OIL X VIRGIN 6 / 1 gal"), "6x1gal");
  assert.equal(pack("Olive Oil, X-Virgin, 6 x 1 GAL"), "6x1gal");
  assert.equal(pack("Heavy Cream 12/32oz"), "12x32oz");
  assert.equal(pack("Napa Cabbage - 50 ct"), "50ct");
  assert.equal(pack("All-Purpose Flour 50 lbs"), "50lbs");
});

test("pack size rendering does not vary with how the number was spelled", () => {
  for (const variant of ["Sugar 1 kg", "Sugar 1.0kg", "Sugar 1.00 KG"]) {
    assert.equal(pack(variant), "1kg", variant);
    assert.equal(key(variant), "sugar", variant);
  }
  assert.equal(pack("Item 1.50 kg pack"), "1.5kg");
});

test("normalization is idempotent and stable across repeated runs", () => {
  const samples = [
    "Tomatoes, Roma 25LB",
    "Jalapeño Peppers 10 LB",
    "2% Milk 4/1gal",
    "Yukon Gold Potatoes #1 50LB",
    "Butter Unsalted 36/1LB"
  ];
  for (const sample of samples) {
    const first = normalizePurchaseLineDescription(sample);
    const second = normalizePurchaseLineDescription(sample);
    assert.deepEqual(first, second, sample);
    assert.equal(first.normalizationVersion, PURCHASE_LINE_NORMALIZATION_VERSION);
  }
});

test("ambiguity is preserved rather than resolved", () => {
  // No stemming, no synonyms, no fuzzy matching: near-identical descriptions
  // that a human would merge stay distinct keys in MISE-004C.
  assert.notEqual(key("Chicken Thigh 40lb"), key("Chicken Thighs 40lb"));
  assert.notEqual(key("Chicken Thighs 40lb case"), key("Chicken Thighs 40lb cs"));
  assert.notEqual(key("Roma Tomatoes"), key("Tomatoes Roma"));
});

test("a number only counts as pack size next to a known unit", () => {
  assert.equal(pack("2% Milk"), null);
  assert.equal(key("2% Milk"), "2 milk");
  assert.equal(pack("Beef Strip Loin 0x1 (whole)"), null);
  // A digit run welded to a word is not a pack token in either runtime.
  assert.equal(pack("chicken5lb no space"), null);
  assert.equal(pack("Line_5lb thing"), null);
});

test("a description with nothing alphanumeric yields no key", () => {
  assert.equal(key("###"), null);
  assert.equal(key("   "), null);
});

test("confidence is lowered for partial parses and never raised", () => {
  const complete = {
    requested: "confirmed" as const,
    quantity: 2,
    unitOfMeasure: "case",
    unitPrice: 86.5,
    extendedPrice: 173,
    normalizedItemKey: "chicken thighs"
  };
  assert.equal(resolvePurchaseLineConfidence(complete), "confirmed");
  assert.equal(
    resolvePurchaseLineConfidence({ ...complete, requested: "estimated" }),
    "estimated",
    "an estimate is never promoted to confirmed"
  );
  for (const missing of ["quantity", "unitOfMeasure", "unitPrice", "extendedPrice"] as const) {
    assert.equal(
      resolvePurchaseLineConfidence({ ...complete, [missing]: null }),
      "could_not_verify",
      `missing ${missing} must be visible`
    );
  }
});

test("a partially parsed line keeps its gaps instead of defaulting them", () => {
  const line = normalizePurchaseLineInput({
    lineIndex: 2,
    lineType: "purchase" as const,
    rawItemDescription: "Napa Cabbage - 50 ct",
    quantity: 1,
    unitOfMeasure: "case",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed"
  });
  assert.equal(line.unitPrice, null);
  assert.equal(line.extendedPrice, null);
  assert.equal(line.currency, null);
  assert.equal(line.parseConfidence, "could_not_verify");
  assert.equal(line.normalizedItemKey, "napa cabbage");
  assert.equal(line.packSize, "50ct");
});

test("a missing unit alone is enough to mark a line unverified", () => {
  const line = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Tomatoes, Roma 25LB",
    quantity: 4,
    unitPrice: 18.5,
    extendedPrice: 74,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed"
  });
  assert.equal(line.unitOfMeasure, null);
  assert.equal(line.parseConfidence, "could_not_verify");
});

test("an explicit pack size from the document wins over the extracted one", () => {
  const line = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    packSize: "6/1 GAL",
    transactionDate: "2026-09-01",
    parseConfidence: "estimated"
  });
  assert.equal(line.packSize, "6/1 GAL");
});

test("line input rejects unusable evidence rather than coercing it", () => {
  const base = {
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Tomatoes 25lb",
    transactionDate: "2026-09-01",
    parseConfidence: "estimated" as const
  };
  assert.throws(() => normalizePurchaseLineInput({ ...base, rawItemDescription: "  " }));
  assert.throws(() => normalizePurchaseLineInput({ ...base, lineIndex: -1 }));
  assert.throws(() => normalizePurchaseLineInput({ ...base, lineIndex: 1.5 }));
  assert.throws(() => normalizePurchaseLineInput({ ...base, quantity: -3 }));
  assert.throws(() => normalizePurchaseLineInput({ ...base, transactionDate: "09/01/2026" }));
  assert.throws(() => normalizePurchaseLineInput({ ...base, unitPrice: 4, currency: "usd" }));
  assert.throws(
    () => normalizePurchaseLineInput({ ...base, unitPrice: 4 }),
    /currency/,
    "a price without a currency is not recordable"
  );
});

test("current lines are derived from supersession rather than stored", () => {
  const base: PurchaseLine = {
    id: "line-1",
    restaurantId: "r1",
    supplierId: null,
    lineIndex: 0,
    lineType: "purchase" as const,
    revision: 0,
    rawItemDescription: "Napa Cabbage - 50 ct",
    normalizedItemKey: "napa cabbage",
    normalizationVersion: PURCHASE_LINE_NORMALIZATION_VERSION,
    quantity: 1,
    unitOfMeasure: "case",
    packSize: "50ct",
    unitPrice: null,
    extendedPrice: null,
    currency: null,
    transactionDate: "2026-09-01",
    receivedDate: null,
    source: "invoice",
    sourceDocumentReference: "INV-4471",
    correlationId: "c1",
    parseConfidence: "could_not_verify",
    consistencyFlags: [],
    signedQuantity: 1,
    signedExtendedPrice: null,
    creditsLineId: null,
    supersedesLineId: null,
    evidenceVersion: "mise.purchase_line.v1",
    recordedBy: null,
    recordedAt: "2026-09-01T10:00:00.000Z"
  };
  const correction: PurchaseLine = {
    ...base,
    id: "line-2",
    revision: 1,
    supersedesLineId: "line-1",
    quantity: 2,
    unitPrice: 31.25,
    extendedPrice: 62.5,
    currency: "USD",
    parseConfidence: "confirmed"
  };
  const marked = markCurrentPurchaseLines([base, correction]);
  assert.equal(marked[0]!.current, false, "a corrected line is no longer current");
  assert.equal(marked[1]!.current, true);
  // The superseded line is still present and unchanged: history is not rewritten.
  assert.equal(marked[0]!.quantity, 1);
  assert.equal(marked[0]!.parseConfidence, "could_not_verify");
});

test("arithmetic contradiction between quantity, unit price, and extended price", () => {
  const line = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    quantity: 2,
    unitOfMeasure: "case",
    unitPrice: 86.5,
    extendedPrice: 1730,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(line.consistencyFlags, ["extended_price_mismatch"]);
  assert.equal(line.parseConfidence, "could_not_verify");
  assert.equal(line.extendedPrice, 1730, "the document's number is kept, not corrected");
  assert.equal(line.statedConfidence, "confirmed", "what was claimed is preserved");
});

test("the arithmetic tolerance absorbs ordinary invoice rounding", () => {
  // A unit price printed to the cent is only known to within half a cent.
  const line = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Tomatoes, Roma 25LB",
    quantity: 30,
    unitOfMeasure: "lb",
    unitPrice: 1.33,
    extendedPrice: 39.99,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(line.consistencyFlags, []);
  assert.equal(line.parseConfidence, "confirmed");
});

test("a pack size and a unit of measure in different dimensions cannot be confirmed", () => {
  const line = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    quantity: 1,
    unitOfMeasure: "lb",
    unitPrice: 121.4,
    extendedPrice: 121.4,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(line.consistencyFlags, ["pack_unit_dimension_conflict"]);
  assert.equal(line.parseConfidence, "could_not_verify");
});

test("a container unit never conflicts with a pack size", () => {
  for (const unit of ["case", "box", "pack", "bag", "each"]) {
    const line = normalizePurchaseLineInput({
      lineIndex: 0,
      lineType: "purchase" as const,
      rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
      quantity: 1,
      unitOfMeasure: unit,
      unitPrice: 121.4,
      extendedPrice: 121.4,
      currency: "USD",
      transactionDate: "2026-09-01",
      parseConfidence: "confirmed"
    });
    assert.deepEqual(line.consistencyFlags, [], unit);
    assert.equal(line.parseConfidence, "confirmed", unit);
  }
});

test("a receipt dated before the transaction downgrades to estimated, not unverified", () => {
  const line = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Napa Cabbage - 50 ct",
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 31.25,
    extendedPrice: 31.25,
    currency: "USD",
    transactionDate: "2026-09-05",
    receivedDate: "2026-09-01",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(line.consistencyFlags, ["received_before_transaction"]);
  assert.equal(line.parseConfidence, "estimated", "the money is still readable");
});

test("a stated pack size the description does not support downgrades to estimated", () => {
  const line = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    packSize: "12/1 GAL",
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 121.4,
    extendedPrice: 121.4,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(line.consistencyFlags, ["pack_size_conflicts_description"]);
  assert.equal(line.parseConfidence, "estimated");
  assert.equal(line.packSize, "12/1 GAL", "the stated pack is kept verbatim");
});

test("a pack size that merely restates the description is not a conflict", () => {
  const line = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    packSize: "6 / 1 gal",
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 121.4,
    extendedPrice: 121.4,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(line.consistencyFlags, []);
  assert.equal(line.parseConfidence, "confirmed");
});

test("the lowest of the three ceilings wins, and none of them can raise", () => {
  assert.equal(
    resolvePurchaseLineConfidence({
      requested: "estimated",
      quantity: 2, unitOfMeasure: "case", unitPrice: 86.5, extendedPrice: 173,
      normalizedItemKey: "chicken", consistencyFlags: []
    }),
    "estimated",
    "a clean line never rises above what was claimed"
  );
  assert.equal(
    resolvePurchaseLineConfidence({
      requested: "confirmed",
      quantity: 2, unitOfMeasure: "case", unitPrice: 86.5, extendedPrice: 173,
      normalizedItemKey: "chicken", consistencyFlags: ["received_before_transaction"]
    }),
    "estimated"
  );
  assert.equal(
    resolvePurchaseLineConfidence({
      requested: "estimated",
      quantity: 2, unitOfMeasure: "case", unitPrice: 86.5, extendedPrice: 173,
      normalizedItemKey: "chicken", consistencyFlags: ["extended_price_mismatch"]
    }),
    "could_not_verify",
    "a contradiction outranks a milder claim"
  );
});

test("counting units behave like containers and never conflict with a pack", () => {
  // "1 each" of a 6x1gal case counts packages; it claims nothing about volume.
  for (const unit of ["each", "ea", "ct", "count", "dozen", "dz"]) {
    assert.equal(purchaseLineUnitDimension(unit), null, unit);
  }
  assert.equal(purchaseLineUnitDimension("lb"), "mass");
  assert.equal(purchaseLineUnitDimension("GAL"), "volume");
});

test("a credit is a stated direction, never a negative number", () => {
  const credit = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "credit",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 86.5,
    extendedPrice: 86.5,
    currency: "USD",
    transactionDate: "2026-09-03",
    parseConfidence: "confirmed"
  });
  assert.equal(credit.lineType, "credit");
  assert.equal(credit.quantity, 1, "magnitudes stay positive");
  assert.equal(credit.parseConfidence, "confirmed", "linkage never affects confidence");
  assert.equal(credit.creditsLineId, null, "an unmatched credit is ordinary");
  assert.throws(
    () => normalizePurchaseLineInput({ ...credit, quantity: -1 }),
    "a negative quantity stays a parse error rather than becoming a credit"
  );
});

test("the consistency rules apply to credits on magnitudes, with no sign convention", () => {
  const inconsistentCredit = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "credit",
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 121.4,
    extendedPrice: 1214,
    currency: "USD",
    transactionDate: "2026-09-03",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(inconsistentCredit.consistencyFlags, ["extended_price_mismatch"]);
  assert.equal(inconsistentCredit.parseConfidence, "could_not_verify");
});

test("only a credit may reference the line it offsets", () => {
  assert.throws(
    () => normalizePurchaseLineInput({
      lineIndex: 0,
      lineType: "purchase",
      creditsLineId: "0d1d1a1a-0000-4000-8000-000000000001",
      rawItemDescription: "Tomatoes, Roma 25LB",
      transactionDate: "2026-09-01",
      parseConfidence: "estimated"
    }),
    /Only a credit line may reference/
  );
});

test("every writer must state direction", () => {
  assert.throws(
    () => normalizePurchaseLineInput({
      lineIndex: 0,
      rawItemDescription: "Tomatoes, Roma 25LB",
      transactionDate: "2026-09-01",
      parseConfidence: "estimated"
    } as never),
    /purchase or a credit/
  );
});

test("accent folding makes the key locale-independent and ASCII", () => {
  // Every case change and class test is pinned to C in both runtimes, so an
  // accented description folds to plain ASCII rather than depending on the
  // machine's LC_CTYPE.
  const cases: [string, string | null][] = [
    ["Jalapeño Peppers 10 LB", "jalapeno peppers"],
    ["CRÈME FRAÎCHE", "creme fraiche"],
    ["Gruyère AOP 2.5kg", "gruyere aop"],
    ["Müller-Thurgau", "muller thurgau"],
    ["Æbleskiver mix", "aebleskiver mix"],
    ["Weißbier 24/500ml", "weissbier"],
    ["Œuf", "oeuf"],
    ["Łukasz Pierogi 5lb", "lukasz pierogi"],
    ["café blend", "cafe blend"],
    ["豚バラ肉 5kg", null]
  ];
  for (const [raw, expected] of cases) {
    assert.equal(key(raw), expected, raw);
    if (expected !== null) {
      assert.match(key(raw)!, /^[a-z0-9 ]+$/, `${raw} must fold to plain ASCII`);
    }
  }
});

test("case and accent agree on one key, which is what netting depends on", () => {
  assert.equal(key("JALAPEÑO PEPPERS"), key("jalapeño peppers"));
  assert.equal(key("JALAPEÑO PEPPERS"), "jalapeno peppers");
  assert.equal(key("Jalapeno Peppers"), key("JALAPEÑO PEPPERS"));
});

test("an unmapped non-ASCII character is a separator, never a letter", () => {
  // Deterministic on every machine: it can never count as alphanumeric under
  // one ctype and as punctuation under another.
  assert.equal(key("豚バラ肉"), null);
  assert.equal(key("café ☕ blend"), "cafe blend");
  assert.equal(key("Ω Ω Ω"), null);
});

test("pack extraction still reads through accented text", () => {
  assert.equal(pack("crème fraîche 6/1GAL"), "6x1gal");
  assert.equal(pack("Gruyère AOP 2.5kg"), "2.5kg");
  assert.equal(pack("Æbleskiver 12 ct"), "12ct");
});

test("the SQL and TypeScript accent folds are the same map", () => {
  // Both are generated from one source; this fails the moment they drift.
  const migration = readFileSync(
    new URL("../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
      import.meta.url), "utf8"
  );
  const fold = migration.match(
    /create or replace function private\.fold_purchase_line_accents[\s\S]*?\$\$;/
  )?.[0] ?? "";
  const [, sqlSrc, sqlDst] = fold.match(/'([^']{100,})',\s*\n\s*'([^']{100,})'\s*\n\s*\);/) ?? [];
  assert.ok(sqlSrc && sqlDst, "the SQL fold map must be readable");
  assert.equal(sqlSrc!.length, sqlDst!.length, "translate() must stay one-to-one");
  for (const [index, character] of [...sqlSrc!].entries()) {
    assert.equal(
      foldPurchaseLineAccents(character),
      sqlDst![index],
      `TypeScript must fold ${character} exactly as the SQL map does`
    );
  }
  for (const [from, to] of Object.entries({
    "\u00c6": "AE", "\u00e6": "ae", "\u0152": "OE", "\u0153": "oe",
    "\u00df": "ss", "\u00de": "TH", "\u00fe": "th", "\u0132": "IJ", "\u0133": "ij"
  })) {
    assert.ok(fold.includes(`'${from}', '${to}'`), `SQL must expand ${from}`);
    assert.equal(foldPurchaseLineAccents(from), to, `TypeScript must expand ${from}`);
  }
});

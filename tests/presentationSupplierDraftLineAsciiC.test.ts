import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSupplierDraftLineLabel,
  canonicalizePresentationSupplierDraftLineLabel,
  normalizePresentationSupplierDraftLineLabel,
  presentationSupplierDraftItemName,
  presentationSupplierDraftQuantityLabel
} from "../services/domain/presentationSupplierDraftLineIdentity";
import {
  buildSupplierDraftPresentation,
  parseSupplierOrderLines
} from "../utils/orderPresentation";

test("MISE-005UH pins supplier draft line labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSupplierDraftLineIdentity.ts",
    "utf8"
  );
  const presentationSource = readFileSync("utils/orderPresentation.ts", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSupplierDraftLineLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    presentationSource,
    /presentationSupplierDraftItemName\(match\?\.\[1\]\)/
  );
  assert.match(
    presentationSource,
    /presentationSupplierDraftQuantityLabel\(match\?\.\[2\]\)/
  );
  assert.match(
    presentationSource,
    /from "\.\.\/services\/domain\/presentationSupplierDraftLineIdentity"/
  );

  // Leave prior Unicode trim removed from draft-line scan and capture groups.
  assert.doesNotMatch(
    presentationSource,
    /boundedMessage\.slice\(cursor, end\)\.replace\(\/\\r\$\/, ""\)\.trim\(\)/
  );
  assert.doesNotMatch(presentationSource, /match\?\.\[1\]\?\.trim\(\)/);
  assert.doesNotMatch(presentationSource, /match\?\.\[2\]\?\.trim\(\)/);

  // Do not share Login / Insights / Today / branding / Settings / Team /
  // Create Task / purchase-key modules.
  assert.doesNotMatch(
    presentationSource,
    /presentationLoginEmailChipLabelIdentity|presentationInsightsProfileCuisineTypeIdentity|presentationInsightsProfileRestaurantNameIdentity|presentationTodayScreenTitleRestaurantNameIdentity|presentationRestaurantBrandingInitialsIdentity|presentationSettingsAccountEmailLabelIdentity|presentationTeamDirectoryLabelIdentity|presentationCreateTaskAssigneeLabelIdentity|normalizePurchaseItemKey/
  );

  const itemName = "Roma Tomatoes";
  const quantityLabel = "20 lb";
  assert.equal(
    asciiTrimPresentationSupplierDraftLineLabel(`  ${itemName}  `),
    itemName
  );
  assert.equal(
    asciiTrimPresentationSupplierDraftLineLabel(`\t20 lb\n`),
    "20 lb"
  );
  assert.equal(normalizePresentationSupplierDraftLineLabel(`  ${itemName}  `), itemName);
  assert.equal(canonicalizePresentationSupplierDraftLineLabel(`  ${quantityLabel}  `), quantityLabel);
  assert.equal(presentationSupplierDraftItemName(`  ${itemName}  `), itemName);
  assert.equal(presentationSupplierDraftQuantityLabel(`  ${quantityLabel}  `), quantityLabel);

  // Soft empty / Unicode-only space soft-nulls (no invented draft label).
  assert.equal(normalizePresentationSupplierDraftLineLabel(""), null);
  assert.equal(normalizePresentationSupplierDraftLineLabel("   "), null);
  assert.equal(normalizePresentationSupplierDraftLineLabel("\u2003"), null);
  assert.equal(normalizePresentationSupplierDraftLineLabel("\u00a0"), null);
  assert.equal(normalizePresentationSupplierDraftLineLabel(null), null);
  assert.equal(normalizePresentationSupplierDraftLineLabel(undefined), null);
  assert.equal(presentationSupplierDraftItemName(null), null);
  assert.equal(presentationSupplierDraftQuantityLabel("\u2003"), null);
});

test("MISE-005UH refuses Unicode-trim inventing of clean supplier draft line labels", () => {
  const paddedItem = "\u2003Roma Tomatoes\u2003";
  const nbspItem = "\u00a0Roma Tomatoes\u00a0";
  const paddedQty = "\u200320 lb\u2003";
  const nbspQty = "\u00a020 lb\u00a0";
  const paddedLine = "\u2003Roma Tomatoes - 20 lb\u2003";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedItem.trim(), "Roma Tomatoes");
  assert.equal(nbspItem.trim(), "Roma Tomatoes");
  assert.equal(paddedQty.trim(), "20 lb");
  assert.equal(nbspQty.trim(), "20 lb");
  assert.equal(paddedLine.trim(), "Roma Tomatoes - 20 lb");
  assert.equal(paddedItem.trim() || "FALLBACK", "Roma Tomatoes");
  assert.equal("\u2003".trim() || "FALLBACK", "FALLBACK");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSupplierDraftLineLabel(paddedItem), paddedItem);
  assert.equal(asciiTrimPresentationSupplierDraftLineLabel(nbspItem), nbspItem);
  assert.equal(asciiTrimPresentationSupplierDraftLineLabel(paddedQty), paddedQty);
  assert.equal(asciiTrimPresentationSupplierDraftLineLabel(paddedLine), paddedLine);
  assert.equal(canonicalizePresentationSupplierDraftLineLabel(paddedItem), null);
  assert.equal(canonicalizePresentationSupplierDraftLineLabel(nbspItem), null);
  assert.equal(canonicalizePresentationSupplierDraftLineLabel(paddedQty), null);
  assert.equal(normalizePresentationSupplierDraftLineLabel(paddedItem), null);
  assert.equal(normalizePresentationSupplierDraftLineLabel(nbspQty), null);
  assert.equal(presentationSupplierDraftItemName(paddedItem), null);
  assert.equal(presentationSupplierDraftQuantityLabel(paddedQty), null);

  // Scanner skips Unicode-padded lines instead of inventing clean chrome.
  assert.deepEqual(parseSupplierOrderLines(paddedLine), []);
  assert.deepEqual(
    parseSupplierOrderLines("\u00a0Roma Tomatoes - 20 lb\u00a0"),
    []
  );
  assert.deepEqual(
    parseSupplierOrderLines("Roma Tomatoes - \u200320 lb\u2003"),
    []
  );

  const presentation = buildSupplierDraftPresentation({
    id: "order_padded",
    restaurant_id: "restaurant_1",
    supplier_id: "00000000-0000-4000-8000-000000000001",
    supplier_name: "Local Produce Co.",
    order_message: paddedLine,
    operator_note: null,
    status: "draft",
    delivery_date: null,
    created_at: "2026-06-22T10:00:00.000Z"
  });
  assert.equal(presentation.itemCount, 0);
  assert.deepEqual(presentation.lines, []);
});

test("MISE-005UH soft-nulls controls and preserves ordinary ASCII-trimmed draft lines", () => {
  assert.equal(normalizePresentationSupplierDraftLineLabel("Roma\u0001Tomatoes"), null);
  assert.equal(normalizePresentationSupplierDraftLineLabel("\u000720 lb"), null);

  assert.equal(presentationSupplierDraftItemName("Roma Tomatoes"), "Roma Tomatoes");
  assert.equal(presentationSupplierDraftItemName("  Red Onions  "), "Red Onions");
  assert.equal(presentationSupplierDraftQuantityLabel("20 lb"), "20 lb");
  assert.equal(presentationSupplierDraftQuantityLabel("\t10 lb\n"), "10 lb");

  const lines = parseSupplierOrderLines(
    "Order draft for Local Produce Co.\n\nRoma Tomatoes - 20 lb\nRed Onions - 10 lb\n\nDelivery requested: Tomorrow morning"
  );
  assert.deepEqual(lines, [
    {
      itemName: "Roma Tomatoes",
      quantityLabel: "20 lb",
      estimatedCents: 3260,
      priceLabel: "$32.60"
    },
    {
      itemName: "Red Onions",
      quantityLabel: "10 lb",
      estimatedCents: 1820,
      priceLabel: "$18.20"
    }
  ]);

  const presentation = buildSupplierDraftPresentation({
    id: "order_1",
    restaurant_id: "restaurant_1",
    supplier_id: "00000000-0000-4000-8000-000000000001",
    supplier_name: "Local Produce Co.",
    order_message: "Roma Tomatoes - 20 lb\nRed Onions - 10 lb",
    operator_note: null,
    status: "draft",
    delivery_date: "2026-06-23",
    created_at: "2026-06-22T10:00:00.000Z"
  });
  assert.equal(presentation.itemCount, 2);
  assert.equal(presentation.hiddenLineCount, 0);
  assert.equal(presentation.totalLabel, "$50.80");
});

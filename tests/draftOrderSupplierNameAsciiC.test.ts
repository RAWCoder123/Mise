import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDraftsFromRecommendations } from "../services/domain/miseDomain";
import {
  asciiTrimDraftOrderSupplierName,
  canonicalizeDraftOrderSupplierName,
  normalizeDraftOrderSupplierName
} from "../services/domain/presentationDraftOrderSupplierNameIdentity";
import type { PurchaseRecommendation } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/presentationDraftOrderSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const miseDomainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const ordersDetailSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);

const supplierLabel = "Harbor Produce";
const accentedSupplier = "Café du Marché";
const FALLBACK = "Supplier";
const em = "\u2003";
const nbsp = "\u00a0";

function approvedRecommendation(
  overrides: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id: "rec_ascii_c_supplier",
    restaurant_id: "rest_ascii_c",
    inventory_item_id: "inv_ascii_c",
    item_name: "Chicken thigh",
    supplier_id: "sup_ascii_c",
    supplier_name: supplierLabel,
    recommended_quantity: 12,
    unit: "lb",
    urgency: "high",
    reason: "Par coverage",
    status: "approved",
    supplier_order_id: null,
    created_at: "2026-11-02T06:00:00.000Z",
    ...overrides
  };
}

test("MISE-005VZ pins miseDomain draft-order supplier_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005VZ/);
  assert.match(miseDomainSource, /MISE-005VZ/);

  assert.match(
    identitySource,
    /export function asciiTrimDraftOrderSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Supplier display tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimDraftOrderSupplierName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    miseDomainSource,
    /from "\.\/presentationDraftOrderSupplierNameIdentity"/
  );
  assert.match(miseDomainSource, /normalizeDraftOrderSupplierName\(/);
  assert.match(
    miseDomainSource,
    /normalizeDraftOrderSupplierName\(items\[0\]\?\.supplier_name\) \?\? "Supplier"/
  );
  assert.doesNotMatch(
    miseDomainSource,
    /const supplierName = items\[0\]\?\.supplier_name \?\? "Supplier"/
  );

  // Leave sibling supplier presentation tips alone.
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationSuppliersSettingsRecipientEmailIdentity/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationOrdersDetailSupplierNameIdentity/
  );
  assert.doesNotMatch(identitySource, /^import /m);
  // Orders detail title still uses its own ?? path on main.
  assert.match(
    ordersDetailSource,
    /visibleOrder\?\.supplier_name \?\? t\("orders\.detail\.title"\)/
  );
});

test("ASCII C prep keeps ordinary draft-order supplier_name stable", () => {
  assert.equal(asciiTrimDraftOrderSupplierName(`  ${supplierLabel}  `), supplierLabel);
  assert.equal(asciiTrimDraftOrderSupplierName(`\t${supplierLabel}\n`), supplierLabel);
  assert.equal(canonicalizeDraftOrderSupplierName(`  ${supplierLabel}  `), supplierLabel);
  assert.equal(normalizeDraftOrderSupplierName(`  ${supplierLabel}  `), supplierLabel);
  assert.equal(normalizeDraftOrderSupplierName(accentedSupplier), accentedSupplier);
});

test("Unicode-only space and empty string bypass Supplier via ?? until ASCII C soft-null restores it", () => {
  const emOnly = em;
  const nbspOnly = nbsp;
  const paddedSpaces = "   ";
  const empty = "";

  // Prior truthy / `??` bypass proofs.
  assert.equal(Boolean(emOnly), true);
  assert.equal(Boolean(emOnly.trim()), false);
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeDraftOrderSupplierName(emOnly), null);
  assert.equal(normalizeDraftOrderSupplierName(emOnly) ?? FALLBACK, FALLBACK);
  assert.equal(Boolean(normalizeDraftOrderSupplierName(emOnly)), false);
  assert.equal(normalizeDraftOrderSupplierName(nbspOnly), null);
  assert.equal(normalizeDraftOrderSupplierName(paddedSpaces), null);
  assert.equal(normalizeDraftOrderSupplierName(empty), null);
  assert.equal(normalizeDraftOrderSupplierName(null), null);
  assert.equal(normalizeDraftOrderSupplierName(undefined), null);
  assert.equal(normalizeDraftOrderSupplierName(null) ?? FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean draft-order supplier_name", () => {
  const emSupplier = `${em}${supplierLabel}${em}`;
  const nbspSupplier = `${nbsp}${supplierLabel}${nbsp}`;

  // Inventing proof on Unicode trim.
  assert.equal(emSupplier.trim(), supplierLabel);
  assert.equal(nbspSupplier.trim(), supplierLabel);

  // Supplier tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimDraftOrderSupplierName(emSupplier), emSupplier);
  assert.equal(asciiTrimDraftOrderSupplierName(nbspSupplier), nbspSupplier);

  // Soft-null refuses to invent clean supplier display.
  assert.equal(canonicalizeDraftOrderSupplierName(emSupplier), null);
  assert.equal(canonicalizeDraftOrderSupplierName(nbspSupplier), null);
  assert.equal(normalizeDraftOrderSupplierName(emSupplier), null);
  assert.equal(normalizeDraftOrderSupplierName(nbspSupplier), null);
  assert.equal(normalizeDraftOrderSupplierName(emSupplier) ?? FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for draft-order supplier_name", () => {
  assert.equal(normalizeDraftOrderSupplierName(`${supplierLabel}\u0000`), null);
  assert.equal(normalizeDraftOrderSupplierName(`\u0007${supplierLabel}`), null);
  assert.equal(normalizeDraftOrderSupplierName(`${supplierLabel}\u007f`), null);
  // Single-line supplier labels reject embedded LF/CR.
  assert.equal(normalizeDraftOrderSupplierName(`${supplierLabel}\nnext`), null);
  assert.equal(normalizeDraftOrderSupplierName(`${supplierLabel}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeDraftOrderSupplierName(`${supplierLabel}\t`), supplierLabel);
  assert.equal(normalizeDraftOrderSupplierName("Harbor Produce"), supplierLabel);
});

test("buildDraftsFromRecommendations fails closed on Unicode-only-space supplier_name", () => {
  const drafts = buildDraftsFromRecommendations("rest_ascii_c", [
    approvedRecommendation({ supplier_name: em })
  ]);

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]?.supplier_name, FALLBACK);
  assert.match(drafts[0]?.order_message ?? "", new RegExp(`Order draft for ${FALLBACK}`));
  assert.doesNotMatch(drafts[0]?.order_message ?? "", new RegExp(em));
});

test("buildDraftsFromRecommendations refuses Unicode-padded supplier inventing", () => {
  const padded = `${em}${supplierLabel}${em}`;
  const drafts = buildDraftsFromRecommendations("rest_ascii_c", [
    approvedRecommendation({ supplier_name: padded })
  ]);

  assert.equal(drafts.length, 1);
  // Fail closed to intentional fallback rather than inventing clean Harbor Produce.
  assert.equal(drafts[0]?.supplier_name, FALLBACK);
  assert.notEqual(padded.trim(), FALLBACK);
  assert.equal(padded.trim(), supplierLabel);
  assert.match(drafts[0]?.order_message ?? "", new RegExp(`Order draft for ${FALLBACK}`));
});

test("buildDraftsFromRecommendations keeps ordinary supplier_name and ASCII-trimmed drafts", () => {
  const drafts = buildDraftsFromRecommendations("rest_ascii_c", [
    approvedRecommendation({ supplier_name: `  ${supplierLabel}  ` }),
    approvedRecommendation({
      id: "rec_ascii_c_supplier_b",
      supplier_id: "sup_ascii_c_b",
      supplier_name: accentedSupplier
    })
  ]);

  assert.equal(drafts.length, 2);
  const bySupplier = new Map(drafts.map((draft) => [draft.supplier_id, draft]));
  assert.equal(bySupplier.get("sup_ascii_c")?.supplier_name, supplierLabel);
  assert.equal(bySupplier.get("sup_ascii_c_b")?.supplier_name, accentedSupplier);
  assert.match(
    bySupplier.get("sup_ascii_c")?.order_message ?? "",
    new RegExp(`Order draft for ${supplierLabel}`)
  );
});

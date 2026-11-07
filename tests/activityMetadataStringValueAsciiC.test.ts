import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ACTIVITY_METADATA_FREE_TEXT_KEYS,
  asciiTrimActivityMetadataStringValue,
  canonicalizeActivityMetadataStringValue,
  isActivityMetadataFreeTextKey,
  normalizeActivityMetadataStringValue
} from "../services/domain/presentationActivityMetadataStringValueIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityMetadataStringValueIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(new URL("../app/more/activity.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const activityEventsSource = readFileSync(
  new URL("../services/domain/activityEvents.ts", import.meta.url),
  "utf8"
);
const evidenceSummaryIdentityPath = new URL(
  "../services/domain/presentationActivityEvidenceSummaryIdentity.ts",
  import.meta.url
);
const activityRowSummaryIdentityPath = new URL(
  "../services/domain/presentationActivityRowSummaryIdentity.ts",
  import.meta.url
);
const homeActivityRowSummaryIdentityPath = new URL(
  "../services/domain/presentationHomeActivityRowSummaryIdentity.ts",
  import.meta.url
);

const itemName = "Chicken Breast";
const supplierName = "Sysco Metro";
const em = "\u2003";
const nbsp = "\u00a0";

function summarizeMetadataFixture(
  metadata: Record<string, unknown>,
  freeTextFallback: string
) {
  return Object.entries(metadata)
    .slice(0, 4)
    .map(([key, value]) => {
      if (isActivityMetadataFreeTextKey(key) && typeof value === "string") {
        return `${key}=${normalizeActivityMetadataStringValue(value) || freeTextFallback}`;
      }
      return `${key}=${typeof value === "string" || typeof value === "number" ? value : "…"}`;
    })
    .join(" · ");
}

test("MISE-005YZ pins Activity expanded summarizeMetadata free-text string values to ASCII C", () => {
  assert.match(identitySource, /MISE-005YZ/);
  assert.match(activitySource, /MISE-005YZ/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityMetadataStringValue\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+\|\[ \\t\\n\\r\\f\\v\]\+\$\/g, ""\);/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityMetadataStringValueIdentity"/
  );
  assert.match(activitySource, /normalizeActivityMetadataStringValue\(/);
  assert.match(activitySource, /isActivityMetadataFreeTextKey\(/);
  assert.match(
    activitySource,
    /summarizeMetadata\(event\.metadata,\s*t\("activity\.metadata\.value\.none"\)\)/
  );
  assert.match(
    activitySource,
    /normalizeActivityMetadataStringValue\(value\)\s*\|\|\s*freeTextFallback/
  );

  assert.match(catalogSource, /"activity\.metadata\.value\.none": "Unavailable"/);
  assert.match(catalogSource, /"activity\.metadata\.value\.none": "No disponible"/);
  assert.match(catalogSource, /"activity\.metadata\.value\.none": "不可用"/);

  // Free-text keys are exactly itemName / supplierName on this tip.
  assert.deepEqual([...ACTIVITY_METADATA_FREE_TEXT_KEYS], ["itemName", "supplierName"]);
  assert.equal(isActivityMetadataFreeTextKey("itemName"), true);
  assert.equal(isActivityMetadataFreeTextKey("supplierName"), true);
  assert.equal(isActivityMetadataFreeTextKey("triggerType"), false);
  assert.equal(isActivityMetadataFreeTextKey("quantity"), false);

  // activityEvents builders still carry untrusted free-text itemName/supplierName.
  assert.match(activityEventsSource, /itemName:\s*recommendation\.item_name/);
  assert.match(activityEventsSource, /supplierName:\s*recommendation\.supplier_name/);
  assert.match(activityEventsSource, /supplierName:\s*order\.supplier_name/);
  assert.match(activityEventsSource, /itemName:\s*item\.item_name/);

  // Leave Activity row event.summary as raw pass-through (#1150 owns that surface).
  assert.match(activitySource, /summary[^>]*>\s*\{event\.summary\}\s*<\/Text>/);

  // Leave Activity row event.title as raw pass-through (#1148 owns that surface).
  assert.match(activitySource, /\{event\.title\}/);

  // Leave evidence.summary as raw pass-through on main (#1155 owns that surface).
  assert.match(
    activitySource,
    /\{evidence\.type\.replace\(\/_\/g, " "\)\} — \{evidence\.summary\}/
  );

  assert.doesNotMatch(activitySource, /presentationActivityEvidenceSummaryIdentity/);
  assert.doesNotMatch(activitySource, /normalizeActivityEvidenceSummary/);
  assert.doesNotMatch(activitySource, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(activitySource, /normalizeActivityRowSummary/);
  assert.equal(
    (() => {
      try {
        readFileSync(evidenceSummaryIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(activityRowSummaryIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(homeActivityRowSummaryIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationActivityEvidenceSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeActivityRowSummaryIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeActivityMetadataStringValue(itemName), itemName);
  assert.equal(normalizeActivityMetadataStringValue(` ${itemName} `), itemName);
  assert.equal(
    normalizeActivityMetadataStringValue(`Pechuga: ${itemName}`),
    `Pechuga: ${itemName}`
  );
  assert.equal(normalizeActivityMetadataStringValue(supplierName), supplierName);
});

test("Unicode padding invents via trim and is soft-nulled for Activity metadata free-text values", () => {
  const paddedItem = `${em}${itemName}${em}`;
  const nbspItem = `${nbsp}${itemName}${nbsp}`;
  const paddedSupplier = `${em}${supplierName}${em}`;
  const internalEm = `Chicken${em}Breast`;
  const internalNbsp = `Chicken${nbsp}Breast`;

  // Inventing proof: Unicode trim would invent the clean free-text identity.
  assert.equal(paddedItem.trim(), itemName);
  assert.equal(nbspItem.trim(), itemName);
  assert.equal(paddedSupplier.trim(), supplierName);
  assert.equal(Boolean(paddedItem), true);
  assert.equal(Boolean(nbspItem), true);
  assert.equal(Boolean(em), true);

  // Prior always-pass-string path projected blank / padded identities.
  assert.equal(
    Object.entries({ itemName: em, supplierName: paddedItem })
      .map(([key, value]) => `${key}=${value}`)
      .join(" · "),
    `itemName=${em} · supplierName=${paddedItem}`
  );

  // ASCII C prep refuses that inventing equality for em-space / NBSP padding.
  assert.equal(asciiTrimActivityMetadataStringValue(paddedItem), paddedItem);
  assert.equal(canonicalizeActivityMetadataStringValue(paddedItem), null);
  assert.equal(normalizeActivityMetadataStringValue(paddedItem), null);
  assert.equal(normalizeActivityMetadataStringValue(paddedItem) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeActivityMetadataStringValue(nbspItem), null);
  assert.equal(normalizeActivityMetadataStringValue(paddedSupplier), null);

  // Internal Unicode spaces are preserved (single-line tip; no NBSP fold).
  assert.equal(normalizeActivityMetadataStringValue(internalEm), internalEm);
  assert.equal(normalizeActivityMetadataStringValue(internalNbsp), internalNbsp);

  // summarizeMetadata soft-nulls free-text keys only; machine fields stay raw.
  assert.equal(
    summarizeMetadataFixture(
      { itemName: paddedItem, quantity: 2, unit: "lb" },
      "Unavailable"
    ),
    "itemName=Unavailable · quantity=2 · unit=lb"
  );
  assert.equal(
    summarizeMetadataFixture({ supplierName: em, deliveryDate: "2026-11-07" }, "Unavailable"),
    "supplierName=Unavailable · deliveryDate=2026-11-07"
  );
  assert.equal(
    summarizeMetadataFixture({ itemName, supplierName }, "Unavailable"),
    `itemName=${itemName} · supplierName=${supplierName}`
  );
});

test("soft empty, controls, and non-strings fail closed for Activity metadata free-text values", () => {
  assert.equal(normalizeActivityMetadataStringValue(undefined), null);
  assert.equal(normalizeActivityMetadataStringValue(null), null);
  assert.equal(normalizeActivityMetadataStringValue(""), null);
  assert.equal(normalizeActivityMetadataStringValue("   "), null);
  assert.equal(normalizeActivityMetadataStringValue(123 as unknown as string), null);
  assert.equal(normalizeActivityMetadataStringValue(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityMetadataStringValue(`${itemName}\t`), itemName);
  assert.equal(normalizeActivityMetadataStringValue(`${itemName}\u0007`), null);
  assert.equal(normalizeActivityMetadataStringValue(em), null);
  assert.equal(normalizeActivityMetadataStringValue(nbsp), null);
  // Embedded LF is rejected (single-line full cntrl; not operator_note allowlist).
  assert.equal(normalizeActivityMetadataStringValue(`${itemName}\nextra`), null);
});

test("Activity metadata free-text bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior always-pass-string path still rendered blank-looking itemName= / supplierName=.
  assert.equal(normalizeActivityMetadataStringValue(""), null);
  assert.equal(normalizeActivityMetadataStringValue(em), null);
  assert.equal(normalizeActivityMetadataStringValue(nbsp), null);
  assert.equal(
    summarizeMetadataFixture({ itemName: em }, "Unavailable"),
    "itemName=Unavailable"
  );
  assert.equal(
    summarizeMetadataFixture({ supplierName: "" }, "Unavailable"),
    "supplierName=Unavailable"
  );
  assert.match(
    activitySource,
    /summarizeMetadata\(event\.metadata,\s*t\("activity\.metadata\.value\.none"\)\)/
  );
});

test("Activity expanded metadata free-text identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimActivityMetadataStringValue(padded), padded.trim());
  assert.equal(canonicalizeActivityMetadataStringValue(padded), null);
  assert.equal(normalizeActivityMetadataStringValue(padded), null);
  assert.equal(normalizeActivityMetadataStringValue(`\t${itemName}\n`), itemName);
});

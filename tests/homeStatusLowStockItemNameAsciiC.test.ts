import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimHomeStatusLowStockItemName,
  canonicalizeHomeStatusLowStockItemName,
  normalizeHomeStatusLowStockItemName
} from "../services/domain/presentationHomeStatusLowStockItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationHomeStatusLowStockItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const operatingBriefSource = readFileSync(
  new URL("../services/domain/operatingBrief.ts", import.meta.url),
  "utf8"
);
const topRiskIdentityPath = new URL(
  "../services/domain/homeStatusTopRiskIdentity.ts",
  import.meta.url
);
const summaryIdentityPath = new URL(
  "../services/domain/homeStatusRestaurantSummaryIdentity.ts",
  import.meta.url
);
const statusWhyIdentityPath = new URL(
  "../services/domain/homeStatusWhyItMattersIdentity.ts",
  import.meta.url
);
const approvalsWhyIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsWhyItMattersIdentity.ts",
  import.meta.url
);
const approvalTitleIdentityPath = new URL(
  "../services/domain/homeStatusApprovalTitleIdentity.ts",
  import.meta.url
);
const recommendedActionIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsRecommendedActionIdentity.ts",
  import.meta.url
);
const cardTitleIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsCardTitleIdentity.ts",
  import.meta.url
);
const salesTopItemIdentityPath = new URL(
  "../services/domain/presentationDailyReportSalesTopItemNameIdentity.ts",
  import.meta.url
);
const inventoryHubItemIdentityPath = new URL(
  "../services/domain/presentationInventoryHubItemNameIdentity.ts",
  import.meta.url
);

const itemName = "Chicken Breast";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005ZT pins Home StatusNotice low-stock itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZT/);
  assert.match(homeSource, /MISE-005ZT/);

  assert.match(
    identitySource,
    /export function asciiTrimHomeStatusLowStockItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationHomeStatusLowStockItemNameIdentity"/
  );
  assert.match(homeSource, /normalizeHomeStatusLowStockItemName\(/);
  assert.match(
    homeSource,
    /normalizeHomeStatusLowStockItemName\(primaryMenuRisk\.itemName\)\s*\|\|\s*\n?\s*t\("home\.alert\.lowStock\.itemName\.none"\)/
  );

  assert.match(catalogSource, /"home\.alert\.lowStock\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"home\.alert\.lowStock\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"home\.alert\.lowStock\.itemName\.none": "商品"/);

  // Inventing path still embeds raw inventory item_name into menuRisks.itemName.
  assert.match(operatingBriefSource, /itemName:\s*item\.item_name/);

  // Leave StatusNotice topRisk as the prior trim gate on main (open #1138).
  assert.doesNotMatch(homeSource, /normalizeHomeStatusTopRisk\(/);
  assert.match(homeSource, /brief\.restaurantStatus\.topRisk\?\.trim\(\)/);

  // Leave StatusNotice summary / whyItMatters raw on main (open #1137 / #1136).
  assert.doesNotMatch(homeSource, /normalizeHomeStatusRestaurantSummary/);
  assert.doesNotMatch(homeSource, /normalizeHomeStatusWhyItMatters/);
  assert.match(
    homeSource,
    /message=\{topRisk \? t\(statusKey\) : primaryApproval\?\.whyItMatters \?\? brief\.restaurantStatus\.summary\}/
  );

  // Leave StatusNotice approval title raw on main (open #1011).
  assert.match(homeSource, /primaryApproval\?\.title \|\| t\(statusKey\)/);

  // Leave ApprovalsSection whyItMatters / title / recommendedAction as raw
  // pass-through on this tip (open #1135 / #1049 / #1134 own those surfaces).
  assert.match(homeSource, /\{t\("home\.approvals\.why"\)\}: \{card\.whyItMatters\}/);
  assert.match(homeSource, /\{card\.title\}/);
  assert.match(homeSource, /\{card\.recommendedAction\}/);

  // Leave Home greeting restaurant.name alone on main (open #1044).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );

  // Leave sibling tip modules alone on this branch.
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsWhyItMatters/);
  assert.doesNotMatch(homeSource, /normalizeHomeStatusApprovalTitle/);
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsRecommendedAction/);
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsCardTitle/);
  assert.doesNotMatch(homeSource, /normalizeDailyReportSalesTopItemName/);
  assert.doesNotMatch(homeSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(homeSource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(homeSource, /presentationDailyReportSalesTopItemNameIdentity/);
  assert.doesNotMatch(homeSource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(homeSource, /homeStatusTopRiskIdentity/);
  assert.equal(filePresence(topRiskIdentityPath), "absent");
  assert.equal(filePresence(summaryIdentityPath), "absent");
  assert.equal(filePresence(statusWhyIdentityPath), "absent");
  assert.equal(filePresence(approvalsWhyIdentityPath), "absent");
  assert.equal(filePresence(approvalTitleIdentityPath), "absent");
  assert.equal(filePresence(recommendedActionIdentityPath), "absent");
  assert.equal(filePresence(cardTitleIdentityPath), "absent");
  assert.equal(filePresence(salesTopItemIdentityPath), "absent");
  assert.equal(filePresence(inventoryHubItemIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /homeStatusTopRiskIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusRestaurantSummaryIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusWhyItMattersIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsWhyItMattersIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportSalesTopItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeStatusLowStockItemName(itemName), itemName);
  assert.equal(normalizeHomeStatusLowStockItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeHomeStatusLowStockItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home StatusNotice low-stock item names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Chicken${em}Breast`;
  const internalNbsp = `Chicken${nbsp}Breast`;

  // Inventing proof: Unicode trim would invent the clean item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimHomeStatusLowStockItemName(padded), padded);
  assert.equal(canonicalizeHomeStatusLowStockItemName(padded), null);
  assert.equal(canonicalizeHomeStatusLowStockItemName(nbspName), null);
  assert.equal(normalizeHomeStatusLowStockItemName(padded), null);
  assert.equal(normalizeHomeStatusLowStockItemName(nbspName), null);
  assert.equal(normalizeHomeStatusLowStockItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeHomeStatusLowStockItemName(internalEm), internalEm);
  assert.equal(normalizeHomeStatusLowStockItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeHomeStatusLowStockItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Home StatusNotice low-stock item names", () => {
  assert.equal(normalizeHomeStatusLowStockItemName(undefined), null);
  assert.equal(normalizeHomeStatusLowStockItemName(null), null);
  assert.equal(normalizeHomeStatusLowStockItemName(""), null);
  assert.equal(normalizeHomeStatusLowStockItemName("   "), null);
  assert.equal(normalizeHomeStatusLowStockItemName(123 as unknown as string), null);
  assert.equal(normalizeHomeStatusLowStockItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeStatusLowStockItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeHomeStatusLowStockItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeHomeStatusLowStockItemName(em), null);
});

test("Home StatusNotice low-stock bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // into home.alert.lowStock.itemTitle.
  assert.equal(normalizeHomeStatusLowStockItemName(""), null);
  assert.equal(normalizeHomeStatusLowStockItemName(em), null);
  assert.equal(normalizeHomeStatusLowStockItemName(nbsp), null);
  assert.match(
    homeSource,
    /normalizeHomeStatusLowStockItemName\(primaryMenuRisk\.itemName\)\s*\|\|\s*\n?\s*t\("home\.alert\.lowStock\.itemName\.none"\)/
  );
});

test("Home StatusNotice low-stock identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimHomeStatusLowStockItemName(padded), padded.trim());
  assert.equal(normalizeHomeStatusLowStockItemName(padded), null);
  assert.equal(normalizeHomeStatusLowStockItemName(`\t${itemName}\n`), itemName);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimAutonomySpendLimitText,
  canonicalizeAutonomySpendLimitText,
  parseAutonomySpendLimitText
} from "../services/domain/autonomySpendLimitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/autonomySpendLimitIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/settings/autonomy.tsx", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/autonomy.ts", import.meta.url),
  "utf8"
);

test("MISE-005RB pins autonomy spend-limit draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RB/);
  assert.match(screenSource, /MISE-005RB/);

  assert.match(
    identitySource,
    /export function asciiTrimAutonomySpendLimitText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/autonomySpendLimitIdentity"/
  );
  assert.match(screenSource, /parseAutonomySpendLimitText\(draft\.spendLimitText\)/);
  assert.doesNotMatch(screenSource, /draft\.spendLimitText\.trim\(\)/);
  assert.doesNotMatch(screenSource, /Number\(draft\.spendLimitText\)/);

  // Leave open autonomy restaurant-workspace tip #741 on its existing trim path.
  assert.match(applicationSource, /const normalizedRestaurantId = restaurantId\.trim\(\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /normalizeAutonomyCommunicationType/);
  assert.doesNotMatch(identitySource, /normalizeAutonomyAllowedTime/);
  assert.doesNotMatch(identitySource, /from ["']\.\/restaurantAutonomy["']/);
  assert.doesNotMatch(screenSource, /from "\.\.\/\.\.\/services\/domain\/loginEmailIdentity"/);

  // Leave the screen's communicationType / allowed-window prep on their existing
  // contracts (owned by open tips #877 / MISE-005QQ and #878 / MISE-005QR).
  assert.match(screenSource, /draft\.communicationType\.trim\(\)/);
  assert.match(screenSource, /function normalizeTime\(/);
});

test("ASCII trim keeps ordinary autonomy spend-limit drafts stable", () => {
  assert.equal(asciiTrimAutonomySpendLimitText("  25.50  "), "25.50");
  assert.deepEqual(canonicalizeAutonomySpendLimitText("\t12\n"), { status: "ok", cents: 1200 });
  assert.deepEqual(parseAutonomySpendLimitText("  25.50  "), { status: "ok", cents: 2550 });
  assert.deepEqual(parseAutonomySpendLimitText("0"), { status: "ok", cents: 0 });
  assert.deepEqual(parseAutonomySpendLimitText("100"), { status: "ok", cents: 10000 });
  assert.deepEqual(parseAutonomySpendLimitText("1.01"), { status: "ok", cents: 101 });

  // Prior emptiness contract: ASCII-only whitespace softs to empty / null cents.
  assert.deepEqual(parseAutonomySpendLimitText("   "), { status: "empty" });
  assert.deepEqual(parseAutonomySpendLimitText("\t\n"), { status: "empty" });
  assert.deepEqual(parseAutonomySpendLimitText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean autonomy spend limit", () => {
  const amount = "25.50";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim / Number TrimString (what autonomy.tsx
  // used before this tip).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);
  assert.equal(Number(nbspAmount), 25.5);
  assert.equal(Number(emAmount), 25.5);
  assert.equal(Math.round(Number(emAmount) * 100), 2550);

  assert.deepEqual(canonicalizeAutonomySpendLimitText(nbspAmount), { status: "invalid" });
  assert.deepEqual(canonicalizeAutonomySpendLimitText(emAmount), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText(nbspAmount), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText(emAmount), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness
  // (null spend-limit), and must not invent unlimited from a padded amount.
  assert.deepEqual(parseAutonomySpendLimitText("\u2003\u2003"), { status: "empty" });
  assert.deepEqual(parseAutonomySpendLimitText("\u00a0\u00a0"), { status: "empty" });
  assert.notDeepEqual(parseAutonomySpendLimitText(emAmount), { status: "empty" });
  assert.notDeepEqual(parseAutonomySpendLimitText(emAmount), { status: "ok", cents: 2550 });
});

test("ASCII controls and malformed spend drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeAutonomySpendLimitText("25\n.50"), { status: "invalid" });
  assert.deepEqual(canonicalizeAutonomySpendLimitText("25\r.50"), { status: "invalid" });
  assert.deepEqual(canonicalizeAutonomySpendLimitText("25\x01.50"), { status: "invalid" });
  assert.deepEqual(canonicalizeAutonomySpendLimitText("25\x7f.50"), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText("25\n.50"), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText("25\x7f.50"), { status: "invalid" });

  assert.deepEqual(parseAutonomySpendLimitText("not-a-number"), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText("-1"), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText("Infinity"), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText(null), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText(undefined), { status: "invalid" });
  assert.deepEqual(parseAutonomySpendLimitText(25.5), { status: "invalid" });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipeAuthorityMenuItemIdToken,
  canonicalizeRecipeAuthorityMenuItemIdToken,
  normalizeRecipeAuthorityMenuItemId
} from "../services/repositories/recipeAuthorityMenuItemIdIdentity";

const identitySource = readFileSync(
  new URL("../services/repositories/recipeAuthorityMenuItemIdIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const menuItemId = "menu_item_margherita";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005UY pins recipe-authority hydrate menuItemId to ASCII C", () => {
  assert.match(identitySource, /MISE-005UY/);
  assert.match(repositorySource, /MISE-005UY/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipeAuthorityMenuItemIdToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    repositorySource,
    /from "\.\/recipeAuthorityMenuItemIdIdentity"/
  );
  assert.match(
    repositorySource,
    /normalizeRecipeAuthorityMenuItemId\(/
  );

  const parseStart = repositorySource.indexOf("function parseRecipeAuthorityState(");
  const parseEnd = repositorySource.indexOf(
    "function parseSupplierOrderSentWorkflowResponse("
  );
  assert.ok(parseStart > 0 && parseEnd > parseStart);
  const parseBody = repositorySource.slice(parseStart, parseEnd);
  assert.match(parseBody, /normalizeRecipeAuthorityMenuItemId\(/);
  assert.doesNotMatch(parseBody, /payload\.menuItemId\.trim\(\)/);

  // Leave menuItemName hydrate on its existing Unicode-trim contract (open #935).
  assert.match(
    parseBody,
    /const menuItemName = typeof payload\.menuItemName === "string" \? payload\.menuItemName\.trim\(\) : "";/
  );

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /recipeAuthorityMenuItemNameIdentity/);
  assert.doesNotMatch(identityCode, /inventoryRecipeMenuItemNameIdentity/);
  assert.doesNotMatch(identityCode, /demoRecipeBaselineMenuItemNameIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary recipe-authority menu item ids stable", () => {
  assert.equal(asciiTrimRecipeAuthorityMenuItemIdToken(`  ${menuItemId}  `), menuItemId);
  assert.equal(asciiTrimRecipeAuthorityMenuItemIdToken(`\t${menuItemId}\n`), menuItemId);
  assert.equal(canonicalizeRecipeAuthorityMenuItemIdToken(`  ${menuItemId}  `), menuItemId);
  assert.equal(normalizeRecipeAuthorityMenuItemId(`  ${menuItemId}  `), menuItemId);

  assert.equal(normalizeRecipeAuthorityMenuItemId("MENU_ITEM_1"), "MENU_ITEM_1");
  assert.equal(canonicalizeRecipeAuthorityMenuItemIdToken("menu-item.1"), "menu-item.1");
});

test("Unicode em-space / NBSP padding cannot invent clean recipe-authority menu item ids", () => {
  const padded = `${em}${menuItemId}${em}`;
  const nbspId = `${nbsp}${menuItemId}${nbsp}`;
  const internalEm = `menu${em}item`;
  const internalNbsp = `menu${nbsp}item`;

  // Inventing proof: Unicode trim would invent the clean menu item id.
  assert.equal(padded.trim(), menuItemId);
  assert.equal(nbspId.trim(), menuItemId);
  // Raw padded ids are truthy and would bypass the prior empty gate.
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspId), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecipeAuthorityMenuItemIdToken(padded), padded);
  assert.equal(canonicalizeRecipeAuthorityMenuItemIdToken(padded), null);
  assert.equal(canonicalizeRecipeAuthorityMenuItemIdToken(nbspId), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId(padded), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId(nbspId), null);

  // Soft-null preserves intentional invalid-response gate without inventing.
  assert.equal(normalizeRecipeAuthorityMenuItemId(padded) || "", "");
  assert.equal(Boolean(normalizeRecipeAuthorityMenuItemId(padded) || ""), false);

  // Soft empty still fails closed without inventing an id from padding alone.
  assert.equal(normalizeRecipeAuthorityMenuItemId(`${em}${em}`), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId(`${nbsp}`), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId("   "), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipeAuthorityMenuItemIdToken(internalEm), internalEm);
  assert.equal(normalizeRecipeAuthorityMenuItemId(internalNbsp), internalNbsp);
  assert.equal(normalizeRecipeAuthorityMenuItemId(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for recipe-authority hydrate menuItemId", () => {
  assert.equal(normalizeRecipeAuthorityMenuItemId(undefined), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId(null), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId(""), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId("   "), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId(123 as unknown as string), null);
  assert.equal(normalizeRecipeAuthorityMenuItemId(`\u0001${menuItemId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipeAuthorityMenuItemId(`${menuItemId}\t`), menuItemId);
  assert.equal(normalizeRecipeAuthorityMenuItemId(`${menuItemId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeRecipeAuthorityMenuItemId(em), null);
});

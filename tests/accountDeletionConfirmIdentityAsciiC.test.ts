import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  matchesAccountDeletionConfirmWord,
  normalizeAccountDeletionConfirmToken
} from "../services/domain/accountDeletionConfirmIdentity";

const domainSource = readFileSync(
  new URL("../services/domain/accountDeletionConfirmIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/(tabs)/settings.tsx", import.meta.url),
  "utf8"
);

test("MISE-005KG pins settings account deleteConfirmWord identity to ASCII C", () => {
  assert.match(domainSource, /MISE-005KG/);
  assert.match(domainSource, /asciiCLower/);
  assert.match(domainSource, /asciiCTrim/);
  assert.match(domainSource, /\[ \\t\\n\\r\\f\\v\]/);

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeAccountDeletionConfirmToken("),
    domainSource.indexOf("export function matchesAccountDeletionConfirmWord(")
  );
  const matchBody = domainSource.slice(
    domainSource.indexOf("export function matchesAccountDeletionConfirmWord(")
  );

  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(matchBody, /\.trim\(\)/);
  assert.doesNotMatch(matchBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(matchBody, /\.toLocaleLowerCase\(\)/);

  assert.match(
    screenSource,
    /import \{ matchesAccountDeletionConfirmWord \} from "\.\.\/\.\.\/services\/domain\/accountDeletionConfirmIdentity"/
  );
  assert.match(screenSource, /MISE-005KG/);
  assert.match(screenSource, /matchesAccountDeletionConfirmWord\(/);
  assert.doesNotMatch(
    screenSource,
    /deleteConfirmText\.trim\(\)\.toLowerCase\(\)/
  );
});

test("ASCII C confirm identity keeps ordinary EN/ES/ZH confirmation words stable", () => {
  assert.equal(normalizeAccountDeletionConfirmToken("DELETE"), "delete");
  assert.equal(normalizeAccountDeletionConfirmToken("  Delete  "), "delete");
  assert.equal(matchesAccountDeletionConfirmWord("DELETE", "DELETE"), true);
  assert.equal(matchesAccountDeletionConfirmWord("delete", "DELETE"), true);
  assert.equal(matchesAccountDeletionConfirmWord("Delete", "DELETE"), true);
  assert.equal(matchesAccountDeletionConfirmWord("ELIMINAR", "ELIMINAR"), true);
  assert.equal(matchesAccountDeletionConfirmWord("eliminar", "ELIMINAR"), true);
  assert.equal(matchesAccountDeletionConfirmWord("删除", "删除"), true);
  assert.equal(matchesAccountDeletionConfirmWord("  删除  ", "删除"), true);
  assert.equal(matchesAccountDeletionConfirmWord("", "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord("   ", "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord("DELETE", ""), false);
  assert.equal(matchesAccountDeletionConfirmWord("DELET", "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord(null, "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord("DELETE", null), false);
});

test("ASCII C confirm identity refuses Unicode trim inventing that enables delete", () => {
  // Unicode String#trim strips NBSP / em-space / BOM and would invent a
  // confirmation match that enables the irreversible delete control.
  assert.equal("\u00a0DELETE\u00a0".trim().toLowerCase(), "delete");
  assert.equal(matchesAccountDeletionConfirmWord("\u00a0DELETE\u00a0", "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord("DELETE\u00a0", "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord("\u00a0DELETE", "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord("\u2003DELETE\u2003", "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord("\ufeffDELETE", "DELETE"), false);

  assert.equal("\u00a0删除\u00a0".trim(), "删除");
  assert.equal(matchesAccountDeletionConfirmWord("\u00a0删除\u00a0", "删除"), false);

  // Mid-string non-C whitespace must not invent equality either.
  assert.equal(matchesAccountDeletionConfirmWord("DEL\u00a0ETE", "DELETE"), false);
  assert.equal(matchesAccountDeletionConfirmWord("DEL\u2003ETE", "DELETE"), false);

  // Kelvin is not folded to k under ASCII C (sibling tip inventing proof).
  assert.equal("K".toLowerCase(), "k");
  assert.notEqual(normalizeAccountDeletionConfirmToken("K"), "k");
  assert.equal(matchesAccountDeletionConfirmWord("KELVIN", "KELVIN"), false);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SUPPLIER_SEND_BLOCKER_CODE_MAX_CHARACTERS,
  SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT,
  asciiTrimSupplierSendBlockerCode,
  canonicalizeSupplierSendBlockerCode,
  normalizeSupplierSendBlockerCode,
  normalizeSupplierSendBlockerCodes
} from "../services/domain/supplierSendBlockerCodeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/supplierSendBlockerCodeIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const cleanCode = "send_content_changed";

test("MISE-005SV pins order-detail supplier-send blocker codes to ASCII C", () => {
  assert.match(identitySource, /MISE-005SV/);
  assert.match(screenSource, /MISE-005SV/);

  assert.match(
    identitySource,
    /export function asciiTrimSupplierSendBlockerCode\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    identitySource,
    /SUPPLIER_SEND_BLOCKER_CODE_MAX_CHARACTERS = 80/
  );
  assert.match(
    identitySource,
    /SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT = 20/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/supplierSendBlockerCodeIdentity"/
  );
  assert.match(screenSource, /normalizeSupplierSendBlockerCodes\(value\)/);
  assert.doesNotMatch(
    screenSource,
    /\.map\(\(entry\) => entry\.trim\(\)\)/
  );

  // Leave hosted parser on exact Set membership (no Unicode inventing trim).
  const parserStart = repositorySource.indexOf(
    "function parseSupplierSendBlockerCodes("
  );
  const parserEnd = repositorySource.indexOf(
    "async function squareIntegrationErrorFrom("
  );
  assert.ok(parserStart > 0 && parserEnd > parserStart);
  const parserBody = repositorySource.slice(parserStart, parserEnd);
  assert.doesNotMatch(parserBody, /\.trim\(\)/);
  assert.doesNotMatch(parserBody, /normalizeSupplierSendBlockerCode/);

  // Leave open Gmail error-message tip (#930) on its Unicode trim haystack.
  const gmailFnStart = repositorySource.indexOf(
    "async function gmailIntegrationErrorFrom("
  );
  const gmailFnEnd = repositorySource.indexOf(
    "async function readFunctionErrorPayload("
  );
  assert.ok(gmailFnStart > 0 && gmailFnEnd > gmailFnStart);
  const gmailBody = repositorySource.slice(gmailFnStart, gmailFnEnd);
  assert.match(
    gmailBody,
    /candidateMessage\.trim\(\)\.slice\(0, 320\) \|\| fallbackMessage;/
  );
  assert.doesNotMatch(gmailBody, /normalizeSupplierSendBlockerCode/);

  // Leave order-detail operator_note / generatedOrderMessage alone for #840.
  assert.match(screenSource, /operator_note: operatorNote\.trim\(\) \|\| null/);
  assert.match(screenSource, /const note = order\.operator_note\?\.trim\(\);/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /gmailIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identityCode, /wasteAnalysisNoteIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII trim keeps ordinary supplier-send blocker codes stable", () => {
  assert.equal(asciiTrimSupplierSendBlockerCode(`  ${cleanCode}  `), cleanCode);
  assert.equal(canonicalizeSupplierSendBlockerCode(`\t${cleanCode}\n`), cleanCode);
  assert.equal(normalizeSupplierSendBlockerCode(`  ${cleanCode}  `), cleanCode);
  assert.equal(normalizeSupplierSendBlockerCode(cleanCode), cleanCode);

  assert.deepEqual(
    normalizeSupplierSendBlockerCodes([`  ${cleanCode}  `, "gmail_not_connected"]),
    [cleanCode, "gmail_not_connected"]
  );
  assert.deepEqual(normalizeSupplierSendBlockerCodes(null), []);
  assert.deepEqual(normalizeSupplierSendBlockerCodes(undefined), []);
  assert.deepEqual(normalizeSupplierSendBlockerCodes("send_content_changed"), []);

  // Prior emptiness contract: ASCII-only whitespace softs to null / drops.
  assert.equal(normalizeSupplierSendBlockerCode("   "), null);
  assert.equal(normalizeSupplierSendBlockerCode("\t\n"), null);
  assert.equal(normalizeSupplierSendBlockerCode(""), null);
  assert.equal(normalizeSupplierSendBlockerCode(null), null);
  assert.equal(normalizeSupplierSendBlockerCode(undefined), null);
  assert.deepEqual(normalizeSupplierSendBlockerCodes(["   ", "\t", cleanCode]), [cleanCode]);
});

test("NBSP and em-space padding cannot invent a clean supplier-send blocker code", () => {
  const nbspCode = `\u00a0${cleanCode}\u00a0`;
  const emCode = `\u2003${cleanCode}\u2003`;

  // Live inventing proof on Unicode trim (what safeBlockerCodes used before).
  assert.equal(nbspCode.trim(), cleanCode);
  assert.equal(emCode.trim(), cleanCode);

  assert.equal(canonicalizeSupplierSendBlockerCode(nbspCode), null);
  assert.equal(canonicalizeSupplierSendBlockerCode(emCode), null);
  assert.equal(normalizeSupplierSendBlockerCode(nbspCode), null);
  assert.equal(normalizeSupplierSendBlockerCode(emCode), null);

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness.
  assert.equal(normalizeSupplierSendBlockerCode("\u2003\u2003"), null);
  assert.equal(normalizeSupplierSendBlockerCode("\u00a0\u00a0"), null);

  // Padded and clean stay distinct — do not invent blocker routing equality.
  assert.notEqual(normalizeSupplierSendBlockerCode(nbspCode), cleanCode);
  assert.notEqual(normalizeSupplierSendBlockerCode(emCode), cleanCode);

  assert.deepEqual(
    normalizeSupplierSendBlockerCodes([emCode, nbspCode, cleanCode, "\u2003\u2003"]),
    [cleanCode]
  );
});

test("ASCII controls, over-long codes, and array bounds fail closed without inventing", () => {
  assert.equal(canonicalizeSupplierSendBlockerCode("send\ncontent"), null);
  assert.equal(canonicalizeSupplierSendBlockerCode("send\rcontent"), null);
  assert.equal(canonicalizeSupplierSendBlockerCode("send\x01content"), null);
  assert.equal(canonicalizeSupplierSendBlockerCode("send\x7fcontent"), null);
  assert.equal(normalizeSupplierSendBlockerCode("send\ncontent"), null);
  assert.equal(normalizeSupplierSendBlockerCode("send\x7fcontent"), null);

  const tooLong = "s".repeat(SUPPLIER_SEND_BLOCKER_CODE_MAX_CHARACTERS + 1);
  assert.equal(canonicalizeSupplierSendBlockerCode(tooLong), null);
  assert.equal(normalizeSupplierSendBlockerCode(tooLong), null);

  const atLimit = "s".repeat(SUPPLIER_SEND_BLOCKER_CODE_MAX_CHARACTERS);
  assert.equal(canonicalizeSupplierSendBlockerCode(atLimit), atLimit);
  assert.equal(normalizeSupplierSendBlockerCode(atLimit), atLimit);

  const many = Array.from(
    { length: SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT + 5 },
    (_, index) => `code_${index}`
  );
  const bounded = normalizeSupplierSendBlockerCodes(many);
  assert.equal(bounded.length, SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT);
  assert.equal(bounded[0], "code_0");
  assert.equal(
    bounded[SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT - 1],
    `code_${SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT - 1}`
  );

  // Soft-drop inventing padded entries before applying the 20-cap.
  const paddedThenClean = [
    `\u2003${cleanCode}\u2003`,
    ...Array.from({ length: SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT }, (_, index) => `ok_${index}`)
  ];
  const paddedBounded = normalizeSupplierSendBlockerCodes(paddedThenClean);
  assert.equal(paddedBounded.length, SUPPLIER_SEND_BLOCKER_CODE_MAX_COUNT);
  assert.equal(paddedBounded[0], "ok_0");
  assert.doesNotMatch(paddedBounded.join(","), /send_content_changed/);
});

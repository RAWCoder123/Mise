import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimScanItemCameraBarcodeText,
  canonicalizeScanItemCameraBarcodeText,
  prepareScanItemCameraBarcodeText
} from "../services/domain/scanItemCameraBarcodeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/scanItemCameraBarcodeIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(new URL("../app/more/scan-item.tsx", import.meta.url), "utf8");
const barcodeMatchSource = readFileSync(
  new URL("../services/domain/inventoryBarcodeMatch.ts", import.meta.url),
  "utf8"
);

const code = "012345678905";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RY pins Scan Item camera barcode identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RY/);
  assert.match(screenSource, /MISE-005RY/);

  assert.match(
    identitySource,
    /export function asciiTrimScanItemCameraBarcodeText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/scanItemCameraBarcodeIdentity"/
  );
  assert.match(screenSource, /prepareScanItemCameraBarcodeText\(result\.data\)/);
  assert.match(screenSource, /prepared\.status !== "ok"/);
  assert.doesNotMatch(screenSource, /result\.data\?\.trim\(\)/);

  // Open #697 owns typed Scan Item text-search; leave matchesQuery alone.
  assert.match(screenSource, /function matchesQuery\(/);
  assert.match(screenSource, /query\.trim\(\)\.toLowerCase\(\)/);

  // Open #687 owns barcode match token normalize; leave Unicode trim there
  // until that tip lands on main.
  assert.match(barcodeMatchSource, /\.trim\(\)/);
  assert.match(barcodeMatchSource, /\.toLowerCase\(\)/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /scanItemSearchIdentity/);
  assert.doesNotMatch(identitySource, /from ["']\.\/scanItemSearchIdentity["']/);
  assert.doesNotMatch(identitySource, /logDeliveryQuantityIdentity/);
  assert.doesNotMatch(identitySource, /prepareLogDeliveryQuantityText/);
  assert.doesNotMatch(identitySource, /inventoryBarcodeMatch/);
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/scanItemSearchIdentity"/
  );
});

test("ASCII trim keeps ordinary Scan Item camera barcodes stable", () => {
  assert.equal(asciiTrimScanItemCameraBarcodeText(`  ${code}  `), code);
  assert.deepEqual(canonicalizeScanItemCameraBarcodeText(`\t${code}\n`), {
    status: "ok",
    text: code
  });
  assert.deepEqual(prepareScanItemCameraBarcodeText(`  ${code}  `), {
    status: "ok",
    text: code
  });
  assert.deepEqual(prepareScanItemCameraBarcodeText(code), {
    status: "ok",
    text: code
  });
  assert.deepEqual(prepareScanItemCameraBarcodeText("ABC-123"), {
    status: "ok",
    text: "ABC-123"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty.
  assert.deepEqual(prepareScanItemCameraBarcodeText("   "), { status: "empty" });
  assert.deepEqual(prepareScanItemCameraBarcodeText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareScanItemCameraBarcodeText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean Scan Item camera barcode", () => {
  const nbspCode = `${nbsp}${code}${nbsp}`;
  const emCode = `${em}${code}${em}`;

  // Live inventing proof on Unicode trim (what handleBarcode previously did).
  assert.equal(nbspCode.trim(), code);
  assert.equal(emCode.trim(), code);

  assert.deepEqual(canonicalizeScanItemCameraBarcodeText(nbspCode), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeScanItemCameraBarcodeText(emCode), {
    status: "invalid"
  });
  assert.deepEqual(prepareScanItemCameraBarcodeText(nbspCode), { status: "invalid" });
  assert.deepEqual(prepareScanItemCameraBarcodeText(emCode), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior ignore-scan, and
  // must not invent an ok code from a padded payload.
  assert.deepEqual(prepareScanItemCameraBarcodeText(`${em}${em}`), { status: "empty" });
  assert.deepEqual(prepareScanItemCameraBarcodeText(`${nbsp}${nbsp}`), { status: "empty" });
  assert.notDeepEqual(prepareScanItemCameraBarcodeText(emCode), { status: "empty" });
  assert.notDeepEqual(prepareScanItemCameraBarcodeText(emCode), {
    status: "ok",
    text: code
  });
});

test("ASCII controls and non-string camera barcodes fail closed without inventing", () => {
  assert.deepEqual(canonicalizeScanItemCameraBarcodeText("0123\n456"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeScanItemCameraBarcodeText("0123\r456"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeScanItemCameraBarcodeText("0123\x01456"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeScanItemCameraBarcodeText("0123\x7f456"), {
    status: "invalid"
  });
  assert.deepEqual(prepareScanItemCameraBarcodeText("0123\n456"), { status: "invalid" });
  assert.deepEqual(prepareScanItemCameraBarcodeText("0123\x7f456"), {
    status: "invalid"
  });

  assert.deepEqual(prepareScanItemCameraBarcodeText(null), { status: "invalid" });
  assert.deepEqual(prepareScanItemCameraBarcodeText(undefined), { status: "invalid" });
  assert.deepEqual(prepareScanItemCameraBarcodeText(12345), { status: "invalid" });
});

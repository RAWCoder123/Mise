import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INVENTORY_DETAIL_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS,
  canonicalInventoryDetailSubmitErrorMessage,
  describeInventoryDetailSubmitError,
  normalizeInventoryDetailSubmitErrorMessage,
  resolveInventoryDetailSubmitErrorMessage
} from "../services/domain/inventoryDetailSubmitErrorMessageIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryDetailSubmitErrorMessageIdentity.ts", import.meta.url),
  "utf8"
);
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);

const cleanMessage = "Queue flush failed while recording the count.";
const accentedMessage = "Error al registrar el conteo mañana.";
const multilineMessage = "Queue flush failed.\nRetry after lock.\tKeep calm.";
const fallbackMessage = "Could not submit the inventory update.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YG pins Inventory detail submitError.message to ASCII C", () => {
  assert.match(identitySource, /MISE-005YG/);
  assert.match(inventoryDetailSource, /MISE-005YG/);
  assert.match(inventoryDetailSource, /describeInventoryDetailSubmitError/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /INVENTORY_DETAIL_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS = 220/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalInventoryDetailSubmitErrorMessage("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  // Leave Log Delivery's twin submitError.path alone on this tip.
  assert.doesNotMatch(logDeliverySource, /MISE-005YG/);
  assert.doesNotMatch(logDeliverySource, /describeInventoryDetailSubmitError/);
  assert.match(
    logDeliverySource,
    /submitError instanceof Error && submitError\.message\.trim\(\)/
  );
});

test("MISE-005YG inventing proof: Unicode trim invents clean submitError gate presence", () => {
  const padded = `${em}${cleanMessage}${em}`;
  assert.equal(padded.trim(), cleanMessage);
  assert.notEqual(padded, cleanMessage);

  // Prior gate: truthy Unicode trim forced the raw-slice branch.
  assert.equal(Boolean(padded.trim()), true);
  // Soft-null refuses to invent a clean diagnostic from em-space padding.
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(padded), null);
  assert.equal(
    describeInventoryDetailSubmitError(new Error(padded), fallbackMessage),
    fallbackMessage
  );
});

test("MISE-005YG soft-nulls empty, Unicode-only space, controls, and non-strings", () => {
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(null), null);
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(undefined), null);
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(""), null);
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(em), null);
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(nbsp), null);
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(" \t\n "), null);
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(`bell\u0007alert`), null);
  assert.equal(
    normalizeInventoryDetailSubmitErrorMessage({} as unknown as string),
    null
  );

  assert.equal(
    resolveInventoryDetailSubmitErrorMessage(em, fallbackMessage),
    fallbackMessage
  );
  assert.equal(
    describeInventoryDetailSubmitError(new Error(em), fallbackMessage),
    fallbackMessage
  );
  assert.equal(describeInventoryDetailSubmitError("not-an-error", fallbackMessage), fallbackMessage);
  assert.equal(describeInventoryDetailSubmitError(null, fallbackMessage), fallbackMessage);
});

test("MISE-005YG preserves clean, accented, multiline, and NBSP-folded diagnostics", () => {
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(cleanMessage), cleanMessage);
  assert.equal(
    normalizeInventoryDetailSubmitErrorMessage(`  ${cleanMessage}  `),
    cleanMessage
  );
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(accentedMessage), accentedMessage);
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(multilineMessage), multilineMessage);

  const withNbsp = `${nbsp}${cleanMessage}${nbsp}`;
  assert.equal(canonicalInventoryDetailSubmitErrorMessage(withNbsp), cleanMessage);
  assert.equal(normalizeInventoryDetailSubmitErrorMessage(withNbsp), cleanMessage);

  assert.equal(
    describeInventoryDetailSubmitError(new Error(cleanMessage), fallbackMessage),
    cleanMessage
  );
});

test("MISE-005YG truncates to the prior 220-character bound after ASCII C prep", () => {
  const long = `${"a".repeat(INVENTORY_DETAIL_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS + 40)}`;
  const prepared = normalizeInventoryDetailSubmitErrorMessage(long);
  assert.ok(prepared);
  assert.equal(prepared.length, INVENTORY_DETAIL_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS);

  // Inventory detail catch path must no longer Unicode-trim then raw-slice.
  assert.doesNotMatch(
    inventoryDetailSource,
    /submitError instanceof Error && submitError\.message\.trim\(\)/
  );
  assert.doesNotMatch(inventoryDetailSource, /submitError\.message\.slice\(0,\s*220\)/);
});

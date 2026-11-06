import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LOG_DELIVERY_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS,
  canonicalLogDeliverySubmitErrorMessage,
  describeLogDeliverySubmitError,
  normalizeLogDeliverySubmitErrorMessage,
  resolveLogDeliverySubmitErrorMessage
} from "../services/domain/logDeliverySubmitErrorMessageIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/logDeliverySubmitErrorMessageIdentity.ts", import.meta.url),
  "utf8"
);
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);

const cleanMessage = "Queue flush failed while recording the receipt.";
const accentedMessage = "Error al registrar la entrega mañana.";
const multilineMessage = "Queue flush failed.\nRetry after lock.\tKeep calm.";
const fallbackMessage = "Could not queue or sync this inventory event.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YH pins Log Delivery submitError.message to ASCII C", () => {
  assert.match(identitySource, /MISE-005YH/);
  assert.match(logDeliverySource, /MISE-005YH/);
  assert.match(logDeliverySource, /describeLogDeliverySubmitError/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /LOG_DELIVERY_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS = 220/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalLogDeliverySubmitErrorMessage("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  // Leave Inventory detail's twin submitError.path alone on this tip.
  assert.doesNotMatch(inventoryDetailSource, /MISE-005YH/);
  assert.doesNotMatch(inventoryDetailSource, /describeLogDeliverySubmitError/);
  // On this tip's base (origin/main), Inventory detail still has the prior
  // inventing gate until #1139 lands. Do not rewrite that catch here.
  assert.match(
    inventoryDetailSource,
    /submitError instanceof Error && submitError\.message\.trim\(\)/
  );
});

test("MISE-005YH inventing proof: Unicode trim invents clean submitError gate presence", () => {
  const padded = `${em}${cleanMessage}${em}`;
  assert.equal(padded.trim(), cleanMessage);
  assert.notEqual(padded, cleanMessage);

  // Prior gate: truthy Unicode trim forced the raw-slice branch.
  assert.equal(Boolean(padded.trim()), true);
  // Soft-null refuses to invent a clean diagnostic from em-space padding.
  assert.equal(normalizeLogDeliverySubmitErrorMessage(padded), null);
  assert.equal(
    describeLogDeliverySubmitError(new Error(padded), fallbackMessage),
    fallbackMessage
  );
});

test("MISE-005YH soft-nulls empty, Unicode-only space, controls, and non-strings", () => {
  assert.equal(normalizeLogDeliverySubmitErrorMessage(null), null);
  assert.equal(normalizeLogDeliverySubmitErrorMessage(undefined), null);
  assert.equal(normalizeLogDeliverySubmitErrorMessage(""), null);
  assert.equal(normalizeLogDeliverySubmitErrorMessage(em), null);
  assert.equal(normalizeLogDeliverySubmitErrorMessage(nbsp), null);
  assert.equal(normalizeLogDeliverySubmitErrorMessage(" \t\n "), null);
  assert.equal(normalizeLogDeliverySubmitErrorMessage(`bell\u0007alert`), null);
  assert.equal(
    normalizeLogDeliverySubmitErrorMessage({} as unknown as string),
    null
  );

  assert.equal(
    resolveLogDeliverySubmitErrorMessage(em, fallbackMessage),
    fallbackMessage
  );
  assert.equal(
    describeLogDeliverySubmitError(new Error(em), fallbackMessage),
    fallbackMessage
  );
  assert.equal(describeLogDeliverySubmitError("not-an-error", fallbackMessage), fallbackMessage);
  assert.equal(describeLogDeliverySubmitError(null, fallbackMessage), fallbackMessage);
});

test("MISE-005YH preserves clean, accented, multiline, and NBSP-folded diagnostics", () => {
  assert.equal(normalizeLogDeliverySubmitErrorMessage(cleanMessage), cleanMessage);
  assert.equal(
    normalizeLogDeliverySubmitErrorMessage(`  ${cleanMessage}  `),
    cleanMessage
  );
  assert.equal(normalizeLogDeliverySubmitErrorMessage(accentedMessage), accentedMessage);
  assert.equal(normalizeLogDeliverySubmitErrorMessage(multilineMessage), multilineMessage);

  const withNbsp = `${nbsp}${cleanMessage}${nbsp}`;
  assert.equal(canonicalLogDeliverySubmitErrorMessage(withNbsp), cleanMessage);
  assert.equal(normalizeLogDeliverySubmitErrorMessage(withNbsp), cleanMessage);

  assert.equal(
    describeLogDeliverySubmitError(new Error(cleanMessage), fallbackMessage),
    cleanMessage
  );
});

test("MISE-005YH truncates to the prior 220-character bound after ASCII C prep", () => {
  const long = `${"a".repeat(LOG_DELIVERY_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS + 40)}`;
  const prepared = normalizeLogDeliverySubmitErrorMessage(long);
  assert.ok(prepared);
  assert.equal(prepared.length, LOG_DELIVERY_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS);

  // Log Delivery catch path must no longer Unicode-trim then raw-slice.
  assert.doesNotMatch(
    logDeliverySource,
    /submitError instanceof Error && submitError\.message\.trim\(\)/
  );
  assert.doesNotMatch(logDeliverySource, /submitError\.message\.slice\(0,\s*220\)/);
});

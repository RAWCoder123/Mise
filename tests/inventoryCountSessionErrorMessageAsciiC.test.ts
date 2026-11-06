import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INVENTORY_COUNT_SESSION_ERROR_MESSAGE_MAX_CHARACTERS,
  canonicalInventoryCountSessionErrorMessage,
  describeInventoryCountSessionError,
  normalizeInventoryCountSessionErrorMessage,
  resolveInventoryCountSessionErrorMessage
} from "../services/domain/inventoryCountSessionErrorMessageIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryCountSessionErrorMessageIdentity.ts", import.meta.url),
  "utf8"
);
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);

const cleanMessage = "Count submit failed while verifying incomplete lines.";
const accentedMessage = "No se pudo enviar la sesión de conteo mañana.";
const multilineMessage = "Count submit failed.\nRetry after lock.\tKeep calm.";
const fallbackMessage = "Could not submit the count session.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YI pins Inventory count session catch Error.message to ASCII C", () => {
  assert.match(identitySource, /MISE-005YI/);
  assert.match(countSource, /MISE-005YI/);
  assert.match(countSource, /describeInventoryCountSessionError/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /INVENTORY_COUNT_SESSION_ERROR_MESSAGE_MAX_CHARACTERS = 220/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalInventoryCountSessionErrorMessage("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  // All five count-session catch sites must use the describe helper.
  assert.equal(
    (countSource.match(/describeInventoryCountSessionError\(/g) ?? []).length,
    6
  );
  assert.match(countSource, /t\("inventory\.count\.startError"\)/);
  assert.match(countSource, /t\("inventory\.count\.saveError"\)/);
  assert.match(countSource, /t\("inventory\.count\.submitError"\)/);
  assert.match(countSource, /t\("inventory\.count\.approveError"\)/);
  assert.match(countSource, /t\("inventory\.count\.cancelError"\)/);

  // Leave Inventory detail and Log Delivery twin submitError paths alone.
  assert.doesNotMatch(inventoryDetailSource, /MISE-005YI/);
  assert.doesNotMatch(inventoryDetailSource, /describeInventoryCountSessionError/);
  assert.doesNotMatch(logDeliverySource, /MISE-005YI/);
  assert.doesNotMatch(logDeliverySource, /describeInventoryCountSessionError/);
  // On this tip's base (origin/main), those twins still have the prior
  // inventing gate until #1139 / #1140 land. Do not rewrite those catches here.
  assert.match(
    inventoryDetailSource,
    /submitError instanceof Error && submitError\.message\.trim\(\)/
  );
  assert.match(
    logDeliverySource,
    /submitError instanceof Error && submitError\.message\.trim\(\)/
  );
});

test("MISE-005YI inventing proof: instanceof Error forces raw padded/empty message", () => {
  const padded = `${em}${cleanMessage}${em}`;
  assert.equal(padded.trim(), cleanMessage);
  assert.notEqual(padded, cleanMessage);

  // Prior gate: any Error forced the raw message branch, including padded.
  const priorSelect = (caught: unknown, fallback: string) =>
    caught instanceof Error ? caught.message : fallback;
  assert.equal(priorSelect(new Error(padded), fallbackMessage), padded);
  assert.equal(priorSelect(new Error(""), fallbackMessage), "");
  assert.equal(priorSelect(new Error(em), fallbackMessage), em);

  // Soft-null refuses to invent a clean diagnostic from em-space padding or
  // soft-empty tokens, restoring the localized fallback.
  assert.equal(normalizeInventoryCountSessionErrorMessage(padded), null);
  assert.equal(normalizeInventoryCountSessionErrorMessage(""), null);
  assert.equal(normalizeInventoryCountSessionErrorMessage(em), null);
  assert.equal(
    describeInventoryCountSessionError(new Error(padded), fallbackMessage),
    fallbackMessage
  );
  assert.equal(
    describeInventoryCountSessionError(new Error(""), fallbackMessage),
    fallbackMessage
  );
  assert.equal(
    describeInventoryCountSessionError(new Error(em), fallbackMessage),
    fallbackMessage
  );
});

test("MISE-005YI soft-nulls empty, Unicode-only space, controls, and non-strings", () => {
  assert.equal(normalizeInventoryCountSessionErrorMessage(null), null);
  assert.equal(normalizeInventoryCountSessionErrorMessage(undefined), null);
  assert.equal(normalizeInventoryCountSessionErrorMessage(""), null);
  assert.equal(normalizeInventoryCountSessionErrorMessage(em), null);
  assert.equal(normalizeInventoryCountSessionErrorMessage(nbsp), null);
  assert.equal(normalizeInventoryCountSessionErrorMessage(" \t\n "), null);
  assert.equal(normalizeInventoryCountSessionErrorMessage(`bell\u0007alert`), null);
  assert.equal(
    normalizeInventoryCountSessionErrorMessage({} as unknown as string),
    null
  );

  assert.equal(
    resolveInventoryCountSessionErrorMessage(em, fallbackMessage),
    fallbackMessage
  );
  assert.equal(
    describeInventoryCountSessionError(new Error(em), fallbackMessage),
    fallbackMessage
  );
  assert.equal(
    describeInventoryCountSessionError("not-an-error", fallbackMessage),
    fallbackMessage
  );
  assert.equal(describeInventoryCountSessionError(null, fallbackMessage), fallbackMessage);
});

test("MISE-005YI preserves clean, accented, multiline, and NBSP-folded diagnostics", () => {
  assert.equal(normalizeInventoryCountSessionErrorMessage(cleanMessage), cleanMessage);
  assert.equal(
    normalizeInventoryCountSessionErrorMessage(`  ${cleanMessage}  `),
    cleanMessage
  );
  assert.equal(normalizeInventoryCountSessionErrorMessage(accentedMessage), accentedMessage);
  assert.equal(normalizeInventoryCountSessionErrorMessage(multilineMessage), multilineMessage);

  const withNbsp = `${nbsp}${cleanMessage}${nbsp}`;
  assert.equal(canonicalInventoryCountSessionErrorMessage(withNbsp), cleanMessage);
  assert.equal(normalizeInventoryCountSessionErrorMessage(withNbsp), cleanMessage);

  // Intentional localized validation throws (noteTooLong / incomplete) must
  // still surface after ASCII C prep.
  const localizedValidation = "Finish every countable line before submit.";
  assert.equal(
    describeInventoryCountSessionError(new Error(localizedValidation), fallbackMessage),
    localizedValidation
  );
  assert.equal(
    describeInventoryCountSessionError(new Error(cleanMessage), fallbackMessage),
    cleanMessage
  );
});

test("MISE-005YI truncates to the 220-character bound after ASCII C prep", () => {
  const long = `${"a".repeat(INVENTORY_COUNT_SESSION_ERROR_MESSAGE_MAX_CHARACTERS + 40)}`;
  const prepared = normalizeInventoryCountSessionErrorMessage(long);
  assert.ok(prepared);
  assert.equal(prepared.length, INVENTORY_COUNT_SESSION_ERROR_MESSAGE_MAX_CHARACTERS);

  // Count session catch paths must no longer project raw Error.message.
  assert.doesNotMatch(
    countSource,
    /caught instanceof Error \? caught\.message : t\("inventory\.count\./
  );
});

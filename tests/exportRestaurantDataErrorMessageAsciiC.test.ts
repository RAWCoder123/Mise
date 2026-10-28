import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS,
  canonicalExportRestaurantDataErrorMessage,
  normalizeExportRestaurantDataErrorMessage,
  resolveExportRestaurantDataErrorMessage
} from "../services/repositories/exportRestaurantDataErrorMessageIdentity";

const identitySource = readFileSync(
  new URL("../services/repositories/exportRestaurantDataErrorMessageIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const cleanMessage = "Your restaurant export is unchanged — try again.";
const accentedMessage = "No se pudo exportar los datos mañana.";
const multilineMessage = "Restaurant export failed.\nContact support.\tKeep calm.";
const fallbackMessage = "Restaurant data could not be exported. Try again.";

test("MISE-005SU pins export-restaurant-data error messages to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005SU/);
  assert.match(repositorySource, /MISE-005SU/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS = 320/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalExportRestaurantDataErrorMessage("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    repositorySource,
    /from "\.\/exportRestaurantDataErrorMessageIdentity"/
  );
  assert.match(
    repositorySource,
    /resolveExportRestaurantDataErrorMessage\(/
  );

  // Export tip only — leave account-deletion / Gmail / Square haystacks alone.
  const exportStart = repositorySource.indexOf(
    "async exportRestaurantData(restaurantId)"
  );
  const exportEnd = repositorySource.indexOf(
    "async createRestaurantWithOwner("
  );
  assert.ok(exportStart > 0 && exportEnd > exportStart);
  const exportBody = repositorySource.slice(exportStart, exportEnd);
  assert.match(
    exportBody,
    /resolveExportRestaurantDataErrorMessage\(/
  );
  assert.doesNotMatch(
    exportBody,
    /payload\.error\.trim\(\)\.slice\(0, 320\)/
  );

  const deleteAccountStart = repositorySource.indexOf("async deleteAccount(restaurantId)");
  const deleteAccountEnd = repositorySource.indexOf(
    "async exportRestaurantData(restaurantId)"
  );
  assert.ok(deleteAccountStart > 0 && deleteAccountEnd > deleteAccountStart);
  const deleteAccountBody = repositorySource.slice(deleteAccountStart, deleteAccountEnd);
  assert.match(
    deleteAccountBody,
    /payload\.error\.trim\(\)\.slice\(0, 320\)/
  );
  assert.match(
    deleteAccountBody,
    /payload\.deletionReference\.trim\(\)\.slice\(0, 80\)/
  );
  assert.doesNotMatch(deleteAccountBody, /resolveExportRestaurantDataErrorMessage/);
  assert.doesNotMatch(deleteAccountBody, /resolveAccountDeletionErrorMessage/);

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
  assert.doesNotMatch(gmailBody, /resolveExportRestaurantDataErrorMessage/);

  const squareFnStart = repositorySource.indexOf(
    "async function squareIntegrationErrorFrom("
  );
  const squareFnEnd = repositorySource.indexOf(
    "async function gmailIntegrationErrorFrom("
  );
  assert.ok(squareFnStart > 0 && squareFnEnd > squareFnStart);
  const squareBody = repositorySource.slice(squareFnStart, squareFnEnd);
  assert.match(
    squareBody,
    /const message = candidateMessage\.trim\(\)\.slice\(0, 320\) \|\| fallbackMessage;/
  );
  assert.doesNotMatch(squareBody, /resolveExportRestaurantDataErrorMessage/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /accountDeletionErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /accountDeletionReferenceIdentity/);
  assert.doesNotMatch(identityCode, /gmailIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /recalculationDescribeErrorIdentity/);
  assert.doesNotMatch(identityCode, /recalculationScheduleFailureReasonIdentity/);
  assert.doesNotMatch(identityCode, /deletionReference/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C free-text prep keeps ordinary export-restaurant-data error haystacks stable", () => {
  assert.equal(canonicalExportRestaurantDataErrorMessage(`  ${cleanMessage}  `), cleanMessage);
  assert.equal(canonicalExportRestaurantDataErrorMessage(`\t${cleanMessage}\n`), cleanMessage);
  assert.equal(normalizeExportRestaurantDataErrorMessage(`  ${cleanMessage}  `), cleanMessage);

  assert.equal(canonicalExportRestaurantDataErrorMessage(accentedMessage), accentedMessage);
  assert.equal(normalizeExportRestaurantDataErrorMessage(accentedMessage), accentedMessage);

  assert.equal(canonicalExportRestaurantDataErrorMessage(multilineMessage), multilineMessage);
  assert.equal(normalizeExportRestaurantDataErrorMessage(multilineMessage), multilineMessage);

  assert.equal(
    resolveExportRestaurantDataErrorMessage(`  ${cleanMessage}  `, fallbackMessage),
    cleanMessage
  );
  assert.equal(
    resolveExportRestaurantDataErrorMessage(accentedMessage, fallbackMessage),
    accentedMessage
  );
  assert.equal(
    resolveExportRestaurantDataErrorMessage(multilineMessage, fallbackMessage),
    multilineMessage
  );
});

test("NBSP folds and em-space padding cannot invent export-restaurant-data error haystacks", () => {
  const nbspMessage = `\u00a0${cleanMessage}\u00a0`;
  const emMessage = `\u2003${cleanMessage}\u2003`;
  const internalEm = `Restaurant\u2003export failed.`;
  const internalNbsp = `Restaurant\u00a0export failed.`;
  const emMultiline = `\u2003${multilineMessage}\u2003`;

  // Inventing proof against the prior Unicode trim sink.
  assert.equal(nbspMessage.trim(), cleanMessage);
  assert.equal(emMessage.trim(), cleanMessage);

  assert.equal(canonicalExportRestaurantDataErrorMessage(nbspMessage), cleanMessage);
  assert.equal(normalizeExportRestaurantDataErrorMessage(nbspMessage), cleanMessage);
  assert.equal(
    resolveExportRestaurantDataErrorMessage(nbspMessage, fallbackMessage),
    cleanMessage
  );
  assert.equal(
    canonicalExportRestaurantDataErrorMessage(internalNbsp),
    "Restaurant export failed."
  );

  // Unicode em-space trim invents a clean message; C free-text prep does not.
  assert.notEqual(canonicalExportRestaurantDataErrorMessage(emMessage), cleanMessage);
  assert.equal(canonicalExportRestaurantDataErrorMessage(emMessage), emMessage);
  assert.equal(normalizeExportRestaurantDataErrorMessage(emMessage), emMessage);
  assert.notEqual(normalizeExportRestaurantDataErrorMessage(emMessage), cleanMessage);
  assert.equal(
    resolveExportRestaurantDataErrorMessage(emMessage, fallbackMessage),
    emMessage
  );
  assert.notEqual(
    resolveExportRestaurantDataErrorMessage(emMessage, fallbackMessage),
    cleanMessage
  );

  assert.equal(canonicalExportRestaurantDataErrorMessage(internalEm), internalEm);
  assert.notEqual(
    canonicalExportRestaurantDataErrorMessage(internalEm),
    canonicalExportRestaurantDataErrorMessage("Restaurant export failed.")
  );

  assert.equal(emMultiline.trim(), multilineMessage);
  assert.notEqual(canonicalExportRestaurantDataErrorMessage(emMultiline), multilineMessage);
  assert.equal(canonicalExportRestaurantDataErrorMessage(emMultiline), emMultiline);
  assert.equal(normalizeExportRestaurantDataErrorMessage(emMultiline), emMultiline);
  assert.equal(
    resolveExportRestaurantDataErrorMessage(emMultiline, fallbackMessage),
    emMultiline
  );
});

test("soft empty, unsafe controls, and max length preserve prior export-restaurant-data error contracts", () => {
  assert.equal(normalizeExportRestaurantDataErrorMessage(null), null);
  assert.equal(normalizeExportRestaurantDataErrorMessage(undefined), null);
  assert.equal(normalizeExportRestaurantDataErrorMessage(""), null);
  assert.equal(normalizeExportRestaurantDataErrorMessage("   "), null);
  assert.equal(normalizeExportRestaurantDataErrorMessage("\u2003\u2003"), null);
  assert.equal(normalizeExportRestaurantDataErrorMessage("\u00a0\u00a0"), null);
  assert.equal(normalizeExportRestaurantDataErrorMessage("\u0000bad"), null);
  assert.equal(normalizeExportRestaurantDataErrorMessage("bad\u0007"), null);

  assert.equal(resolveExportRestaurantDataErrorMessage("", fallbackMessage), fallbackMessage);
  assert.equal(resolveExportRestaurantDataErrorMessage("   ", fallbackMessage), fallbackMessage);
  assert.equal(
    resolveExportRestaurantDataErrorMessage("\u2003\u2003", fallbackMessage),
    fallbackMessage
  );
  assert.equal(resolveExportRestaurantDataErrorMessage(null, fallbackMessage), fallbackMessage);
  assert.equal(
    resolveExportRestaurantDataErrorMessage("bad\u0000", fallbackMessage),
    fallbackMessage
  );

  const longClean = `${"a".repeat(EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS)}EXTRA`;
  assert.equal(
    normalizeExportRestaurantDataErrorMessage(longClean)?.length,
    EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS
  );
  assert.equal(
    resolveExportRestaurantDataErrorMessage(longClean, fallbackMessage).length,
    EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS
  );

  const longEm = `\u2003${"b".repeat(EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS + 20)}\u2003`;
  const preparedLongEm = normalizeExportRestaurantDataErrorMessage(longEm);
  assert.ok(preparedLongEm);
  assert.equal(preparedLongEm.length, EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS);
  assert.equal(preparedLongEm.startsWith("\u2003"), true);
  assert.notEqual(preparedLongEm, "b".repeat(EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS));
});

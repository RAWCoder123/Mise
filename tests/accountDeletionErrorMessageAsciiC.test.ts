import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ACCOUNT_DELETION_ERROR_MESSAGE_MAX_CHARACTERS,
  canonicalAccountDeletionErrorMessage,
  normalizeAccountDeletionErrorMessage,
  resolveAccountDeletionErrorMessage
} from "../services/repositories/accountDeletionErrorMessageIdentity";

const identitySource = readFileSync(
  new URL("../services/repositories/accountDeletionErrorMessageIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const cleanMessage = "Your restaurant access is unchanged — try again.";
const accentedMessage = "No se pudo eliminar la cuenta mañana.";
const multilineMessage = "Account deletion failed.\nContact support.\tKeep calm.";
const fallbackMessage = "Your account could not be deleted. Try again.";

test("MISE-005SS pins account-deletion error messages to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005SS/);
  assert.match(repositorySource, /MISE-005SS/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /ACCOUNT_DELETION_ERROR_MESSAGE_MAX_CHARACTERS = 320/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalAccountDeletionErrorMessage("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    repositorySource,
    /from "\.\/accountDeletionErrorMessageIdentity"/
  );
  assert.match(
    repositorySource,
    /resolveAccountDeletionErrorMessage\(/
  );

  // Account-deletion tip only — leave deletionReference / export / Gmail /
  // Square haystacks alone.
  const deleteAccountStart = repositorySource.indexOf("async deleteAccount(restaurantId)");
  const deleteAccountEnd = repositorySource.indexOf(
    "async exportRestaurantData(restaurantId)"
  );
  assert.ok(deleteAccountStart > 0 && deleteAccountEnd > deleteAccountStart);
  const deleteAccountBody = repositorySource.slice(deleteAccountStart, deleteAccountEnd);
  assert.match(
    deleteAccountBody,
    /resolveAccountDeletionErrorMessage\(/
  );
  assert.doesNotMatch(
    deleteAccountBody,
    /payload\.error\.trim\(\)\.slice\(0, 320\)/
  );
  assert.match(
    deleteAccountBody,
    /payload\.deletionReference\.trim\(\)\.slice\(0, 80\)/
  );

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
    /payload\.error\.trim\(\)\.slice\(0, 320\)/
  );
  assert.doesNotMatch(exportBody, /resolveAccountDeletionErrorMessage/);

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

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /gmailIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /recalculationDescribeErrorIdentity/);
  assert.doesNotMatch(identityCode, /recalculationScheduleFailureReasonIdentity/);
  assert.doesNotMatch(identityCode, /deletionReference/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C free-text prep keeps ordinary account-deletion error haystacks stable", () => {
  assert.equal(canonicalAccountDeletionErrorMessage(`  ${cleanMessage}  `), cleanMessage);
  assert.equal(canonicalAccountDeletionErrorMessage(`\t${cleanMessage}\n`), cleanMessage);
  assert.equal(normalizeAccountDeletionErrorMessage(`  ${cleanMessage}  `), cleanMessage);

  assert.equal(canonicalAccountDeletionErrorMessage(accentedMessage), accentedMessage);
  assert.equal(normalizeAccountDeletionErrorMessage(accentedMessage), accentedMessage);

  assert.equal(canonicalAccountDeletionErrorMessage(multilineMessage), multilineMessage);
  assert.equal(normalizeAccountDeletionErrorMessage(multilineMessage), multilineMessage);

  assert.equal(
    resolveAccountDeletionErrorMessage(`  ${cleanMessage}  `, fallbackMessage),
    cleanMessage
  );
  assert.equal(
    resolveAccountDeletionErrorMessage(accentedMessage, fallbackMessage),
    accentedMessage
  );
  assert.equal(
    resolveAccountDeletionErrorMessage(multilineMessage, fallbackMessage),
    multilineMessage
  );
});

test("NBSP folds and em-space padding cannot invent account-deletion error haystacks", () => {
  const nbspMessage = `\u00a0${cleanMessage}\u00a0`;
  const emMessage = `\u2003${cleanMessage}\u2003`;
  const internalEm = `Account\u2003deletion failed.`;
  const internalNbsp = `Account\u00a0deletion failed.`;
  const emMultiline = `\u2003${multilineMessage}\u2003`;

  // Inventing proof against the prior Unicode trim sink.
  assert.equal(nbspMessage.trim(), cleanMessage);
  assert.equal(emMessage.trim(), cleanMessage);

  assert.equal(canonicalAccountDeletionErrorMessage(nbspMessage), cleanMessage);
  assert.equal(normalizeAccountDeletionErrorMessage(nbspMessage), cleanMessage);
  assert.equal(
    resolveAccountDeletionErrorMessage(nbspMessage, fallbackMessage),
    cleanMessage
  );
  assert.equal(
    canonicalAccountDeletionErrorMessage(internalNbsp),
    "Account deletion failed."
  );

  // Unicode em-space trim invents a clean message; C free-text prep does not.
  assert.notEqual(canonicalAccountDeletionErrorMessage(emMessage), cleanMessage);
  assert.equal(canonicalAccountDeletionErrorMessage(emMessage), emMessage);
  assert.equal(normalizeAccountDeletionErrorMessage(emMessage), emMessage);
  assert.notEqual(normalizeAccountDeletionErrorMessage(emMessage), cleanMessage);
  assert.equal(
    resolveAccountDeletionErrorMessage(emMessage, fallbackMessage),
    emMessage
  );
  assert.notEqual(
    resolveAccountDeletionErrorMessage(emMessage, fallbackMessage),
    cleanMessage
  );

  assert.equal(canonicalAccountDeletionErrorMessage(internalEm), internalEm);
  assert.notEqual(
    canonicalAccountDeletionErrorMessage(internalEm),
    canonicalAccountDeletionErrorMessage("Account deletion failed.")
  );

  assert.equal(emMultiline.trim(), multilineMessage);
  assert.notEqual(canonicalAccountDeletionErrorMessage(emMultiline), multilineMessage);
  assert.equal(canonicalAccountDeletionErrorMessage(emMultiline), emMultiline);
  assert.equal(normalizeAccountDeletionErrorMessage(emMultiline), emMultiline);
  assert.equal(
    resolveAccountDeletionErrorMessage(emMultiline, fallbackMessage),
    emMultiline
  );
});

test("soft empty, unsafe controls, and max length preserve prior account-deletion error contracts", () => {
  assert.equal(normalizeAccountDeletionErrorMessage(null), null);
  assert.equal(normalizeAccountDeletionErrorMessage(undefined), null);
  assert.equal(normalizeAccountDeletionErrorMessage(""), null);
  assert.equal(normalizeAccountDeletionErrorMessage("   "), null);
  assert.equal(normalizeAccountDeletionErrorMessage("\u2003\u2003"), null);
  assert.equal(normalizeAccountDeletionErrorMessage("\u00a0\u00a0"), null);
  assert.equal(normalizeAccountDeletionErrorMessage("\u0000bad"), null);
  assert.equal(normalizeAccountDeletionErrorMessage("bad\u0007"), null);

  assert.equal(resolveAccountDeletionErrorMessage("", fallbackMessage), fallbackMessage);
  assert.equal(resolveAccountDeletionErrorMessage("   ", fallbackMessage), fallbackMessage);
  assert.equal(
    resolveAccountDeletionErrorMessage("\u2003\u2003", fallbackMessage),
    fallbackMessage
  );
  assert.equal(resolveAccountDeletionErrorMessage(null, fallbackMessage), fallbackMessage);
  assert.equal(
    resolveAccountDeletionErrorMessage("bad\u0000", fallbackMessage),
    fallbackMessage
  );

  const longClean = `${"a".repeat(ACCOUNT_DELETION_ERROR_MESSAGE_MAX_CHARACTERS)}EXTRA`;
  assert.equal(
    normalizeAccountDeletionErrorMessage(longClean)?.length,
    ACCOUNT_DELETION_ERROR_MESSAGE_MAX_CHARACTERS
  );
  assert.equal(
    resolveAccountDeletionErrorMessage(longClean, fallbackMessage).length,
    ACCOUNT_DELETION_ERROR_MESSAGE_MAX_CHARACTERS
  );

  const longEm = `\u2003${"b".repeat(ACCOUNT_DELETION_ERROR_MESSAGE_MAX_CHARACTERS + 20)}\u2003`;
  const preparedLongEm = normalizeAccountDeletionErrorMessage(longEm);
  assert.ok(preparedLongEm);
  assert.equal(preparedLongEm.length, ACCOUNT_DELETION_ERROR_MESSAGE_MAX_CHARACTERS);
  assert.equal(preparedLongEm.startsWith("\u2003"), true);
  assert.notEqual(preparedLongEm, "b".repeat(ACCOUNT_DELETION_ERROR_MESSAGE_MAX_CHARACTERS));
});

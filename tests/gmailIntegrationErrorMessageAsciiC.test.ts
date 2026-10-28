import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GMAIL_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS,
  canonicalGmailIntegrationErrorMessage,
  normalizeGmailIntegrationErrorMessage,
  resolveGmailIntegrationErrorMessage
} from "../services/repositories/gmailIntegrationErrorMessageIdentity";

const identitySource = readFileSync(
  new URL("../services/repositories/gmailIntegrationErrorMessageIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const cleanMessage = "Gmail token refresh failed.";
const accentedMessage = "Error al renovar el token de Gmail mañana.";
const multilineMessage = "Gmail token refresh failed.\nRetry after reconnect.\tKeep calm.";
const fallbackMessage = "Gmail could not complete this request.";

test("MISE-005SR pins Gmail integration error messages to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005SR/);
  assert.match(repositorySource, /MISE-005SR/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /GMAIL_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS = 320/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalGmailIntegrationErrorMessage("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    repositorySource,
    /from "\.\/gmailIntegrationErrorMessageIdentity"/
  );
  assert.match(
    repositorySource,
    /resolveGmailIntegrationErrorMessage\(candidateMessage, fallbackMessage\)/
  );

  // Gmail tip only — leave Square / account-deletion / export haystacks alone.
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
    /resolveGmailIntegrationErrorMessage\(candidateMessage, fallbackMessage\)/
  );
  assert.doesNotMatch(
    gmailBody,
    /candidateMessage\.trim\(\)\.slice\(0, 320\)/
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

  assert.match(
    repositorySource,
    /payload\.error\.trim\(\)\.slice\(0, 320\)/
  );
  assert.match(
    repositorySource,
    /payload\.deletionReference\.trim\(\)\.slice\(0, 80\)/
  );

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /recalculationDescribeErrorIdentity/);
  assert.doesNotMatch(identityCode, /recalculationScheduleFailureReasonIdentity/);
  assert.doesNotMatch(identityCode, /deletionReference/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C free-text prep keeps ordinary Gmail error haystacks stable", () => {
  assert.equal(canonicalGmailIntegrationErrorMessage(`  ${cleanMessage}  `), cleanMessage);
  assert.equal(canonicalGmailIntegrationErrorMessage(`\t${cleanMessage}\n`), cleanMessage);
  assert.equal(normalizeGmailIntegrationErrorMessage(`  ${cleanMessage}  `), cleanMessage);

  assert.equal(canonicalGmailIntegrationErrorMessage(accentedMessage), accentedMessage);
  assert.equal(normalizeGmailIntegrationErrorMessage(accentedMessage), accentedMessage);

  assert.equal(canonicalGmailIntegrationErrorMessage(multilineMessage), multilineMessage);
  assert.equal(normalizeGmailIntegrationErrorMessage(multilineMessage), multilineMessage);

  assert.equal(
    resolveGmailIntegrationErrorMessage(`  ${cleanMessage}  `, fallbackMessage),
    cleanMessage
  );
  assert.equal(
    resolveGmailIntegrationErrorMessage(accentedMessage, fallbackMessage),
    accentedMessage
  );
  assert.equal(
    resolveGmailIntegrationErrorMessage(multilineMessage, fallbackMessage),
    multilineMessage
  );
});

test("NBSP folds and em-space padding cannot invent Gmail error haystacks", () => {
  const nbspMessage = `\u00a0${cleanMessage}\u00a0`;
  const emMessage = `\u2003${cleanMessage}\u2003`;
  const internalEm = `Gmail\u2003token refresh failed.`;
  const internalNbsp = `Gmail\u00a0token refresh failed.`;
  const emMultiline = `\u2003${multilineMessage}\u2003`;

  // Inventing proof against the prior Unicode trim sink.
  assert.equal(nbspMessage.trim(), cleanMessage);
  assert.equal(emMessage.trim(), cleanMessage);

  assert.equal(canonicalGmailIntegrationErrorMessage(nbspMessage), cleanMessage);
  assert.equal(normalizeGmailIntegrationErrorMessage(nbspMessage), cleanMessage);
  assert.equal(
    resolveGmailIntegrationErrorMessage(nbspMessage, fallbackMessage),
    cleanMessage
  );
  assert.equal(
    canonicalGmailIntegrationErrorMessage(internalNbsp),
    "Gmail token refresh failed."
  );

  // Unicode em-space trim invents a clean message; C free-text prep does not.
  assert.notEqual(canonicalGmailIntegrationErrorMessage(emMessage), cleanMessage);
  assert.equal(canonicalGmailIntegrationErrorMessage(emMessage), emMessage);
  assert.equal(normalizeGmailIntegrationErrorMessage(emMessage), emMessage);
  assert.notEqual(normalizeGmailIntegrationErrorMessage(emMessage), cleanMessage);
  assert.equal(
    resolveGmailIntegrationErrorMessage(emMessage, fallbackMessage),
    emMessage
  );
  assert.notEqual(
    resolveGmailIntegrationErrorMessage(emMessage, fallbackMessage),
    cleanMessage
  );

  assert.equal(canonicalGmailIntegrationErrorMessage(internalEm), internalEm);
  assert.notEqual(
    canonicalGmailIntegrationErrorMessage(internalEm),
    canonicalGmailIntegrationErrorMessage(cleanMessage)
  );

  assert.equal(emMultiline.trim(), multilineMessage);
  assert.notEqual(canonicalGmailIntegrationErrorMessage(emMultiline), multilineMessage);
  assert.equal(canonicalGmailIntegrationErrorMessage(emMultiline), emMultiline);
  assert.equal(normalizeGmailIntegrationErrorMessage(emMultiline), emMultiline);
  assert.equal(
    resolveGmailIntegrationErrorMessage(emMultiline, fallbackMessage),
    emMultiline
  );
});

test("soft empty, unsafe controls, and max length preserve prior Gmail error contracts", () => {
  assert.equal(normalizeGmailIntegrationErrorMessage(null), null);
  assert.equal(normalizeGmailIntegrationErrorMessage(undefined), null);
  assert.equal(normalizeGmailIntegrationErrorMessage(""), null);
  assert.equal(normalizeGmailIntegrationErrorMessage("   "), null);
  assert.equal(normalizeGmailIntegrationErrorMessage("\u2003\u2003"), null);
  assert.equal(normalizeGmailIntegrationErrorMessage("\u00a0\u00a0"), null);
  assert.equal(normalizeGmailIntegrationErrorMessage("\u0000bad"), null);
  assert.equal(normalizeGmailIntegrationErrorMessage("bad\u0007"), null);

  assert.equal(resolveGmailIntegrationErrorMessage("", fallbackMessage), fallbackMessage);
  assert.equal(resolveGmailIntegrationErrorMessage("   ", fallbackMessage), fallbackMessage);
  assert.equal(
    resolveGmailIntegrationErrorMessage("\u2003\u2003", fallbackMessage),
    fallbackMessage
  );
  assert.equal(resolveGmailIntegrationErrorMessage(null, fallbackMessage), fallbackMessage);
  assert.equal(
    resolveGmailIntegrationErrorMessage("bad\u0000", fallbackMessage),
    fallbackMessage
  );

  const longClean = `${"a".repeat(GMAIL_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS)}EXTRA`;
  assert.equal(
    normalizeGmailIntegrationErrorMessage(longClean)?.length,
    GMAIL_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS
  );
  assert.equal(
    resolveGmailIntegrationErrorMessage(longClean, fallbackMessage).length,
    GMAIL_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS
  );

  const longEm = `\u2003${"b".repeat(GMAIL_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS + 20)}\u2003`;
  const preparedLongEm = normalizeGmailIntegrationErrorMessage(longEm);
  assert.ok(preparedLongEm);
  assert.equal(preparedLongEm.length, GMAIL_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS);
  assert.equal(preparedLongEm.startsWith("\u2003"), true);
  assert.notEqual(preparedLongEm, "b".repeat(GMAIL_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS));
});

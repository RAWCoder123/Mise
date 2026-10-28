import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SQUARE_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS,
  canonicalSquareIntegrationErrorMessage,
  normalizeSquareIntegrationErrorMessage,
  resolveSquareIntegrationErrorMessage
} from "../services/repositories/squareIntegrationErrorMessageIdentity";

const identitySource = readFileSync(
  new URL("../services/repositories/squareIntegrationErrorMessageIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const cleanMessage = "Square token refresh failed.";
const accentedMessage = "Error al renovar el token de Square mañana.";
const multilineMessage = "Square token refresh failed.\nRetry after reconnect.\tKeep calm.";
const fallbackMessage = "Square could not complete this request.";

test("MISE-005SQ pins Square integration error messages to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005SQ/);
  assert.match(repositorySource, /MISE-005SQ/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /SQUARE_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS = 320/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalSquareIntegrationErrorMessage("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    repositorySource,
    /from "\.\/squareIntegrationErrorMessageIdentity"/
  );
  assert.match(
    repositorySource,
    /resolveSquareIntegrationErrorMessage\(candidateMessage, fallbackMessage\)/
  );

  // Square tip only — leave Gmail / account-deletion / export haystacks alone.
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
    /resolveSquareIntegrationErrorMessage\(candidateMessage, fallbackMessage\)/
  );
  assert.doesNotMatch(
    squareBody,
    /candidateMessage\.trim\(\)\.slice\(0, 320\)/
  );

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
  assert.doesNotMatch(identityCode, /recalculationDescribeErrorIdentity/);
  assert.doesNotMatch(identityCode, /recalculationScheduleFailureReasonIdentity/);
  assert.doesNotMatch(identityCode, /gmailIntegrationError/);
  assert.doesNotMatch(identityCode, /deletionReference/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C free-text prep keeps ordinary Square error haystacks stable", () => {
  assert.equal(canonicalSquareIntegrationErrorMessage(`  ${cleanMessage}  `), cleanMessage);
  assert.equal(canonicalSquareIntegrationErrorMessage(`\t${cleanMessage}\n`), cleanMessage);
  assert.equal(normalizeSquareIntegrationErrorMessage(`  ${cleanMessage}  `), cleanMessage);

  assert.equal(canonicalSquareIntegrationErrorMessage(accentedMessage), accentedMessage);
  assert.equal(normalizeSquareIntegrationErrorMessage(accentedMessage), accentedMessage);

  assert.equal(canonicalSquareIntegrationErrorMessage(multilineMessage), multilineMessage);
  assert.equal(normalizeSquareIntegrationErrorMessage(multilineMessage), multilineMessage);

  assert.equal(
    resolveSquareIntegrationErrorMessage(`  ${cleanMessage}  `, fallbackMessage),
    cleanMessage
  );
  assert.equal(
    resolveSquareIntegrationErrorMessage(accentedMessage, fallbackMessage),
    accentedMessage
  );
  assert.equal(
    resolveSquareIntegrationErrorMessage(multilineMessage, fallbackMessage),
    multilineMessage
  );
});

test("NBSP folds and em-space padding cannot invent Square error haystacks", () => {
  const nbspMessage = `\u00a0${cleanMessage}\u00a0`;
  const emMessage = `\u2003${cleanMessage}\u2003`;
  const internalEm = `Square\u2003token refresh failed.`;
  const internalNbsp = `Square\u00a0token refresh failed.`;
  const emMultiline = `\u2003${multilineMessage}\u2003`;

  // Inventing proof against the prior Unicode trim sink.
  assert.equal(nbspMessage.trim(), cleanMessage);
  assert.equal(emMessage.trim(), cleanMessage);

  assert.equal(canonicalSquareIntegrationErrorMessage(nbspMessage), cleanMessage);
  assert.equal(normalizeSquareIntegrationErrorMessage(nbspMessage), cleanMessage);
  assert.equal(
    resolveSquareIntegrationErrorMessage(nbspMessage, fallbackMessage),
    cleanMessage
  );
  assert.equal(
    canonicalSquareIntegrationErrorMessage(internalNbsp),
    "Square token refresh failed."
  );

  // Unicode em-space trim invents a clean message; C free-text prep does not.
  assert.notEqual(canonicalSquareIntegrationErrorMessage(emMessage), cleanMessage);
  assert.equal(canonicalSquareIntegrationErrorMessage(emMessage), emMessage);
  assert.equal(normalizeSquareIntegrationErrorMessage(emMessage), emMessage);
  assert.notEqual(normalizeSquareIntegrationErrorMessage(emMessage), cleanMessage);
  assert.equal(
    resolveSquareIntegrationErrorMessage(emMessage, fallbackMessage),
    emMessage
  );
  assert.notEqual(
    resolveSquareIntegrationErrorMessage(emMessage, fallbackMessage),
    cleanMessage
  );

  assert.equal(canonicalSquareIntegrationErrorMessage(internalEm), internalEm);
  assert.notEqual(
    canonicalSquareIntegrationErrorMessage(internalEm),
    canonicalSquareIntegrationErrorMessage(cleanMessage)
  );

  assert.equal(emMultiline.trim(), multilineMessage);
  assert.notEqual(canonicalSquareIntegrationErrorMessage(emMultiline), multilineMessage);
  assert.equal(canonicalSquareIntegrationErrorMessage(emMultiline), emMultiline);
  assert.equal(normalizeSquareIntegrationErrorMessage(emMultiline), emMultiline);
  assert.equal(
    resolveSquareIntegrationErrorMessage(emMultiline, fallbackMessage),
    emMultiline
  );
});

test("soft empty, unsafe controls, and max length preserve prior Square error contracts", () => {
  assert.equal(normalizeSquareIntegrationErrorMessage(null), null);
  assert.equal(normalizeSquareIntegrationErrorMessage(undefined), null);
  assert.equal(normalizeSquareIntegrationErrorMessage(""), null);
  assert.equal(normalizeSquareIntegrationErrorMessage("   "), null);
  assert.equal(normalizeSquareIntegrationErrorMessage("\u2003\u2003"), null);
  assert.equal(normalizeSquareIntegrationErrorMessage("\u00a0\u00a0"), null);
  assert.equal(normalizeSquareIntegrationErrorMessage("\u0000bad"), null);
  assert.equal(normalizeSquareIntegrationErrorMessage("bad\u0007"), null);

  assert.equal(resolveSquareIntegrationErrorMessage("", fallbackMessage), fallbackMessage);
  assert.equal(resolveSquareIntegrationErrorMessage("   ", fallbackMessage), fallbackMessage);
  assert.equal(
    resolveSquareIntegrationErrorMessage("\u2003\u2003", fallbackMessage),
    fallbackMessage
  );
  assert.equal(resolveSquareIntegrationErrorMessage(null, fallbackMessage), fallbackMessage);
  assert.equal(
    resolveSquareIntegrationErrorMessage("bad\u0000", fallbackMessage),
    fallbackMessage
  );

  const longClean = `${"a".repeat(SQUARE_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS)}EXTRA`;
  assert.equal(
    normalizeSquareIntegrationErrorMessage(longClean)?.length,
    SQUARE_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS
  );
  assert.equal(
    resolveSquareIntegrationErrorMessage(longClean, fallbackMessage).length,
    SQUARE_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS
  );

  const longEm = `\u2003${"b".repeat(SQUARE_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS + 20)}\u2003`;
  const preparedLongEm = normalizeSquareIntegrationErrorMessage(longEm);
  assert.ok(preparedLongEm);
  assert.equal(preparedLongEm.length, SQUARE_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS);
  assert.equal(preparedLongEm.startsWith("\u2003"), true);
  assert.notEqual(preparedLongEm, "b".repeat(SQUARE_INTEGRATION_ERROR_MESSAGE_MAX_CHARACTERS));
});

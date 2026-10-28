import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS,
  asciiTrimAccountDeletionReference,
  canonicalizeAccountDeletionReference,
  normalizeAccountDeletionReference,
  resolveAccountDeletionReference
} from "../services/repositories/accountDeletionReferenceIdentity";

const identitySource = readFileSync(
  new URL("../services/repositories/accountDeletionReferenceIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const cleanReference = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ST pins account-deletion deletionReference to ASCII C identity prep", () => {
  assert.match(identitySource, /MISE-005ST/);
  assert.match(repositorySource, /MISE-005ST/);

  assert.match(
    identitySource,
    /export function asciiTrimAccountDeletionReference\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    identitySource,
    /ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS = 80/
  );

  const canonicalizeBody = identitySource.slice(
    identitySource.indexOf("export function canonicalizeAccountDeletionReference("),
    identitySource.indexOf("export function normalizeAccountDeletionReference(")
  );
  assert.match(canonicalizeBody, /trimmed !== trimmed\.trim\(\)/);
  assert.match(canonicalizeBody, /hasControlCharacters\(trimmed\)/);
  assert.match(
    canonicalizeBody,
    /trimmed\.slice\(0, ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS\)/
  );
  assert.doesNotMatch(canonicalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalizeBody, /\.toLocaleLowerCase\(\)/);

  assert.match(
    repositorySource,
    /from "\.\/accountDeletionReferenceIdentity"/
  );
  assert.match(
    repositorySource,
    /resolveAccountDeletionReference\(/
  );

  // Account-deletion reference tip only — leave payload.error / export /
  // Gmail / Square haystacks alone.
  const deleteAccountStart = repositorySource.indexOf("async deleteAccount(restaurantId)");
  const deleteAccountEnd = repositorySource.indexOf(
    "async exportRestaurantData(restaurantId)"
  );
  assert.ok(deleteAccountStart > 0 && deleteAccountEnd > deleteAccountStart);
  const deleteAccountBody = repositorySource.slice(deleteAccountStart, deleteAccountEnd);
  assert.match(
    deleteAccountBody,
    /resolveAccountDeletionReference\(/
  );
  assert.doesNotMatch(
    deleteAccountBody,
    /payload\.deletionReference\.trim\(\)\.slice\(0, 80\)/
  );
  // Open #931 owns payload.error — this tip leaves the inventing Unicode trim.
  assert.match(
    deleteAccountBody,
    /payload\.error\.trim\(\)\.slice\(0, 320\)/
  );
  assert.doesNotMatch(
    deleteAccountBody,
    /resolveAccountDeletionErrorMessage\(/
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
  assert.doesNotMatch(exportBody, /resolveAccountDeletionReference/);
  assert.doesNotMatch(exportBody, /accountDeletionReferenceIdentity/);

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
  assert.doesNotMatch(identityCode, /accountDeletionErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /gmailIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /recalculationDescribeErrorIdentity/);
  assert.doesNotMatch(identityCode, /recalculationScheduleFailureReasonIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(
    repositorySource,
    /from "\.\/accountDeletionErrorMessageIdentity"/
  );
});

test("ASCII whitespace still trims clean for account-deletion deletionReference", () => {
  assert.equal(asciiTrimAccountDeletionReference(`  ${cleanReference}  `), cleanReference);
  assert.equal(asciiTrimAccountDeletionReference(`\t${cleanReference}\n`), cleanReference);
  assert.equal(canonicalizeAccountDeletionReference(`  ${cleanReference}  `), cleanReference);
  assert.equal(normalizeAccountDeletionReference(`\t${cleanReference}\n`), cleanReference);
  assert.equal(resolveAccountDeletionReference(`  ${cleanReference}  `), cleanReference);

  // Soft empty keeps prior empty-string / no-Reference contract.
  assert.equal(canonicalizeAccountDeletionReference(""), null);
  assert.equal(canonicalizeAccountDeletionReference("   "), null);
  assert.equal(canonicalizeAccountDeletionReference("\t\n"), null);
  assert.equal(canonicalizeAccountDeletionReference(em), null);
  assert.equal(canonicalizeAccountDeletionReference(nbsp), null);
  assert.equal(normalizeAccountDeletionReference(""), null);
  assert.equal(normalizeAccountDeletionReference(null), null);
  assert.equal(normalizeAccountDeletionReference(undefined), null);
  assert.equal(normalizeAccountDeletionReference(em), null);
  assert.equal(normalizeAccountDeletionReference(nbsp), null);
  assert.equal(resolveAccountDeletionReference(""), "");
  assert.equal(resolveAccountDeletionReference("   "), "");
  assert.equal(resolveAccountDeletionReference(em), "");
  assert.equal(resolveAccountDeletionReference(null), "");
  assert.equal(resolveAccountDeletionReference(undefined), "");
});

test("Unicode-padded deletionReference fails closed instead of inventing a clean support reference", () => {
  // Prior Unicode trim invented a clean durable support reference.
  assert.equal(`${em}${cleanReference}${em}`.trim(), cleanReference);
  assert.equal(canonicalizeAccountDeletionReference(`${em}${cleanReference}${em}`), null);
  assert.equal(normalizeAccountDeletionReference(`${em}${cleanReference}${em}`), null);
  assert.equal(resolveAccountDeletionReference(`${em}${cleanReference}${em}`), "");

  assert.equal(`${nbsp}${cleanReference}${nbsp}`.trim(), cleanReference);
  assert.equal(canonicalizeAccountDeletionReference(`${nbsp}${cleanReference}${nbsp}`), null);
  assert.equal(normalizeAccountDeletionReference(`${nbsp}${cleanReference}${nbsp}`), null);
  assert.equal(resolveAccountDeletionReference(`${nbsp}${cleanReference}${nbsp}`), "");

  assert.equal(canonicalizeAccountDeletionReference(`${cleanReference}\u0000`), null);
  assert.equal(normalizeAccountDeletionReference(`${cleanReference}\u0007`), null);
  assert.equal(resolveAccountDeletionReference(`${cleanReference}\u0000`), "");

  // Soft empty Unicode-only space invented the no-Reference branch via prior trim.
  assert.equal(em.trim(), "");
  assert.equal(resolveAccountDeletionReference(em), "");

  // Operator-facing Error composition preserves falsy omit of Reference.
  const message = "Your restaurant access is unchanged — try again.";
  const invented = resolveAccountDeletionReference(`${em}${cleanReference}${em}`);
  assert.equal(invented, "");
  assert.equal(invented ? `${message} Reference: ${invented}` : message, message);

  const clean = resolveAccountDeletionReference(`  ${cleanReference}  `);
  assert.equal(clean, cleanReference);
  assert.equal(
    clean ? `${message} Reference: ${clean}` : message,
    `${message} Reference: ${cleanReference}`
  );
});

test("max length preserves prior account-deletion deletionReference truncate contract", () => {
  assert.equal(ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS, 80);

  const longClean = `${"a".repeat(ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS)}EXTRA`;
  assert.equal(
    canonicalizeAccountDeletionReference(longClean),
    "a".repeat(ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS)
  );
  assert.equal(
    normalizeAccountDeletionReference(longClean)?.length,
    ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS
  );
  assert.equal(
    resolveAccountDeletionReference(longClean).length,
    ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS
  );

  // Unicode-padded over-long must not invent a truncated clean reference.
  const longEm = `${em}${"b".repeat(ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS + 20)}${em}`;
  assert.equal(longEm.trim().slice(0, 80), "b".repeat(80));
  assert.equal(canonicalizeAccountDeletionReference(longEm), null);
  assert.equal(normalizeAccountDeletionReference(longEm), null);
  assert.equal(resolveAccountDeletionReference(longEm), "");
});

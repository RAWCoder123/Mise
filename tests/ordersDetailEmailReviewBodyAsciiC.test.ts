import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiPrepOrdersDetailEmailReviewBody,
  canonicalizeOrdersDetailEmailReviewBody,
  normalizeOrdersDetailEmailReviewBody
} from "../services/domain/ordersDetailEmailReviewBodyIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersDetailEmailReviewBodyIdentity.ts", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);

const body = "Please deliver before 10am";
const accentedBody = "Entregar antes de las 10";
const multilineBody = "Line one.\nSide entrance.\tCase count attached.";
const FALLBACK = "Not configured";

test("MISE-005VF pins Orders detail email-review body to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005VF/);
  assert.match(ordersUiSource, /MISE-005VF/);

  assert.ok(identitySource.includes("C_LEADING_WHITESPACE = /^[ \\t\\n\\v\\f\\r]+/;"));
  assert.ok(identitySource.includes("C_TRAILING_WHITESPACE = /[ \\t\\n\\v\\f\\r]+$/;"));
  assert.ok(identitySource.includes('.replace(/\\u00a0/g, " ")'));
  assert.ok(
    identitySource.includes(
      "UNSAFE_MULTILINE_CONTROL = /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/;"
    )
  );

  const prepBody = identitySource.slice(
    identitySource.indexOf("export function asciiPrepOrdersDetailEmailReviewBody("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(prepBody, /\.trim\(\)/);
  assert.doesNotMatch(prepBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\\s/);

  assert.match(
    ordersUiSource,
    /normalizeOrdersDetailEmailReviewBody\(visibleEmailPayload\?\.body\)\s*\|\|\s*t\("orders\.detail\.review\.unavailable"\)/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /visibleEmailPayload\?\.body \|\| t\("orders\.detail\.review\.unavailable"\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailNoteNoneIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*deliveryEvidenceDate/);
  assert.doesNotMatch(identitySource, /from ["'].*deliveryHistoryNoteIdentity/);
  assert.doesNotMatch(
    ordersUiSource,
    /normalizeOrdersDetailEmailReviewBody\(visibleOrder\.operator_note/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /normalizeOrdersDetailNoteNone\(visibleEmailPayload/
  );
});

test("ASCII C multiline prep keeps ordinary email-review bodies stable", () => {
  assert.equal(asciiPrepOrdersDetailEmailReviewBody(`  ${body}  `), body);
  assert.equal(asciiPrepOrdersDetailEmailReviewBody(`\t${body}\n`), body);
  assert.equal(canonicalizeOrdersDetailEmailReviewBody(`  ${body}  `), body);
  assert.equal(normalizeOrdersDetailEmailReviewBody(`  ${body}  `), body);

  assert.equal(asciiPrepOrdersDetailEmailReviewBody(accentedBody), accentedBody);
  assert.equal(normalizeOrdersDetailEmailReviewBody(accentedBody), accentedBody);

  // Internal LF/TAB/CR are preserved (order-message-style multiline).
  assert.equal(asciiPrepOrdersDetailEmailReviewBody(multilineBody), multilineBody);
  assert.equal(normalizeOrdersDetailEmailReviewBody(multilineBody), multilineBody);
});

test("Unicode-only space bypasses review.unavailable until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";

  assert.equal(Boolean(emOnly), true);
  assert.equal(emOnly || FALLBACK, emOnly);
  assert.notEqual(emOnly || FALLBACK, FALLBACK);

  assert.equal(normalizeOrdersDetailEmailReviewBody(emOnly), null);
  assert.equal(normalizeOrdersDetailEmailReviewBody(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersDetailEmailReviewBody(nbspOnly), null);
  assert.equal(normalizeOrdersDetailEmailReviewBody(paddedSpaces), null);
  assert.equal(normalizeOrdersDetailEmailReviewBody(null), null);
  assert.equal(normalizeOrdersDetailEmailReviewBody(undefined), null);
  assert.equal(normalizeOrdersDetailEmailReviewBody(""), null);
});

test("NBSP folds and em-space padding cannot invent clean email-review body display", () => {
  const nbspBody = `\u00a0${body}\u00a0`;
  const emBody = `\u2003${body}\u2003`;
  const internalEm = `Please\u2003deliver before 10am`;
  const internalNbsp = `Please\u00a0deliver before 10am`;
  const emMultiline = `\u2003${multilineBody}\u2003`;

  // Pasted NBSP folds like sibling multiline free-text prep.
  assert.equal(nbspBody.trim(), body);
  assert.equal(asciiPrepOrdersDetailEmailReviewBody(nbspBody), body);
  assert.equal(normalizeOrdersDetailEmailReviewBody(nbspBody), body);

  // Unicode trim invents a clean body; ASCII C soft-null refuses to invent.
  assert.equal(emBody.trim(), body);
  assert.notEqual(asciiPrepOrdersDetailEmailReviewBody(emBody), body);
  assert.equal(normalizeOrdersDetailEmailReviewBody(emBody), null);
  assert.equal(normalizeOrdersDetailEmailReviewBody(emBody) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersDetailEmailReviewBody(emMultiline), null);

  // Internal em-space / folded NBSP stay (no inventing strip of interior).
  assert.equal(normalizeOrdersDetailEmailReviewBody(internalEm), internalEm);
  assert.equal(
    normalizeOrdersDetailEmailReviewBody(internalNbsp),
    "Please deliver before 10am"
  );
});

test("Unsafe multiline controls soft-null for email-review body display", () => {
  assert.equal(normalizeOrdersDetailEmailReviewBody(`${body}\u0000`), null);
  assert.equal(normalizeOrdersDetailEmailReviewBody(`${body}\u0007`), null);
  assert.equal(normalizeOrdersDetailEmailReviewBody(`${body}\u007f`), null);
  // LF/TAB/CR remain allowed.
  assert.equal(
    normalizeOrdersDetailEmailReviewBody("Line one\nLine two\tTabbed\r"),
    "Line one\nLine two\tTabbed"
  );
});

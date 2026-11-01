import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersDetailEmailReviewHeader,
  canonicalizeOrdersDetailEmailReviewHeader,
  normalizeOrdersDetailEmailReviewHeader
} from "../services/domain/ordersDetailEmailReviewHeaderIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersDetailEmailReviewHeaderIdentity.ts", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);

const fromMailbox = "orders@harbor.kitchen";
const toMailbox = "desk@acmefoods.com";
const subject = "Harbor Kitchen order for Acme Foods";
const accentedSubject = "Pedido de Café Luna para Acme";
const FALLBACK = "Not configured";

test("MISE-005VG pins Orders detail email-review from/to/subject to ASCII C", () => {
  assert.match(identitySource, /MISE-005VG/);
  assert.match(ordersUiSource, /MISE-005VG/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersDetailEmailReviewHeader\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Mailbox/header tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimOrdersDetailEmailReviewHeader("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    ordersUiSource,
    /normalizeOrdersDetailEmailReviewHeader\(visibleEmailPayload\?\.from\)\s*\|\|\s*t\("orders\.detail\.review\.unavailable"\)/
  );
  assert.match(
    ordersUiSource,
    /normalizeOrdersDetailEmailReviewHeader\(visibleEmailPayload\?\.to\)\s*\|\|\s*t\("orders\.detail\.review\.unavailable"\)/
  );
  assert.match(
    ordersUiSource,
    /normalizeOrdersDetailEmailReviewHeader\(visibleEmailPayload\?\.subject\)\s*\|\|\s*t\("orders\.detail\.review\.unavailable"\)/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /visibleEmailPayload\?\.from \?\? t\("orders\.detail\.review\.unavailable"\)/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /visibleEmailPayload\?\.to \?\? t\("orders\.detail\.review\.unavailable"\)/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /visibleEmailPayload\?\.subject \?\? t\("orders\.detail\.review\.unavailable"\)/
  );

  // Leave sibling tips / modules alone.
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewBodyIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailNoteNoneIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*supplierSendSubjectIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSettingsAccountEmailLabelIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*outreachWebhookFromEmailIdentity/);
  assert.doesNotMatch(
    ordersUiSource,
    /normalizeOrdersDetailEmailReviewHeader\(visibleEmailPayload\?\.body/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /normalizeOrdersDetailEmailReviewHeader\(visibleOrder\.operator_note/
  );
  // Body row remains on its own tip (#1014) — still raw on current main.
  assert.match(
    ordersUiSource,
    /visibleEmailPayload\?\.body \|\| t\("orders\.detail\.review\.unavailable"\)/
  );
});

test("ASCII C header prep keeps ordinary From/To/Subject display stable", () => {
  assert.equal(asciiTrimOrdersDetailEmailReviewHeader(`  ${fromMailbox}  `), fromMailbox);
  assert.equal(asciiTrimOrdersDetailEmailReviewHeader(`\t${toMailbox}\n`), toMailbox);
  assert.equal(canonicalizeOrdersDetailEmailReviewHeader(`  ${subject}  `), subject);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`  ${fromMailbox}  `), fromMailbox);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`  ${toMailbox}  `), toMailbox);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`  ${subject}  `), subject);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(accentedSubject), accentedSubject);
});

test("Unicode-only space and empty string bypass review.unavailable via ?? until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";

  // Prior `??` bypass proofs (weaker than `||`, but still skips unavailable).
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeOrdersDetailEmailReviewHeader(emOnly), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(nbspOnly), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(paddedSpaces), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(empty), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(null), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(undefined), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(null) || FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean email-review header display", () => {
  const emFrom = `\u2003${fromMailbox}\u2003`;
  const nbspTo = `\u00a0${toMailbox}\u00a0`;
  const emSubject = `\u2003${subject}\u2003`;
  const nbspSubject = `\u00a0${subject}\u00a0`;

  // Inventing proof on Unicode trim.
  assert.equal(emFrom.trim(), fromMailbox);
  assert.equal(nbspTo.trim(), toMailbox);
  assert.equal(emSubject.trim(), subject);
  assert.equal(nbspSubject.trim(), subject);

  // Mailbox/header tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimOrdersDetailEmailReviewHeader(emFrom), emFrom);
  assert.equal(asciiTrimOrdersDetailEmailReviewHeader(nbspTo), nbspTo);
  assert.equal(asciiTrimOrdersDetailEmailReviewHeader(emSubject), emSubject);
  assert.equal(asciiTrimOrdersDetailEmailReviewHeader(nbspSubject), nbspSubject);

  // Soft-null refuses to invent clean From / To / Subject display.
  assert.equal(canonicalizeOrdersDetailEmailReviewHeader(emFrom), null);
  assert.equal(canonicalizeOrdersDetailEmailReviewHeader(nbspTo), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(emFrom), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(nbspTo), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(emSubject), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(nbspSubject), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(emFrom) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(emSubject) || FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for email-review header display", () => {
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`${fromMailbox}\u0000`), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`\u0007${toMailbox}`), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`${subject}\u007f`), null);
  // Single-line headers reject embedded LF/CR (unlike multiline body tip #1014).
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`${subject}\nnext`), null);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`${fromMailbox}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeOrdersDetailEmailReviewHeader(`${fromMailbox}\t`), fromMailbox);
  assert.equal(normalizeOrdersDetailEmailReviewHeader("orders@harbor.kitchen"), fromMailbox);
  assert.equal(normalizeOrdersDetailEmailReviewHeader(subject), subject);
});

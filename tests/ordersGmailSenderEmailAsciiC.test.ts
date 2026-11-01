import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersGmailSenderEmail,
  canonicalizeOrdersGmailSenderEmail,
  normalizeOrdersGmailSenderEmail
} from "../services/domain/presentationOrdersGmailSenderIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationOrdersGmailSenderIdentity.ts", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(
  new URL("../app/(tabs)/orders.tsx", import.meta.url),
  "utf8"
);

const senderMailbox = "orders@harbor.kitchen";
const accentedMailbox = "órdenes@café.example";
const FALLBACK = "the connected restaurant account";

test("MISE-005VL pins Orders Gmail connected-body sender_email display to ASCII C", () => {
  assert.match(identitySource, /MISE-005VL/);
  assert.match(ordersUiSource, /MISE-005VL/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersGmailSenderEmail\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Mailbox tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimOrdersGmailSenderEmail("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    ordersUiSource,
    /normalizeOrdersGmailSenderEmail\(visibleEmailConnection\?\.sender_email\)\s*\|\|\s*t\("orders\.gmail\.connected\.fallbackSender"\)/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /visibleEmailConnection\?\.sender_email \?\? t\("orders\.gmail\.connected\.fallbackSender"\)/
  );

  // Leave sibling tips / modules alone.
  assert.doesNotMatch(identitySource, /from ["'].*presentationGmailSenderEmailIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewHeaderIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSettingsAccountEmailLabelIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*outreachWebhookFromEmailIdentity/);
  assert.doesNotMatch(
    ordersUiSource,
    /from ["'].*presentationGmailSenderEmailIdentity/
  );
  assert.doesNotMatch(ordersUiSource, /settings\.gmail\.status\.notConnected/);
});

test("ASCII C sender prep keeps ordinary Orders Gmail connected-body sender_email display stable", () => {
  assert.equal(asciiTrimOrdersGmailSenderEmail(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(asciiTrimOrdersGmailSenderEmail(`\t${senderMailbox}\n`), senderMailbox);
  assert.equal(canonicalizeOrdersGmailSenderEmail(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(normalizeOrdersGmailSenderEmail(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(normalizeOrdersGmailSenderEmail(accentedMailbox), accentedMailbox);
});

test("Unicode-only space and empty string bypass fallbackSender via ?? until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";

  // Prior `??` bypass proofs (weaker than `||`, but still skips fallbackSender).
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeOrdersGmailSenderEmail(emOnly), null);
  assert.equal(normalizeOrdersGmailSenderEmail(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersGmailSenderEmail(nbspOnly), null);
  assert.equal(normalizeOrdersGmailSenderEmail(paddedSpaces), null);
  assert.equal(normalizeOrdersGmailSenderEmail(empty), null);
  assert.equal(normalizeOrdersGmailSenderEmail(null), null);
  assert.equal(normalizeOrdersGmailSenderEmail(undefined), null);
  assert.equal(normalizeOrdersGmailSenderEmail(null) || FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean Orders Gmail connected-body sender_email display", () => {
  const emSender = `\u2003${senderMailbox}\u2003`;
  const nbspSender = `\u00a0${senderMailbox}\u00a0`;

  // Inventing proof on Unicode trim.
  assert.equal(emSender.trim(), senderMailbox);
  assert.equal(nbspSender.trim(), senderMailbox);

  // Mailbox tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimOrdersGmailSenderEmail(emSender), emSender);
  assert.equal(asciiTrimOrdersGmailSenderEmail(nbspSender), nbspSender);

  // Soft-null refuses to invent clean sender mailbox display.
  assert.equal(canonicalizeOrdersGmailSenderEmail(emSender), null);
  assert.equal(canonicalizeOrdersGmailSenderEmail(nbspSender), null);
  assert.equal(normalizeOrdersGmailSenderEmail(emSender), null);
  assert.equal(normalizeOrdersGmailSenderEmail(nbspSender), null);
  assert.equal(normalizeOrdersGmailSenderEmail(emSender) || FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for Orders Gmail connected-body sender_email display", () => {
  assert.equal(normalizeOrdersGmailSenderEmail(`${senderMailbox}\u0000`), null);
  assert.equal(normalizeOrdersGmailSenderEmail(`\u0007${senderMailbox}`), null);
  assert.equal(normalizeOrdersGmailSenderEmail(`${senderMailbox}\u007f`), null);
  // Single-line mailboxes reject embedded LF/CR (unlike multiline body tips).
  assert.equal(normalizeOrdersGmailSenderEmail(`${senderMailbox}\nnext`), null);
  assert.equal(normalizeOrdersGmailSenderEmail(`${senderMailbox}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeOrdersGmailSenderEmail(`${senderMailbox}\t`), senderMailbox);
  assert.equal(normalizeOrdersGmailSenderEmail("orders@harbor.kitchen"), senderMailbox);
});

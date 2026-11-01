import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimGmailSenderEmail,
  canonicalizeGmailSenderEmail,
  normalizeGmailSenderEmail
} from "../services/domain/presentationGmailSenderEmailIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationGmailSenderEmailIdentity.ts", import.meta.url),
  "utf8"
);
const gmailUiSource = readFileSync(
  new URL("../app/settings/gmail.tsx", import.meta.url),
  "utf8"
);

const senderMailbox = "orders@harbor.kitchen";
const accentedMailbox = "órdenes@café.example";
const FALLBACK = "Not connected";

test("MISE-005VK pins Settings/Gmail sender_email display to ASCII C", () => {
  assert.match(identitySource, /MISE-005VK/);
  assert.match(gmailUiSource, /MISE-005VK/);

  assert.match(
    identitySource,
    /export function asciiTrimGmailSenderEmail\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Mailbox tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimGmailSenderEmail("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    gmailUiSource,
    /normalizeGmailSenderEmail\(visibleConnection\?\.sender_email\)\s*\|\|\s*t\("settings\.gmail\.status\.notConnected"\)/
  );
  assert.doesNotMatch(
    gmailUiSource,
    /visibleConnection\?\.sender_email \?\? t\("settings\.gmail\.status\.notConnected"\)/
  );

  // Leave sibling tips / modules alone.
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewHeaderIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSettingsAccountEmailLabelIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*outreachWebhookFromEmailIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationOrdersGmailSenderIdentity/);
  assert.doesNotMatch(
    gmailUiSource,
    /from ["'].*presentationOrdersGmailSenderIdentity/
  );
  assert.doesNotMatch(gmailUiSource, /orders\.gmail\.connected\.fallbackSender/);
});

test("ASCII C sender prep keeps ordinary Settings/Gmail sender_email display stable", () => {
  assert.equal(asciiTrimGmailSenderEmail(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(asciiTrimGmailSenderEmail(`\t${senderMailbox}\n`), senderMailbox);
  assert.equal(canonicalizeGmailSenderEmail(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(normalizeGmailSenderEmail(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(normalizeGmailSenderEmail(accentedMailbox), accentedMailbox);
});

test("Unicode-only space and empty string bypass notConnected via ?? until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";

  // Prior `??` bypass proofs (weaker than `||`, but still skips notConnected).
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeGmailSenderEmail(emOnly), null);
  assert.equal(normalizeGmailSenderEmail(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeGmailSenderEmail(nbspOnly), null);
  assert.equal(normalizeGmailSenderEmail(paddedSpaces), null);
  assert.equal(normalizeGmailSenderEmail(empty), null);
  assert.equal(normalizeGmailSenderEmail(null), null);
  assert.equal(normalizeGmailSenderEmail(undefined), null);
  assert.equal(normalizeGmailSenderEmail(null) || FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean Settings/Gmail sender_email display", () => {
  const emSender = `\u2003${senderMailbox}\u2003`;
  const nbspSender = `\u00a0${senderMailbox}\u00a0`;

  // Inventing proof on Unicode trim.
  assert.equal(emSender.trim(), senderMailbox);
  assert.equal(nbspSender.trim(), senderMailbox);

  // Mailbox tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimGmailSenderEmail(emSender), emSender);
  assert.equal(asciiTrimGmailSenderEmail(nbspSender), nbspSender);

  // Soft-null refuses to invent clean sender mailbox display.
  assert.equal(canonicalizeGmailSenderEmail(emSender), null);
  assert.equal(canonicalizeGmailSenderEmail(nbspSender), null);
  assert.equal(normalizeGmailSenderEmail(emSender), null);
  assert.equal(normalizeGmailSenderEmail(nbspSender), null);
  assert.equal(normalizeGmailSenderEmail(emSender) || FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for Settings/Gmail sender_email display", () => {
  assert.equal(normalizeGmailSenderEmail(`${senderMailbox}\u0000`), null);
  assert.equal(normalizeGmailSenderEmail(`\u0007${senderMailbox}`), null);
  assert.equal(normalizeGmailSenderEmail(`${senderMailbox}\u007f`), null);
  // Single-line mailboxes reject embedded LF/CR (unlike multiline body tips).
  assert.equal(normalizeGmailSenderEmail(`${senderMailbox}\nnext`), null);
  assert.equal(normalizeGmailSenderEmail(`${senderMailbox}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeGmailSenderEmail(`${senderMailbox}\t`), senderMailbox);
  assert.equal(normalizeGmailSenderEmail("orders@harbor.kitchen"), senderMailbox);
});

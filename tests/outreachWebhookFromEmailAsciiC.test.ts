import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeOutreachEmail } from "../services/domain/outreach";
import {
  asciiTrimOutreachWebhookFromMailbox,
  canonicalizeOutreachWebhookFromMailbox,
  normalizeOutreachWebhookFromMailbox
} from "../services/domain/outreachWebhookFromEmailIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/outreachWebhookFromEmailIdentity.ts", import.meta.url),
  "utf8"
);
const webhookSource = readFileSync(
  new URL("../supabase/functions/outreach-webhook/index.ts", import.meta.url),
  "utf8"
);
const outreachSource = readFileSync(
  new URL("../services/domain/outreach.ts", import.meta.url),
  "utf8"
);

const mailbox = "chef@joescafe.com";
const accentedMailbox = "café@joescafe.com";
const em = "\u2003";
const nbsp = "\u00a0";

/** Mirror live extractEmail wiring for behavioral inventing proofs. */
function extractEmail(value: string) {
  const bracketed = value.match(/<([^<>\s@]+@[^<>\s@]+)>/);
  const candidate = bracketed?.[1] ?? normalizeOutreachWebhookFromMailbox(value);
  if (!candidate) return null;
  const normalized = normalizeOutreachEmail(candidate);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

test("MISE-005TU pins outreach-webhook extractEmail From mailbox to ASCII C", () => {
  assert.match(identitySource, /MISE-005TU/);
  assert.match(webhookSource, /MISE-005TU/);

  assert.match(
    identitySource,
    /export function asciiTrimOutreachWebhookFromMailbox\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    webhookSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/outreachWebhookFromEmailIdentity\.ts"/
  );
  assert.match(webhookSource, /normalizeOutreachWebhookFromMailbox\(/);

  const extractStart = webhookSource.indexOf("function extractEmail(");
  const extractEnd = webhookSource.indexOf("function validIsoDate(");
  assert.ok(extractStart > 0 && extractEnd > extractStart);
  const extractBody = webhookSource.slice(extractStart, extractEnd);
  assert.match(extractBody, /normalizeOutreachWebhookFromMailbox\(/);
  assert.doesNotMatch(extractBody, /bracketed\?\.\[1\]\s*\?\?\s*value\.trim\(\)/);
  assert.doesNotMatch(extractBody, /value\.trim\(\)/);

  // Leave durable normalizeOutreachEmail on its existing contract (#420).
  assert.match(extractBody, /normalizeOutreachEmail\(/);
  assert.match(outreachSource, /export function normalizeOutreachEmail\(value: string\)/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /normalizeOutreachEmail/);
  assert.doesNotMatch(identityCode, /outreachLeadTextIdentity/);
  assert.doesNotMatch(identityCode, /supplierSettingsEmailIdentity/);
  assert.doesNotMatch(identityCode, /supplierRecipientEmail/);
  assert.doesNotMatch(identityCode, /firstName/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary outreach-webhook From mailboxes stable", () => {
  assert.equal(asciiTrimOutreachWebhookFromMailbox(`  ${mailbox}  `), mailbox);
  assert.equal(asciiTrimOutreachWebhookFromMailbox(`\t${mailbox}\n`), mailbox);
  assert.equal(canonicalizeOutreachWebhookFromMailbox(`  ${mailbox}  `), mailbox);
  assert.equal(normalizeOutreachWebhookFromMailbox(`  ${mailbox}  `), mailbox);

  assert.equal(normalizeOutreachWebhookFromMailbox(accentedMailbox), accentedMailbox);
  assert.equal(canonicalizeOutreachWebhookFromMailbox(accentedMailbox), accentedMailbox);

  assert.equal(extractEmail(`  ${mailbox}  `), mailbox);
  assert.equal(extractEmail(`Chef Joe <${mailbox}>`), mailbox);
  assert.equal(extractEmail(accentedMailbox), accentedMailbox.toLowerCase());
});

test("Unicode em-space / NBSP padding cannot invent clean outreach-webhook From mailboxes", () => {
  const padded = `${em}${mailbox}${em}`;
  const nbspPadded = `${nbsp}${mailbox}${nbsp}`;
  const internalEm = `chef@${em}joescafe.com`;
  const internalNbsp = `chef@${nbsp}joescafe.com`;

  // Inventing proof: Unicode trim would invent the clean durable mailbox.
  assert.equal(padded.trim(), mailbox);
  assert.equal(nbspPadded.trim(), mailbox);
  assert.equal(normalizeOutreachEmail(padded), mailbox);
  assert.equal(normalizeOutreachEmail(nbspPadded), mailbox);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimOutreachWebhookFromMailbox(padded), padded);
  assert.equal(canonicalizeOutreachWebhookFromMailbox(padded), null);
  assert.equal(canonicalizeOutreachWebhookFromMailbox(nbspPadded), null);
  assert.equal(normalizeOutreachWebhookFromMailbox(padded), null);
  assert.equal(normalizeOutreachWebhookFromMailbox(nbspPadded), null);

  // Soft empty still fails closed without inventing a mailbox from padding alone.
  assert.equal(normalizeOutreachWebhookFromMailbox(`${em}${em}`), null);
  assert.equal(normalizeOutreachWebhookFromMailbox(`${nbsp}`), null);
  assert.equal(normalizeOutreachWebhookFromMailbox("   "), null);

  // Live extractEmail must not invent a clean mailbox from padded From values.
  assert.equal(extractEmail(padded), null);
  assert.equal(extractEmail(nbspPadded), null);
  assert.equal(extractEmail(`${em}${em}`), null);

  // Internal Unicode space is not end-padding inventing; keep fail-closed via
  // mailbox shape after normalizeOutreachEmail rather than inventing a clean id.
  assert.equal(normalizeOutreachWebhookFromMailbox(internalEm), internalEm);
  assert.equal(extractEmail(internalEm), null);
  assert.equal(normalizeOutreachWebhookFromMailbox(internalNbsp), internalNbsp);
  assert.equal(extractEmail(internalNbsp), null);

  // Angle-bracket captures remain on the prior path (no Unicode trim inventing).
  assert.equal(extractEmail(`Chef <${mailbox}>`), mailbox);
});

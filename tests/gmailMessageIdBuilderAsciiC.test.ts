import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiCLowerGmailMessageIdToken,
  gmailMessageId,
} from "../supabase/functions/_shared/gmail.ts";

const gmailShared = readFileSync(
  new URL("../supabase/functions/_shared/gmail.ts", import.meta.url),
  "utf8",
);

const KELVIN = "\u212A";
const ORDER_ID = "abcdef01-2345-4789-ab01-cdef23456789";

test("MISE-005KJ pins gmailMessageId builder fold and shape to ASCII C", () => {
  assert.match(gmailShared, /MISE-005KJ/);
  assert.match(
    gmailShared,
    /export function asciiCLowerGmailMessageIdToken\(value: string\)/,
  );

  const helperBody = gmailShared.slice(
    gmailShared.indexOf("export function asciiCLowerGmailMessageIdToken("),
    gmailShared.indexOf("const GMAIL_MESSAGE_ID_ORDER_UUID"),
  );
  assert.match(
    helperBody,
    /return value\.replace\(\/\[A-Z\]\/g/,
  );
  assert.doesNotMatch(helperBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(helperBody, /\.toLocaleLowerCase\(/);

  const builderBody = gmailShared.slice(
    gmailShared.indexOf("export function gmailMessageId("),
    gmailShared.indexOf("function parseTokenSet("),
  );
  assert.match(builderBody, /asciiCLowerGmailMessageIdToken\(orderId\)/);
  assert.match(builderBody, /asciiCLowerGmailMessageIdToken\(domain\)/);
  assert.doesNotMatch(builderBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(builderBody, /\$\/iu/);
  assert.match(builderBody, /GMAIL_MESSAGE_ID_ORDER_UUID\.test\(/);
  assert.match(builderBody, /GMAIL_MESSAGE_ID_DOMAIN\.test\(/);

  // Do not retarget sanitizeHeader (#693), Message-ID shape (#694), or
  // normalizeEmail (#423) from this tip — those remain separate open stacks.
  assert.match(gmailShared, /function sanitizeHeader\(/);
  assert.match(gmailShared, /function normalizeEmail\(/);
});

test("asciiCLowerGmailMessageIdToken folds ASCII A-Z only and leaves Kelvin intact", () => {
  assert.equal(asciiCLowerGmailMessageIdToken("MAIL.MISE.APP"), "mail.mise.app");
  assert.equal(
    asciiCLowerGmailMessageIdToken(`mail.mise.ap${KELVIN}`),
    `mail.mise.ap${KELVIN}`,
  );
  assert.notEqual(
    asciiCLowerGmailMessageIdToken(`mail.mise.ap${KELVIN}`),
    "mail.mise.apk",
  );
  assert.equal(
    `mail.mise.ap${KELVIN}`.toLowerCase(),
    "mail.mise.apk",
  );
});

test("gmailMessageId rejects Kelvin domain inventing that Unicode /iu + toLowerCase would accept", () => {
  assert.equal(
    gmailMessageId(ORDER_ID),
    `<mise-${ORDER_ID}@mail.mise.app>`,
  );
  assert.equal(
    gmailMessageId(ORDER_ID.toUpperCase(), "MAIL.MISE.APP"),
    `<mise-${ORDER_ID}@mail.mise.app>`,
  );

  const kelvinDomain = `mail.mise.ap${KELVIN}`;
  assert.equal(
    /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/iu.test(kelvinDomain),
    true,
    "Unicode /iu still invents a Kelvin domain match (regression detector)",
  );
  assert.throws(
    () => gmailMessageId(ORDER_ID, kelvinDomain),
    /Message id domain is invalid/,
  );

  const kelvinOrderId = `${ORDER_ID.slice(0, -1)}${KELVIN}`;
  assert.throws(
    () => gmailMessageId(kelvinOrderId),
    /Order id must be a UUID/,
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildGmailRawMessage,
  gmailMessageId,
  sanitizeGmailHeader,
  trimAsciiCHeaderWhitespace,
} from "../supabase/functions/_shared/gmail.ts";

const gmailShared = readFileSync(
  new URL("../supabase/functions/_shared/gmail.ts", import.meta.url),
  "utf8",
);

test("MISE-005JX pins Gmail sanitizeHeader trim to ASCII C", () => {
  assert.match(gmailShared, /MISE-005JX/);
  assert.match(
    gmailShared,
    /export function trimAsciiCHeaderWhitespace\(value: string\)/,
  );
  assert.match(
    gmailShared,
    /export function sanitizeGmailHeader\(value: string, maximumLength: number\)/,
  );
  assert.match(
    gmailShared,
    /replace\(\/\^\[ \\t\\n\\v\\f\\r\]\+\|\[ \\t\\n\\v\\f\\r\]\+\$\/g, ""\)/,
  );

  const trimBody = gmailShared.slice(
    gmailShared.indexOf("export function trimAsciiCHeaderWhitespace("),
    gmailShared.indexOf("export function sanitizeGmailHeader("),
  );
  assert.doesNotMatch(trimBody, /\.trim\(\)/);
  assert.doesNotMatch(trimBody, /\\s/);
  assert.doesNotMatch(trimBody, /\\u00a0/);

  const sanitizeBody = gmailShared.slice(
    gmailShared.indexOf("export function sanitizeGmailHeader("),
    gmailShared.indexOf("function sanitizeHeader("),
  );
  assert.doesNotMatch(sanitizeBody, /\.trim\(\)/);
  assert.match(sanitizeBody, /trimAsciiCHeaderWhitespace\(/);
  assert.match(sanitizeBody, /\[\\r\\n\]\+\/gu/);

  // Private wrapper must only delegate — no second Unicode trim.
  const privateBody = gmailShared.slice(
    gmailShared.indexOf("function sanitizeHeader("),
    gmailShared.indexOf("function requireMessageId("),
  );
  assert.match(privateBody, /return sanitizeGmailHeader\(value, maximumLength\);/);
  assert.doesNotMatch(privateBody, /\.trim\(\)/);

  // Do not retarget normalizeEmail here — that belongs to MISE-005O (#423).
  const normalizeBody = gmailShared.slice(
    gmailShared.indexOf("function normalizeEmail("),
    gmailShared.indexOf("export function trimAsciiCHeaderWhitespace("),
  );
  assert.match(normalizeBody, /MISE-005O|#423/);
  assert.doesNotMatch(normalizeBody, /normalizeGmailSenderEmail/);
});

test("trimAsciiCHeaderWhitespace drops only C-locale spaces and preserves NBSP/em-space", () => {
  assert.equal(
    trimAsciiCHeaderWhitespace(" \t\n\v\f\rProduce order\t\r\n "),
    "Produce order",
  );
  assert.equal(
    trimAsciiCHeaderWhitespace("\u00a0Produce order\u00a0"),
    "\u00a0Produce order\u00a0",
  );
  assert.equal(
    trimAsciiCHeaderWhitespace("\u2003Produce order\u2003"),
    "\u2003Produce order\u2003",
  );
  assert.notEqual(
    trimAsciiCHeaderWhitespace("Produce order"),
    trimAsciiCHeaderWhitespace("\u2003Produce order\u2003"),
  );
});

test("sanitizeGmailHeader collapses CR/LF then ASCII C trims without inventing Unicode equality", () => {
  assert.equal(
    sanitizeGmailHeader("  Produce order\r\nBcc: attacker@example.com  ", 500),
    "Produce order Bcc: attacker@example.com",
  );
  assert.equal(
    sanitizeGmailHeader("\u00a0Café order\u00a0", 500),
    "\u00a0Café order\u00a0",
  );
  assert.equal(
    sanitizeGmailHeader("\u2003Em space subject\u2003", 500),
    "\u2003Em space subject\u2003",
  );
  assert.throws(
    () => sanitizeGmailHeader(" \t\r\n ", 500),
    /Email header is invalid/,
  );
  assert.throws(
    () => sanitizeGmailHeader("", 500),
    /header is outside the supported boundary/,
  );
});

test("buildGmailRawMessage subjects keep non-C whitespace that Unicode trim would drop", () => {
  const raw = buildGmailRawMessage({
    from: "orders@restaurant.example",
    to: "supplier@example.com",
    subject: "\u2003Produce order\u2003",
    textBody: "Tomatoes - 10 lb",
    messageId: gmailMessageId("33333333-3333-4333-8333-333333333333"),
  });
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  // Subject is RFC 2047 Base64 of the exact sanitized UTF-8 octets.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(
    "\u2003Produce order\u2003",
    "utf8",
  ).toString("base64")}?=`;
  assert.match(decoded, new RegExp(`Subject: ${encodedSubject.replace(/[?]/g, "\\?")}`));
  assert.doesNotMatch(decoded, /\r\nBcc:/);
});

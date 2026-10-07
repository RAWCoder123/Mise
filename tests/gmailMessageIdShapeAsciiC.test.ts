import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildGmailRawMessage,
  gmailMessageId,
  isAsciiCGmailRfcMessageIdShape,
} from "../supabase/functions/_shared/gmail.ts";

const gmailShared = readFileSync(
  new URL("../supabase/functions/_shared/gmail.ts", import.meta.url),
  "utf8",
);

test("MISE-005JY pins Gmail Message-ID shape whitespace to ASCII C", () => {
  assert.match(gmailShared, /MISE-005JY/);
  assert.match(
    gmailShared,
    /export function isAsciiCGmailRfcMessageIdShape\(value: string\)/,
  );
  assert.match(
    gmailShared,
    /\/\^<\[\^<> \\t\\n\\v\\f\\r@\]\+@\[\^<> \\t\\n\\v\\f\\r@\]\+>\$\/u/,
  );

  const shapeBody = gmailShared.slice(
    gmailShared.indexOf("export function isAsciiCGmailRfcMessageIdShape("),
    gmailShared.indexOf("function requireMessageId("),
  );
  assert.doesNotMatch(shapeBody, /\\s/);
  assert.doesNotMatch(shapeBody, /\.trim\(\)/);
  assert.doesNotMatch(shapeBody, /\.toLowerCase\(\)/);

  const requireBody = gmailShared.slice(
    gmailShared.indexOf("function requireMessageId("),
    gmailShared.indexOf("function stringField("),
  );
  assert.match(requireBody, /isAsciiCGmailRfcMessageIdShape\(messageId\)/);
  assert.doesNotMatch(requireBody, /\\s/);

  // Leave sanitizeHeader / normalizeEmail alone — #693 and #423 own those.
  assert.doesNotMatch(gmailShared, /trimAsciiCHeaderWhitespace/);
  assert.doesNotMatch(gmailShared, /sanitizeGmailHeader/);
  assert.doesNotMatch(gmailShared, /normalizeGmailSenderEmail/);
});

test("isAsciiCGmailRfcMessageIdShape rejects C whitespace and allows non-C Zs as literals", () => {
  assert.equal(isAsciiCGmailRfcMessageIdShape("<mise-order@mail.mise.app>"), true);
  assert.equal(
    isAsciiCGmailRfcMessageIdShape("<mise order@mail.mise.app>"),
    false,
  );
  assert.equal(
    isAsciiCGmailRfcMessageIdShape("<mise\torder@mail.mise.app>"),
    false,
  );
  assert.equal(
    isAsciiCGmailRfcMessageIdShape("<mise\norder@mail.mise.app>"),
    false,
  );

  // Unicode `\s` would reject NBSP / em-space; C [[:space:]] does not.
  assert.equal(
    isAsciiCGmailRfcMessageIdShape("<mise\u00a0order@mail.mise.app>"),
    true,
  );
  assert.equal(
    isAsciiCGmailRfcMessageIdShape("<mise\u2003order@mail.mise.app>"),
    true,
  );
  assert.notEqual(
    isAsciiCGmailRfcMessageIdShape("<mise order@mail.mise.app>"),
    isAsciiCGmailRfcMessageIdShape("<mise\u00a0order@mail.mise.app>"),
  );
});

test("requireMessageId path accepts generated ids and rejects C-space Message-IDs", () => {
  const generated = gmailMessageId("11111111-1111-4111-8111-111111111111");
  assert.equal(isAsciiCGmailRfcMessageIdShape(generated), true);

  assert.doesNotThrow(() =>
    buildGmailRawMessage({
      from: "ops@mail.mise.app",
      to: "supplier@example.com",
      subject: "Produce order",
      textBody: "Two cases of basil.",
      messageId: generated,
    }),
  );

  assert.throws(
    () =>
      buildGmailRawMessage({
        from: "ops@mail.mise.app",
        to: "supplier@example.com",
        subject: "Produce order",
        textBody: "Two cases of basil.",
        messageId: "<mise order@mail.mise.app>",
      }),
    /Message id is invalid/,
  );
});

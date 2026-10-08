import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ASCII_C_MAILBOX_SHAPE,
  asciiCLower,
  asciiCTrim,
  normalizeProvisioningEmail,
  normalizeProvisioningRequest,
  provisioningEmailsMatch
} from "../scripts/lib/betaRestaurantProvisioning.mjs";

const libSource = readFileSync(
  new URL("../scripts/lib/betaRestaurantProvisioning.mjs", import.meta.url),
  "utf8"
);
const operatorSource = readFileSync(
  new URL("../scripts/beta-restaurant-provisioning.mjs", import.meta.url),
  "utf8"
);
const stagingSource = readFileSync(
  new URL("../scripts/staging-owner-invitation-check.mjs", import.meta.url),
  "utf8"
);

function request(overrides: Record<string, unknown> = {}) {
  return normalizeProvisioningRequest({
    email: " Owner@Example.com ",
    restaurantName: " Example Kitchen ",
    cuisineType: " Cafe ",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    redirectTo: "mise://accept-invite",
    inviteFile: "/private/tmp/mise-beta-invite.json",
    ...overrides
  });
}

test("MISE-005KL pins beta provisioning email helpers to ASCII C", () => {
  assert.match(libSource, /MISE-005KL/);
  assert.match(
    libSource,
    /export function asciiCLower\(value\) \{\s*return String\(value \?\? ""\)\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(libSource, /export function normalizeProvisioningEmail/);
  assert.match(libSource, /export function provisioningEmailsMatch/);

  const normalizeBody = libSource.slice(
    libSource.indexOf("export function normalizeProvisioningRequest("),
    libSource.indexOf("export function assertProvisioningEnvironment(")
  );
  assert.match(normalizeBody, /normalizeProvisioningEmail\(input\.email\)/);
  assert.match(normalizeBody, /asciiCTrim\(asciiCLower\(input\.idempotencyKey\)\)/);
  assert.match(normalizeBody, /ASCII_C_MAILBOX_SHAPE\.test\(email\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(operatorSource, /provisioningEmailsMatch\(user\.email, email\)/);
  assert.doesNotMatch(
    operatorSource,
    /user\.email\?\.trim\(\)\.toLowerCase\(\)\s*===\s*email/
  );
  assert.match(stagingSource, /provisioningEmailsMatch\(user\.email, targetEmail\)/);
  assert.doesNotMatch(stagingSource, /targetEmail\.toLowerCase\(\)/);
});

test("ASCII C fold keeps ordinary owner mailboxes and hex keys stable", () => {
  assert.equal(normalizeProvisioningEmail("  Owner@Example.COM  "), "owner@example.com");
  assert.equal(asciiCLower("ABCDEF"), "abcdef");
  assert.equal(asciiCTrim(" \tready@mise.test\r\n"), "ready@mise.test");
  assert.equal(ASCII_C_MAILBOX_SHAPE.test("owner@example.com"), true);
  assert.equal(ASCII_C_MAILBOX_SHAPE.test("not-an-email"), false);

  const normalized = request({ email: "  Orders@Fresh.Example  " });
  assert.equal(normalized.email, "orders@fresh.example");
  assert.equal(
    normalized.idempotencyKey,
    "11111111-1111-4111-8111-111111111111"
  );
  assert.equal(
    request({ idempotencyKey: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" }).idempotencyKey,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  );
  assert.throws(() => request({ email: "invalid" }), /valid owner email/);
  assert.throws(() => request({ email: "a@b" }), /valid owner email/);
});

test("ASCII C fold does not invent Kelvin-sign owner mailbox identity", () => {
  // Unicode toLowerCase folds K → k and invents token@example.com.
  assert.equal("to\u212aen@example.com".toLowerCase(), "token@example.com");
  assert.notEqual(
    normalizeProvisioningEmail("to\u212aen@example.com"),
    "token@example.com"
  );
  assert.equal(
    normalizeProvisioningEmail("to\u212aen@example.com"),
    "to\u212aen@example.com"
  );

  const normalized = request({ email: "to\u212aen@example.com" });
  assert.equal(normalized.email, "to\u212aen@example.com");
  assert.equal(provisioningEmailsMatch("to\u212aen@example.com", "token@example.com"), false);
  assert.equal(provisioningEmailsMatch("Owner@Example.com", "owner@example.com"), true);
});

test("ASCII C mailbox shape preserves NBSP instead of treating it as whitespace", () => {
  // Unicode \s rejects NBSP as a mailbox separator; C-locale [[:space:]] does not
  // treat NBSP as ASCII whitespace, so the client must keep the same boundary.
  const withNbsp = "owner\u00a0@example.com";
  assert.equal(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(withNbsp), false);
  assert.equal(ASCII_C_MAILBOX_SHAPE.test(withNbsp), true);
  assert.equal(normalizeProvisioningEmail(`  ${withNbsp}  `), withNbsp);
  assert.equal(request({ email: `  ${withNbsp}  ` }).email, withNbsp);
});

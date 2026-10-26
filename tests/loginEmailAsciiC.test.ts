import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimLoginEmail,
  canonicalizeLoginEmail,
  normalizeLoginEmail
} from "../services/domain/loginEmailIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/loginEmailIdentity.ts", import.meta.url),
  "utf8"
);
const loginSource = readFileSync(new URL("../app/(auth)/login.tsx", import.meta.url), "utf8");
const accountAuthSource = readFileSync(
  new URL("../services/domain/accountAuth.ts", import.meta.url),
  "utf8"
);

const mailbox = "chef@restaurant.com";

test("MISE-005QP pins login email identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005QP/);
  assert.match(loginSource, /MISE-005QP/);

  assert.match(
    identitySource,
    /export function asciiTrimLoginEmail\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(loginSource, /normalizeLoginEmail\(email\)/);
  assert.match(loginSource, /from "\.\.\/\.\.\/services\/domain\/loginEmailIdentity"/);
  assert.doesNotMatch(loginSource, /email\.trim\(\)/);

  // Leave open accountAuth mailbox tip #722 on its existing Unicode-trim contract.
  assert.match(accountAuthSource, /const normalized = value\.trim\(\);/);
  assert.match(accountAuthSource, /const normalizedEmail = email\.trim\(\);/);

  // Do not rewrite sibling mailbox tips through this module.
  assert.doesNotMatch(identitySource, /normalizeAccountEmail/);
  assert.doesNotMatch(identitySource, /normalizeOutreachEmail/);
  assert.doesNotMatch(identitySource, /normalizeTeamMemberEmail/);
  assert.doesNotMatch(identitySource, /from ["']\.\/accountAuth["']/);
  assert.doesNotMatch(loginSource, /normalizeAccountEmail/);
  assert.doesNotMatch(loginSource, /from "\.\.\/\.\.\/services\/domain\/accountAuth"/);
});

test("ASCII trim keeps ordinary login mailbox padding stable", () => {
  assert.equal(asciiTrimLoginEmail(`  ${mailbox}  `), mailbox);
  assert.equal(canonicalizeLoginEmail(`\t${mailbox}\n`), mailbox);
  assert.equal(normalizeLoginEmail(`  ${mailbox}  `), mailbox);
  assert.equal(normalizeLoginEmail(mailbox), mailbox);

  // Prior emptiness contract: ASCII-only whitespace softs to "".
  assert.equal(normalizeLoginEmail("   "), "");
  assert.equal(normalizeLoginEmail("\t\n"), "");
  assert.equal(normalizeLoginEmail(""), "");
  assert.equal(normalizeLoginEmail(null), "");
  assert.equal(normalizeLoginEmail(undefined), "");
});

test("NBSP and em-space padding cannot invent a clean login mailbox", () => {
  const nbspMailbox = `\u00a0${mailbox}\u00a0`;
  const emMailbox = `\u2003${mailbox}\u2003`;

  // Live inventing proof on Unicode trim (what login.tsx used before this tip).
  assert.equal(nbspMailbox.trim(), mailbox);
  assert.equal(emMailbox.trim(), mailbox);

  assert.equal(canonicalizeLoginEmail(nbspMailbox), null);
  assert.equal(canonicalizeLoginEmail(emMailbox), null);
  assert.equal(normalizeLoginEmail(nbspMailbox), "");
  assert.equal(normalizeLoginEmail(emMailbox), "");

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness.
  assert.equal(normalizeLoginEmail("\u2003\u2003"), "");
  assert.equal(normalizeLoginEmail("\u00a0\u00a0"), "");

  // Padded and clean stay distinct — do not invent Auth sign-in equality.
  assert.notEqual(normalizeLoginEmail(nbspMailbox), mailbox);
  assert.notEqual(normalizeLoginEmail(emMailbox), mailbox);
});

test("ASCII controls fail closed without inventing a login mailbox", () => {
  assert.equal(canonicalizeLoginEmail("chef@exam\nple.com"), null);
  assert.equal(canonicalizeLoginEmail("chef@exam\rple.com"), null);
  assert.equal(canonicalizeLoginEmail("chef@exam\x01ple.com"), null);
  assert.equal(canonicalizeLoginEmail("chef@exam\x7fple.com"), null);
  assert.equal(normalizeLoginEmail("chef@exam\nple.com"), "");
  assert.equal(normalizeLoginEmail("chef@exam\x7fple.com"), "");
});

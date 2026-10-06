import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeTeamMemberEmail } from "../services/domain/teamMembership";

const domainSource = readFileSync(
  new URL("../services/domain/teamMembership.ts", import.meta.url),
  "utf8"
);

test("MISE-005JD pins normalizeTeamMemberEmail to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JD/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeTeamMemberEmail("),
    domainSource.length
  );

  assert.match(normalizeBody, /asciiCTrim\(asciiCLower\(value\)\)/);
  assert.match(normalizeBody, /asciiCControl\.test\(normalized\)/);
  assert.match(normalizeBody, /asciiCMailboxShape\.test\(normalized\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);
});

test("ASCII C fold keeps ordinary invite mailboxes stable", () => {
  assert.equal(normalizeTeamMemberEmail("  Chef@Bistro.co  "), "chef@bistro.co");
  assert.equal(normalizeTeamMemberEmail("Ops@Example.COM"), "ops@example.com");
  assert.equal(normalizeTeamMemberEmail("not-an-email"), null);
  assert.equal(normalizeTeamMemberEmail("a@b"), null);
  assert.equal(normalizeTeamMemberEmail(`${"a".repeat(250)}@x.com`), null);
});

test("ASCII C fold does not invent Kelvin-sign mailbox identity", () => {
  // Unicode toLowerCase would fold K → k and invent chef@bistro.co.
  assert.equal(normalizeTeamMemberEmail("Khef@Bistro.co"), "Khef@bistro.co");
  assert.notEqual(normalizeTeamMemberEmail("Khef@Bistro.co"), "chef@bistro.co");

  // Kelvin in the domain must not become a lookalike ASCII host.
  assert.equal(normalizeTeamMemberEmail("chef@Kistro.co"), "chef@Kistro.co");
  assert.notEqual(normalizeTeamMemberEmail("chef@Kistro.co"), "chef@kistro.co");
});

test("ASCII C mailbox shape rejects controls; NBSP is not ASCII space", () => {
  assert.equal(normalizeTeamMemberEmail("ops@exam\nple.com"), null);
  assert.equal(normalizeTeamMemberEmail("ops@exam\rple.com"), null);
  assert.equal(normalizeTeamMemberEmail("ops@exam\x01ple.com"), null);
  assert.equal(normalizeTeamMemberEmail("ops@exam\x7fple.com"), null);
  // NBSP is outside C-locale [[:space:]]; preserve it rather than treating it
  // as a Unicode `\s` break the way the pre-pin client did.
  assert.equal(
    normalizeTeamMemberEmail("ops@exam\u00a0ple.com"),
    "ops@exam\u00a0ple.com"
  );
});

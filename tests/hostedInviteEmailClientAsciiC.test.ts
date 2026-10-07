import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeHostedInviteEmailDisplay } from "../services/domain/hostedInviteEmail";

const domainSource = readFileSync(
  new URL("../services/domain/hostedInviteEmail.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

test("MISE-005JM pins hosted invite email display to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JM/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeHostedInviteEmailDisplay(")
  );

  assert.match(normalizeBody, /asciiCTrim\(asciiCLower\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);
});

test("MISE-005JM wires hosted invite optimistic email through ASCII C helper", () => {
  assert.match(
    repositorySource,
    /import \{ normalizeHostedInviteEmailDisplay \} from "\.\.\/domain\/hostedInviteEmail"/
  );

  const inviteBody = repositorySource.slice(
    repositorySource.indexOf("async addRestaurantMemberByEmail(restaurantId, email, role)"),
    repositorySource.indexOf("async addRestaurantMember(restaurantId, targetUserId, role)")
  );
  assert.match(inviteBody, /normalizeHostedInviteEmailDisplay\(email\)/);
  assert.doesNotMatch(inviteBody, /email\.trim\(\)\.toLowerCase\(\)/);
});

test("ASCII C fold keeps ordinary invite mailboxes stable", () => {
  assert.equal(
    normalizeHostedInviteEmailDisplay("  Manager@Fresh.Example  "),
    "manager@fresh.example"
  );
  assert.equal(
    normalizeHostedInviteEmailDisplay("chef@kitchen.example"),
    "chef@kitchen.example"
  );
});

test("ASCII C fold does not invent Kelvin-sign mailbox identity", () => {
  // Unicode toLowerCase would fold K → k and invent manager@fresh.example.
  assert.equal(
    normalizeHostedInviteEmailDisplay("Kanager@Fresh.Example"),
    "Kanager@fresh.example"
  );
  assert.notEqual(
    normalizeHostedInviteEmailDisplay("Kanager@Fresh.Example"),
    "kanager@fresh.example"
  );

  assert.equal(
    normalizeHostedInviteEmailDisplay("manager@Kresh.example"),
    "manager@Kresh.example"
  );
  assert.notEqual(
    normalizeHostedInviteEmailDisplay("manager@Kresh.example"),
    "manager@kresh.example"
  );
});

test("ASCII C trim does not treat NBSP as space", () => {
  // Unicode trim() strips NBSP; ASCII C trim preserves it so the display
  // mailbox cannot silently diverge from C-locale btrim on the invite path.
  assert.equal(
    normalizeHostedInviteEmailDisplay("\u00a0manager@fresh.example\u00a0"),
    "\u00a0manager@fresh.example\u00a0"
  );
  assert.equal(
    normalizeHostedInviteEmailDisplay("manager@exam\u00a0ple.com"),
    "manager@exam\u00a0ple.com"
  );
});

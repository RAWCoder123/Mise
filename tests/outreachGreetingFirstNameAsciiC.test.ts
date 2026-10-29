import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildFallbackOutreachDraft } from "../services/domain/outreach";
import {
  asciiTrimOutreachGreetingFirstName,
  canonicalizeOutreachGreetingFirstNameToken,
  normalizeOutreachGreetingFirstName
} from "../services/domain/outreachGreetingFirstNameIdentity";

test("MISE-005TV pins outreach greeting firstName to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/outreachGreetingFirstNameIdentity.ts",
    "utf8"
  );
  const outreachSource = readFileSync("services/domain/outreach.ts", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimOutreachGreetingFirstName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    outreachSource,
    /normalizeOutreachGreetingFirstName\(value\) \|\| "there"/
  );
  assert.match(
    outreachSource,
    /from "\.\/outreachGreetingFirstNameIdentity"/
  );

  // Leave lead requireText, mailbox normalize, and draft bounded text alone.
  assert.match(
    outreachSource,
    /function normalizeOutreachEmail\(value: string\) \{\s*return value\.trim\(\)\.toLowerCase\(\);/
  );
  assert.match(
    outreachSource,
    /function requireText\(value: unknown, fieldName: string, maximumLength: number\) \{\s*if \(typeof value !== "string"\) throw new Error\(`\$\{fieldName\} is required\.`\);\s*const text = value\.trim\(\);/
  );

  const contactName = "Alex Rivera";
  assert.equal(asciiTrimOutreachGreetingFirstName(`  ${contactName}  `), contactName);
  assert.equal(asciiTrimOutreachGreetingFirstName(`\tAlex\n`), "Alex");
  assert.equal(normalizeOutreachGreetingFirstName(`  ${contactName}  `), "Alex");
  assert.equal(normalizeOutreachGreetingFirstName("  Chef  "), "Chef");
  assert.equal(
    canonicalizeOutreachGreetingFirstNameToken(`  ${contactName}  `),
    contactName
  );

  const draft = buildFallbackOutreachDraft({
    businessName: "Joe's Cafe",
    contactName: "  Alex Rivera  ",
    city: "Austin",
    valueProposition: "Mise keeps inventory and ordering in one calm workflow.",
    sequenceNumber: 0
  });
  assert.match(draft.body, /^Hi Alex,/);

  // Soft empty / Unicode-only space preserves intentional "there" fallback.
  assert.equal(normalizeOutreachGreetingFirstName(""), null);
  assert.equal(normalizeOutreachGreetingFirstName("   "), null);
  assert.equal(normalizeOutreachGreetingFirstName("\u2003"), null);
  assert.equal(normalizeOutreachGreetingFirstName("\u00a0"), null);
  assert.equal(
    buildFallbackOutreachDraft({
      businessName: "Joe's Cafe",
      contactName: "\u2003",
      valueProposition: "Mise keeps inventory and ordering in one calm workflow.",
      sequenceNumber: 0
    }).body.startsWith("Hi there,"),
    true
  );
});

test("MISE-005TV refuses Unicode-trim inventing of clean greeting first names", () => {
  const paddedName = "\u2003Alex Rivera\u2003";
  const nbspName = "\u00a0Alex Rivera\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim().split(/\s+/)[0], "Alex");
  assert.equal(nbspName.trim().split(/\s+/)[0], "Alex");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimOutreachGreetingFirstName(paddedName), paddedName);
  assert.equal(asciiTrimOutreachGreetingFirstName(nbspName), nbspName);
  assert.equal(canonicalizeOutreachGreetingFirstNameToken(paddedName), null);
  assert.equal(canonicalizeOutreachGreetingFirstNameToken(nbspName), null);
  assert.equal(normalizeOutreachGreetingFirstName(paddedName), null);
  assert.equal(normalizeOutreachGreetingFirstName(nbspName), null);

  const paddedDraft = buildFallbackOutreachDraft({
    businessName: "Joe's Cafe",
    contactName: paddedName,
    valueProposition: "Mise keeps inventory and ordering in one calm workflow.",
    sequenceNumber: 0
  });
  assert.match(paddedDraft.body, /^Hi there,/);
  assert.doesNotMatch(paddedDraft.body, /^Hi Alex,/);

  const nbspDraft = buildFallbackOutreachDraft({
    businessName: "Joe's Cafe",
    contactName: nbspName,
    valueProposition: "Mise keeps inventory and ordering in one calm workflow.",
    sequenceNumber: 0
  });
  assert.match(nbspDraft.body, /^Hi there,/);
  assert.doesNotMatch(nbspDraft.body, /^Hi Alex,/);
});

test("MISE-005TV soft-nulls controls and preserves the 80-character first-token cap", () => {
  assert.equal(normalizeOutreachGreetingFirstName("Alex\u0001Rivera"), null);
  assert.equal(normalizeOutreachGreetingFirstName("\u0007Chef"), null);

  const longToken = `A${"b".repeat(100)}`;
  assert.equal(normalizeOutreachGreetingFirstName(longToken)?.length, 80);
  assert.equal(normalizeOutreachGreetingFirstName(`  ${longToken}  `)?.length, 80);

  const draft = buildFallbackOutreachDraft({
    businessName: "Joe's Cafe",
    contactName: longToken,
    valueProposition: "Mise keeps inventory and ordering in one calm workflow.",
    sequenceNumber: 1
  });
  assert.match(draft.body, new RegExp(`^Hi ${"A" + "b".repeat(79)},`));
});

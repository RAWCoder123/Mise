import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationGreetingFirstName,
  canonicalizePresentationGreetingFirstNameToken,
  normalizePresentationGreetingFirstName
} from "../services/domain/presentationGreetingFirstNameIdentity";

test("MISE-005TW pins Home and Ask Mise greeting firstName to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationGreetingFirstNameIdentity.ts",
    "utf8"
  );
  const homeSource = readFileSync("app/(tabs)/home.tsx", "utf8");
  const askSource = readFileSync("app/ask-mise.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationGreetingFirstName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    homeSource,
    /normalizePresentationGreetingFirstName\(name\) \?\? ""/
  );
  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationGreetingFirstNameIdentity"/
  );
  assert.match(
    askSource,
    /normalizePresentationGreetingFirstName\(user\?\.name\) \|\| t\("ask\.greeting\.fallbackName"\)/
  );
  assert.match(
    askSource,
    /from "\.\.\/services\/domain\/presentationGreetingFirstNameIdentity"/
  );

  // Leave prior Unicode presentation greets removed from call sites.
  assert.doesNotMatch(homeSource, /name\?\.trim\(\)\.split\(\\s\+\)/);
  assert.doesNotMatch(askSource, /user\?\.name\?\.trim\(\)\.split\(\\s\+\)/);

  // Do not share outreach greeting module (#960) or profile display name (#849).
  assert.doesNotMatch(
    homeSource,
    /outreachGreetingFirstNameIdentity|normalizeOutreachGreetingFirstName/
  );
  assert.doesNotMatch(
    askSource,
    /outreachGreetingFirstNameIdentity|normalizeOutreachGreetingFirstName/
  );

  const contactName = "Alex Rivera";
  assert.equal(asciiTrimPresentationGreetingFirstName(`  ${contactName}  `), contactName);
  assert.equal(asciiTrimPresentationGreetingFirstName(`\tAlex\n`), "Alex");
  assert.equal(normalizePresentationGreetingFirstName(`  ${contactName}  `), "Alex");
  assert.equal(normalizePresentationGreetingFirstName("  Chef  "), "Chef");
  assert.equal(
    canonicalizePresentationGreetingFirstNameToken(`  ${contactName}  `),
    contactName
  );

  // Soft empty / Unicode-only space preserves intentional i18n fallback.
  assert.equal(normalizePresentationGreetingFirstName(""), null);
  assert.equal(normalizePresentationGreetingFirstName("   "), null);
  assert.equal(normalizePresentationGreetingFirstName("\u2003"), null);
  assert.equal(normalizePresentationGreetingFirstName("\u00a0"), null);
  assert.equal(normalizePresentationGreetingFirstName(null), null);
  assert.equal(normalizePresentationGreetingFirstName(undefined), null);
});

test("MISE-005TW refuses Unicode-trim inventing of clean presentation greeting first names", () => {
  const paddedName = "\u2003Alex Rivera\u2003";
  const nbspName = "\u00a0Alex Rivera\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim().split(/\s+/)[0], "Alex");
  assert.equal(nbspName.trim().split(/\s+/)[0], "Alex");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationGreetingFirstName(paddedName), paddedName);
  assert.equal(asciiTrimPresentationGreetingFirstName(nbspName), nbspName);
  assert.equal(canonicalizePresentationGreetingFirstNameToken(paddedName), null);
  assert.equal(canonicalizePresentationGreetingFirstNameToken(nbspName), null);
  assert.equal(normalizePresentationGreetingFirstName(paddedName), null);
  assert.equal(normalizePresentationGreetingFirstName(nbspName), null);
});

test("MISE-005TW soft-nulls controls and preserves multi-token first-name selection", () => {
  assert.equal(normalizePresentationGreetingFirstName("Alex\u0001Rivera"), null);
  assert.equal(normalizePresentationGreetingFirstName("\u0007Chef"), null);

  assert.equal(normalizePresentationGreetingFirstName("Maria Elena Lopez"), "Maria");
  assert.equal(normalizePresentationGreetingFirstName("  Jordan  Lee  "), "Jordan");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationProfileInitialsSeed,
  canonicalizePresentationProfileInitialsSeed,
  normalizePresentationProfileInitialsSeed,
  presentationProfileInitialsFromSeed
} from "../services/domain/presentationProfileInitialsIdentity";

test("MISE-005TX pins More and Settings profile initials to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationProfileInitialsIdentity.ts",
    "utf8"
  );
  const moreSource = readFileSync("app/(tabs)/more.tsx", "utf8");
  const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationProfileInitialsSeed\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    moreSource,
    /presentationProfileInitialsFromSeed\(user\?\.name \|\| user\?\.email \|\| "Mise"\)/
  );
  assert.match(
    moreSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationProfileInitialsIdentity"/
  );
  assert.match(
    settingsSource,
    /presentationProfileInitialsFromSeed\(user\?\.name \|\| user\?\.email \|\| "Mise"\)/
  );
  assert.match(
    settingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationProfileInitialsIdentity"/
  );

  // Leave prior Unicode initials helpers removed from call sites.
  assert.doesNotMatch(moreSource, /function initialsFor\(/);
  assert.doesNotMatch(settingsSource, /function initialsFor\(/);
  assert.doesNotMatch(moreSource, /value\.trim\(\)\.split\(\\s\+\)\.filter\(Boolean\)/);
  assert.doesNotMatch(settingsSource, /value\.trim\(\)\.split\(\\s\+\)\.filter\(Boolean\)/);

  // Do not share greeting / outreach / profile-name modules.
  assert.doesNotMatch(
    moreSource,
    /presentationGreetingFirstNameIdentity|outreachGreetingFirstNameIdentity|normalizePresentationGreetingFirstName/
  );
  assert.doesNotMatch(
    settingsSource,
    /presentationGreetingFirstNameIdentity|outreachGreetingFirstNameIdentity|normalizePresentationGreetingFirstName/
  );

  const contactName = "Alex Rivera";
  assert.equal(asciiTrimPresentationProfileInitialsSeed(`  ${contactName}  `), contactName);
  assert.equal(asciiTrimPresentationProfileInitialsSeed(`\tAlex\n`), "Alex");
  assert.equal(normalizePresentationProfileInitialsSeed(`  ${contactName}  `), contactName);
  assert.equal(normalizePresentationProfileInitialsSeed("  Chef  "), "Chef");
  assert.equal(
    canonicalizePresentationProfileInitialsSeed(`  ${contactName}  `),
    contactName
  );
  assert.equal(presentationProfileInitialsFromSeed(`  ${contactName}  `), "AR");
  assert.equal(presentationProfileInitialsFromSeed("  Chef  "), "CH");
  assert.equal(presentationProfileInitialsFromSeed("Jordan"), "JO");
  assert.equal(presentationProfileInitialsFromSeed("Maria Elena Lopez"), "ME");

  // Soft empty / Unicode-only space preserves intentional "M" fallback.
  assert.equal(normalizePresentationProfileInitialsSeed(""), null);
  assert.equal(normalizePresentationProfileInitialsSeed("   "), null);
  assert.equal(normalizePresentationProfileInitialsSeed("\u2003"), null);
  assert.equal(normalizePresentationProfileInitialsSeed("\u00a0"), null);
  assert.equal(normalizePresentationProfileInitialsSeed(null), null);
  assert.equal(normalizePresentationProfileInitialsSeed(undefined), null);
  assert.equal(presentationProfileInitialsFromSeed(""), "M");
  assert.equal(presentationProfileInitialsFromSeed("\u2003"), "M");
  assert.equal(presentationProfileInitialsFromSeed(null), "M");
});

test("MISE-005TX refuses Unicode-trim inventing of clean presentation profile initials", () => {
  const paddedName = "\u2003Alex Rivera\u2003";
  const nbspName = "\u00a0Alex Rivera\u00a0";

  // Inventing proof on prior Unicode trim path.
  const paddedParts = paddedName.trim().split(/\s+/).filter(Boolean);
  assert.deepEqual(paddedParts, ["Alex", "Rivera"]);
  assert.equal(`${paddedParts[0]![0]}${paddedParts[1]![0]}`.toUpperCase(), "AR");
  assert.deepEqual(nbspName.trim().split(/\s+/).filter(Boolean), ["Alex", "Rivera"]);

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationProfileInitialsSeed(paddedName), paddedName);
  assert.equal(asciiTrimPresentationProfileInitialsSeed(nbspName), nbspName);
  assert.equal(canonicalizePresentationProfileInitialsSeed(paddedName), null);
  assert.equal(canonicalizePresentationProfileInitialsSeed(nbspName), null);
  assert.equal(normalizePresentationProfileInitialsSeed(paddedName), null);
  assert.equal(normalizePresentationProfileInitialsSeed(nbspName), null);
  assert.equal(presentationProfileInitialsFromSeed(paddedName), "M");
  assert.equal(presentationProfileInitialsFromSeed(nbspName), "M");
});

test("MISE-005TX soft-nulls controls and preserves multi-token initials selection", () => {
  assert.equal(normalizePresentationProfileInitialsSeed("Alex\u0001Rivera"), null);
  assert.equal(normalizePresentationProfileInitialsSeed("\u0007Chef"), null);
  assert.equal(presentationProfileInitialsFromSeed("Alex\u0001Rivera"), "M");

  assert.equal(presentationProfileInitialsFromSeed("  Jordan  Lee  "), "JL");
  assert.equal(presentationProfileInitialsFromSeed("mise@example.com"), "MI");
});

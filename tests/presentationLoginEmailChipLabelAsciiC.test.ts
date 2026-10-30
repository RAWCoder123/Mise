import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationLoginEmailChipLabel,
  canonicalizePresentationLoginEmailChipLabel,
  normalizePresentationLoginEmailChipLabel,
  presentationLoginEmailChipLabel
} from "../services/domain/presentationLoginEmailChipLabelIdentity";

test("MISE-005UG pins Login email chip labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationLoginEmailChipLabelIdentity.ts",
    "utf8"
  );
  const loginSource = readFileSync("app/(auth)/login.tsx", "utf8");
  const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationLoginEmailChipLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    loginSource,
    /presentationLoginEmailChipLabel\(email\) \|\| email/
  );
  assert.match(
    loginSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationLoginEmailChipLabelIdentity"/
  );

  // Leave prior Unicode email chip trim removed from Login password-step chrome.
  assert.doesNotMatch(loginSource, /emailChipText\}>\{email\.trim\(\)\}/);
  assert.doesNotMatch(
    loginSource,
    /<Text style=\{styles\.emailChipText\}>\{email\.trim\(\)\}<\/Text>/
  );

  // Auth continue / sign-in emptiness gates stay on Unicode trim for credential
  // submission — this tip owns chip display only.
  assert.match(loginSource, /const normalizedEmail = email\.trim\(\);/);

  // Do not share Settings account email / profile-name / initials / greeting /
  // outreach / Create Task / team-directory / durable profile-name / mailbox
  // modules.
  assert.doesNotMatch(
    loginSource,
    /presentationSettingsAccountEmailLabelIdentity|presentationSettingsAccountEmailLabel|presentationProfileNameLabelIdentity|presentationProfileInitialsIdentity|presentationGreetingFirstNameIdentity|outreachGreetingFirstNameIdentity|presentationCreateTaskAssigneeLabelIdentity|presentationTeamDirectoryLabelIdentity|userProfileNameIdentity|outreachWebhookFromEmailIdentity|normalizeOutreachEmail/
  );

  // Settings account email label stays on its own tip (#966).
  assert.match(
    settingsSource,
    /user\?\.email\?\.trim\(\) \|\| t\("settings\.account\.emailMissing"\)/
  );
  assert.doesNotMatch(
    settingsSource,
    /presentationLoginEmailChipLabelIdentity|presentationLoginEmailChipLabel/
  );

  const contactEmail = "chef@example.com";
  assert.equal(
    asciiTrimPresentationLoginEmailChipLabel(`  ${contactEmail}  `),
    contactEmail
  );
  assert.equal(asciiTrimPresentationLoginEmailChipLabel(`\tchef@example.com\n`), "chef@example.com");
  assert.equal(normalizePresentationLoginEmailChipLabel(`  ${contactEmail}  `), contactEmail);
  assert.equal(canonicalizePresentationLoginEmailChipLabel(`  ${contactEmail}  `), contactEmail);
  assert.equal(presentationLoginEmailChipLabel(`  ${contactEmail}  `), contactEmail);

  // Soft empty / Unicode-only space soft-nulls (no invented chip label).
  assert.equal(normalizePresentationLoginEmailChipLabel(""), null);
  assert.equal(normalizePresentationLoginEmailChipLabel("   "), null);
  assert.equal(normalizePresentationLoginEmailChipLabel("\u2003"), null);
  assert.equal(normalizePresentationLoginEmailChipLabel("\u00a0"), null);
  assert.equal(normalizePresentationLoginEmailChipLabel(null), null);
  assert.equal(normalizePresentationLoginEmailChipLabel(undefined), null);
  assert.equal(presentationLoginEmailChipLabel(null), null);
  assert.equal(presentationLoginEmailChipLabel("\u2003"), null);
});

test("MISE-005UG refuses Unicode-trim inventing of clean Login email chip labels", () => {
  const paddedEmail = "\u2003chef@example.com\u2003";
  const nbspEmail = "\u00a0chef@example.com\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedEmail.trim(), "chef@example.com");
  assert.equal(nbspEmail.trim(), "chef@example.com");
  assert.equal(paddedEmail.trim() || "FALLBACK", "chef@example.com");
  assert.equal("\u2003".trim() || "FALLBACK", "FALLBACK");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationLoginEmailChipLabel(paddedEmail), paddedEmail);
  assert.equal(asciiTrimPresentationLoginEmailChipLabel(nbspEmail), nbspEmail);
  assert.equal(canonicalizePresentationLoginEmailChipLabel(paddedEmail), null);
  assert.equal(canonicalizePresentationLoginEmailChipLabel(nbspEmail), null);
  assert.equal(normalizePresentationLoginEmailChipLabel(paddedEmail), null);
  assert.equal(normalizePresentationLoginEmailChipLabel(nbspEmail), null);
  assert.equal(presentationLoginEmailChipLabel(paddedEmail), null);
  assert.equal(presentationLoginEmailChipLabel(nbspEmail), null);

  // Call-site raw fallback preserves the typed seed without inventing clean chrome.
  assert.equal(presentationLoginEmailChipLabel(paddedEmail) || paddedEmail, paddedEmail);
  assert.equal(presentationLoginEmailChipLabel(nbspEmail) || nbspEmail, nbspEmail);
});

test("MISE-005UG soft-nulls controls and preserves ordinary ASCII-trimmed emails", () => {
  assert.equal(normalizePresentationLoginEmailChipLabel("chef\u0001@example.com"), null);
  assert.equal(normalizePresentationLoginEmailChipLabel("\u0007chef@example.com"), null);

  assert.equal(
    presentationLoginEmailChipLabel("owner@riverside.kitchen"),
    "owner@riverside.kitchen"
  );
  assert.equal(presentationLoginEmailChipLabel("  gm@example.com  "), "gm@example.com");
  assert.equal(presentationLoginEmailChipLabel("ops@mise.app"), "ops@mise.app");
});

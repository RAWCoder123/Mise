import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSettingsAccountEmailLabel,
  canonicalizePresentationSettingsAccountEmailLabel,
  normalizePresentationSettingsAccountEmailLabel,
  presentationSettingsAccountEmailLabel
} from "../services/domain/presentationSettingsAccountEmailLabelIdentity";

test("MISE-005UB pins Settings account email labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSettingsAccountEmailLabelIdentity.ts",
    "utf8"
  );
  const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const moreSource = readFileSync("app/(tabs)/more.tsx", "utf8");
  const teamSource = readFileSync("app/settings/team.tsx", "utf8");
  const createTaskSource = readFileSync("app/more/create-task.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSettingsAccountEmailLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    settingsSource,
    /presentationSettingsAccountEmailLabel\(user\?\.email\) \|\| t\("settings\.account\.emailMissing"\)/
  );
  assert.match(
    settingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSettingsAccountEmailLabelIdentity"/
  );

  // Leave prior Unicode account email label trim removed from Settings.
  assert.doesNotMatch(
    settingsSource,
    /user\?\.email\?\.trim\(\) \|\| t\("settings\.account\.emailMissing"\)/
  );

  // Do not share profile-name / initials / greeting / outreach / Create Task /
  // team-directory / durable profile-name / mailbox modules.
  assert.doesNotMatch(
    settingsSource,
    /presentationProfileNameLabelIdentity|presentationProfileInitialsIdentity|presentationGreetingFirstNameIdentity|outreachGreetingFirstNameIdentity|presentationCreateTaskAssigneeLabelIdentity|presentationTeamDirectoryLabelIdentity|userProfileNameIdentity|outreachWebhookFromEmailIdentity|normalizeOutreachEmail/
  );

  // Leave Settings profile name label and avatar initials on their own tips.
  assert.match(
    settingsSource,
    /user\?\.name\?\.trim\(\) \|\| t\("settings\.account\.title"\)/
  );
  assert.match(settingsSource, /function initialsFor\(value: string\)/);
  assert.match(moreSource, /function initialsFor\(value: string\)/);

  // Team directory and Create Task assignee labels stay on their own tips.
  assert.match(
    teamSource,
    /member\.name\?\.trim\(\) \|\| member\.email\?\.trim\(\) \|\| t\("team\.member\.unnamed"\)/
  );
  assert.match(
    createTaskSource,
    /member\.name\?\.trim\(\) \|\| member\.email\?\.trim\(\) \|\| t\("operatorTasks\.assignee\.teammate"\)/
  );
  assert.doesNotMatch(
    teamSource,
    /presentationSettingsAccountEmailLabelIdentity|presentationSettingsAccountEmailLabel/
  );
  assert.doesNotMatch(
    createTaskSource,
    /presentationSettingsAccountEmailLabelIdentity|presentationSettingsAccountEmailLabel/
  );
  assert.doesNotMatch(
    moreSource,
    /presentationSettingsAccountEmailLabelIdentity|presentationSettingsAccountEmailLabel/
  );

  const contactEmail = "chef@example.com";
  assert.equal(
    asciiTrimPresentationSettingsAccountEmailLabel(`  ${contactEmail}  `),
    contactEmail
  );
  assert.equal(asciiTrimPresentationSettingsAccountEmailLabel(`\tchef@example.com\n`), "chef@example.com");
  assert.equal(normalizePresentationSettingsAccountEmailLabel(`  ${contactEmail}  `), contactEmail);
  assert.equal(canonicalizePresentationSettingsAccountEmailLabel(`  ${contactEmail}  `), contactEmail);
  assert.equal(presentationSettingsAccountEmailLabel(`  ${contactEmail}  `), contactEmail);

  // Soft empty / Unicode-only space preserves intentional i18n fallback.
  assert.equal(normalizePresentationSettingsAccountEmailLabel(""), null);
  assert.equal(normalizePresentationSettingsAccountEmailLabel("   "), null);
  assert.equal(normalizePresentationSettingsAccountEmailLabel("\u2003"), null);
  assert.equal(normalizePresentationSettingsAccountEmailLabel("\u00a0"), null);
  assert.equal(normalizePresentationSettingsAccountEmailLabel(null), null);
  assert.equal(normalizePresentationSettingsAccountEmailLabel(undefined), null);
  assert.equal(presentationSettingsAccountEmailLabel(null), null);
  assert.equal(presentationSettingsAccountEmailLabel("\u2003"), null);
});

test("MISE-005UB refuses Unicode-trim inventing of clean Settings account email labels", () => {
  const paddedEmail = "\u2003chef@example.com\u2003";
  const nbspEmail = "\u00a0chef@example.com\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedEmail.trim(), "chef@example.com");
  assert.equal(nbspEmail.trim(), "chef@example.com");
  assert.equal(paddedEmail.trim() || "FALLBACK", "chef@example.com");
  assert.equal("\u2003".trim() || "FALLBACK", "FALLBACK");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSettingsAccountEmailLabel(paddedEmail), paddedEmail);
  assert.equal(asciiTrimPresentationSettingsAccountEmailLabel(nbspEmail), nbspEmail);
  assert.equal(canonicalizePresentationSettingsAccountEmailLabel(paddedEmail), null);
  assert.equal(canonicalizePresentationSettingsAccountEmailLabel(nbspEmail), null);
  assert.equal(normalizePresentationSettingsAccountEmailLabel(paddedEmail), null);
  assert.equal(normalizePresentationSettingsAccountEmailLabel(nbspEmail), null);
  assert.equal(presentationSettingsAccountEmailLabel(paddedEmail), null);
  assert.equal(presentationSettingsAccountEmailLabel(nbspEmail), null);
});

test("MISE-005UB soft-nulls controls and preserves ordinary ASCII-trimmed emails", () => {
  assert.equal(normalizePresentationSettingsAccountEmailLabel("chef\u0001@example.com"), null);
  assert.equal(normalizePresentationSettingsAccountEmailLabel("\u0007chef@example.com"), null);

  assert.equal(
    presentationSettingsAccountEmailLabel("owner@riverside.kitchen"),
    "owner@riverside.kitchen"
  );
  assert.equal(presentationSettingsAccountEmailLabel("  gm@example.com  "), "gm@example.com");
  assert.equal(presentationSettingsAccountEmailLabel("ops@mise.app"), "ops@mise.app");
});

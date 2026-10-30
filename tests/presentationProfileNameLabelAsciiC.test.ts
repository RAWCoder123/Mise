import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationProfileNameLabel,
  canonicalizePresentationProfileNameLabel,
  normalizePresentationProfileNameLabel,
  presentationProfileNameLabel
} from "../services/domain/presentationProfileNameLabelIdentity";

test("MISE-005TZ pins More/Settings profile name labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationProfileNameLabelIdentity.ts",
    "utf8"
  );
  const moreSource = readFileSync("app/(tabs)/more.tsx", "utf8");
  const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const teamSource = readFileSync("app/settings/team.tsx", "utf8");
  const createTaskSource = readFileSync("app/more/create-task.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationProfileNameLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    moreSource,
    /presentationProfileNameLabel\(user\?\.name\) \|\| t\("more\.profile\.fallbackName"\)/
  );
  assert.match(
    moreSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationProfileNameLabelIdentity"/
  );
  assert.match(
    settingsSource,
    /presentationProfileNameLabel\(user\?\.name\) \|\| t\("settings\.account\.title"\)/
  );
  assert.match(
    settingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationProfileNameLabelIdentity"/
  );

  // Leave prior Unicode profile name label trim removed from More / Settings.
  assert.doesNotMatch(moreSource, /user\?\.name\?\.trim\(\) \|\| t\("more\.profile\.fallbackName"\)/);
  assert.doesNotMatch(
    settingsSource,
    /user\?\.name\?\.trim\(\) \|\| t\("settings\.account\.title"\)/
  );

  // Do not share greeting / profile-initials / outreach / Create Task / durable profile-name modules.
  assert.doesNotMatch(
    moreSource,
    /presentationGreetingFirstNameIdentity|presentationProfileInitialsIdentity|outreachGreetingFirstNameIdentity|presentationCreateTaskAssigneeLabelIdentity|userProfileNameIdentity/
  );
  assert.doesNotMatch(
    settingsSource,
    /presentationGreetingFirstNameIdentity|presentationProfileInitialsIdentity|outreachGreetingFirstNameIdentity|presentationCreateTaskAssigneeLabelIdentity|userProfileNameIdentity/
  );

  // Leave More / Settings avatar initials and Settings email label on their own tips.
  assert.match(moreSource, /function initialsFor\(value: string\)/);
  assert.match(settingsSource, /function initialsFor\(value: string\)/);
  assert.match(
    settingsSource,
    /user\?\.email\?\.trim\(\) \|\| t\("settings\.account\.emailMissing"\)/
  );

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
    /presentationProfileNameLabelIdentity|presentationProfileNameLabel/
  );
  assert.doesNotMatch(
    createTaskSource,
    /presentationProfileNameLabelIdentity|presentationProfileNameLabel/
  );

  const contactName = "Alex Rivera";
  assert.equal(asciiTrimPresentationProfileNameLabel(`  ${contactName}  `), contactName);
  assert.equal(asciiTrimPresentationProfileNameLabel(`\tAlex\n`), "Alex");
  assert.equal(normalizePresentationProfileNameLabel(`  ${contactName}  `), contactName);
  assert.equal(canonicalizePresentationProfileNameLabel(`  ${contactName}  `), contactName);
  assert.equal(presentationProfileNameLabel(`  ${contactName}  `), contactName);

  // Soft empty / Unicode-only space preserves intentional i18n fallback.
  assert.equal(normalizePresentationProfileNameLabel(""), null);
  assert.equal(normalizePresentationProfileNameLabel("   "), null);
  assert.equal(normalizePresentationProfileNameLabel("\u2003"), null);
  assert.equal(normalizePresentationProfileNameLabel("\u00a0"), null);
  assert.equal(normalizePresentationProfileNameLabel(null), null);
  assert.equal(normalizePresentationProfileNameLabel(undefined), null);
  assert.equal(presentationProfileNameLabel(null), null);
  assert.equal(presentationProfileNameLabel("\u2003"), null);
});

test("MISE-005TZ refuses Unicode-trim inventing of clean More/Settings profile name labels", () => {
  const paddedName = "\u2003Alex Rivera\u2003";
  const nbspName = "\u00a0Alex Rivera\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Alex Rivera");
  assert.equal(nbspName.trim(), "Alex Rivera");
  assert.equal(paddedName.trim() || "FALLBACK", "Alex Rivera");
  assert.equal("\u2003".trim() || "FALLBACK", "FALLBACK");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationProfileNameLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationProfileNameLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationProfileNameLabel(paddedName), null);
  assert.equal(canonicalizePresentationProfileNameLabel(nbspName), null);
  assert.equal(normalizePresentationProfileNameLabel(paddedName), null);
  assert.equal(normalizePresentationProfileNameLabel(nbspName), null);
  assert.equal(presentationProfileNameLabel(paddedName), null);
  assert.equal(presentationProfileNameLabel(nbspName), null);
});

test("MISE-005TZ soft-nulls controls and preserves ordinary ASCII-trimmed names", () => {
  assert.equal(normalizePresentationProfileNameLabel("Alex\u0001Rivera"), null);
  assert.equal(normalizePresentationProfileNameLabel("\u0007Chef"), null);

  assert.equal(presentationProfileNameLabel("Maria Elena Lopez"), "Maria Elena Lopez");
  assert.equal(presentationProfileNameLabel("  Jordan Lee  "), "Jordan Lee");
  assert.equal(presentationProfileNameLabel("Chef"), "Chef");
});

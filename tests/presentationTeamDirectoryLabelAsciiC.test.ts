import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationTeamDirectoryLabel,
  canonicalizePresentationTeamDirectoryLabel,
  normalizePresentationTeamDirectoryLabelToken,
  presentationTeamDirectoryEmailLabel,
  presentationTeamDirectoryMemberLabel
} from "../services/domain/presentationTeamDirectoryLabelIdentity";

test("MISE-005UA pins Team Settings directory labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationTeamDirectoryLabelIdentity.ts",
    "utf8"
  );
  const teamSource = readFileSync("app/settings/team.tsx", "utf8");
  const createTaskSource = readFileSync("app/more/create-task.tsx", "utf8");
  const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationTeamDirectoryLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    teamSource,
    /presentationTeamDirectoryMemberLabel\(member\.name, member\.email\) \|\| t\("team\.member\.unnamed"\)/
  );
  assert.match(
    teamSource,
    /presentationTeamDirectoryEmailLabel\(member\.email\) \|\| t\("team\.member\.emailMissing"\)/
  );
  assert.match(
    teamSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTeamDirectoryLabelIdentity"/
  );

  // Leave prior Unicode directory label trim removed from Team Settings.
  assert.doesNotMatch(
    teamSource,
    /member\.name\?\.trim\(\) \|\| member\.email\?\.trim\(\)/
  );
  assert.doesNotMatch(teamSource, /member\.email\?\.trim\(\) \|\| t\("team\.member\.emailMissing"\)/);

  // Do not share Create Task assignee / greeting / profile-name / initials modules.
  assert.doesNotMatch(
    teamSource,
    /presentationCreateTaskAssigneeLabelIdentity|presentationGreetingFirstNameIdentity|presentationProfileNameLabelIdentity|presentationProfileInitialsIdentity|outreachGreetingFirstNameIdentity/
  );

  // Create Task assignee labels stay on their own tip (#963).
  assert.match(
    createTaskSource,
    /member\.name\?\.trim\(\) \|\| member\.email\?\.trim\(\) \|\| t\("operatorTasks\.assignee\.teammate"\)/
  );
  assert.doesNotMatch(
    createTaskSource,
    /presentationTeamDirectoryLabelIdentity|presentationTeamDirectoryMemberLabel|presentationTeamDirectoryEmailLabel/
  );

  // Settings account email label stays on its own tip.
  assert.match(
    settingsSource,
    /user\?\.email\?\.trim\(\) \|\| t\("settings\.account\.emailMissing"\)/
  );
  assert.doesNotMatch(
    settingsSource,
    /presentationTeamDirectoryLabelIdentity|presentationTeamDirectoryEmailLabel/
  );

  const contactName = "Alex Rivera";
  const contactEmail = "alex@example.com";
  assert.equal(
    asciiTrimPresentationTeamDirectoryLabel(`  ${contactName}  `),
    contactName
  );
  assert.equal(asciiTrimPresentationTeamDirectoryLabel(`\tAlex\n`), "Alex");
  assert.equal(
    normalizePresentationTeamDirectoryLabelToken(`  ${contactName}  `),
    contactName
  );
  assert.equal(
    canonicalizePresentationTeamDirectoryLabel(`  ${contactName}  `),
    contactName
  );
  assert.equal(
    presentationTeamDirectoryMemberLabel(`  ${contactName}  `, contactEmail),
    contactName
  );
  assert.equal(
    presentationTeamDirectoryMemberLabel(null, `  ${contactEmail}  `),
    contactEmail
  );
  assert.equal(
    presentationTeamDirectoryMemberLabel("", `  ${contactEmail}  `),
    contactEmail
  );
  assert.equal(
    presentationTeamDirectoryEmailLabel(`  ${contactEmail}  `),
    contactEmail
  );

  // Soft empty / Unicode-only space preserves intentional i18n fallbacks.
  assert.equal(normalizePresentationTeamDirectoryLabelToken(""), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken("   "), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken("\u2003"), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken("\u00a0"), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken(null), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken(undefined), null);
  assert.equal(presentationTeamDirectoryMemberLabel(null, null), null);
  assert.equal(presentationTeamDirectoryMemberLabel("\u2003", "\u00a0"), null);
  assert.equal(presentationTeamDirectoryEmailLabel(null), null);
  assert.equal(presentationTeamDirectoryEmailLabel("\u2003"), null);
});

test("MISE-005UA refuses Unicode-trim inventing of clean Team Settings directory labels", () => {
  const paddedName = "\u2003Alex Rivera\u2003";
  const nbspName = "\u00a0Alex Rivera\u00a0";
  const paddedEmail = "\u2003alex@example.com\u2003";
  const nbspEmail = "\u00a0alex@example.com\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Alex Rivera");
  assert.equal(nbspName.trim(), "Alex Rivera");
  assert.equal(paddedEmail.trim(), "alex@example.com");
  assert.equal(nbspEmail.trim(), "alex@example.com");
  assert.equal(paddedName.trim() || paddedEmail.trim(), "Alex Rivera");
  assert.equal("".trim() || paddedEmail.trim(), "alex@example.com");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationTeamDirectoryLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationTeamDirectoryLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationTeamDirectoryLabel(paddedName), null);
  assert.equal(canonicalizePresentationTeamDirectoryLabel(nbspName), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken(paddedName), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken(nbspName), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken(paddedEmail), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken(nbspEmail), null);
  assert.equal(presentationTeamDirectoryMemberLabel(paddedName, paddedEmail), null);
  assert.equal(presentationTeamDirectoryMemberLabel(nbspName, nbspEmail), null);
  assert.equal(
    presentationTeamDirectoryMemberLabel(paddedName, "alex@example.com"),
    "alex@example.com"
  );
  assert.equal(presentationTeamDirectoryEmailLabel(paddedEmail), null);
  assert.equal(presentationTeamDirectoryEmailLabel(nbspEmail), null);
});

test("MISE-005UA soft-nulls controls and preserves name-over-email preference", () => {
  assert.equal(normalizePresentationTeamDirectoryLabelToken("Alex\u0001Rivera"), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken("\u0007Chef"), null);
  assert.equal(normalizePresentationTeamDirectoryLabelToken("alex\u0001@example.com"), null);
  assert.equal(presentationTeamDirectoryEmailLabel("alex\u0001@example.com"), null);

  assert.equal(
    presentationTeamDirectoryMemberLabel("Maria Elena Lopez", "maria@example.com"),
    "Maria Elena Lopez"
  );
  assert.equal(
    presentationTeamDirectoryMemberLabel("  Jordan Lee  ", "jordan@example.com"),
    "Jordan Lee"
  );
  assert.equal(
    presentationTeamDirectoryMemberLabel(null, "  jordan@example.com  "),
    "jordan@example.com"
  );
  assert.equal(
    presentationTeamDirectoryMemberLabel("\u2003Alex\u2003", "  jordan@example.com  "),
    "jordan@example.com"
  );
  assert.equal(
    presentationTeamDirectoryEmailLabel("  jordan@example.com  "),
    "jordan@example.com"
  );
});

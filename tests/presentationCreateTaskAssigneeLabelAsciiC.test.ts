import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationCreateTaskAssigneeLabel,
  canonicalizePresentationCreateTaskAssigneeLabel,
  normalizePresentationCreateTaskAssigneeLabelToken,
  presentationCreateTaskAssigneeLabel
} from "../services/domain/presentationCreateTaskAssigneeLabelIdentity";

test("MISE-005TY pins Create Task assignee chip labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationCreateTaskAssigneeLabelIdentity.ts",
    "utf8"
  );
  const createTaskSource = readFileSync("app/more/create-task.tsx", "utf8");
  const teamSource = readFileSync("app/settings/team.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationCreateTaskAssigneeLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    createTaskSource,
    /presentationCreateTaskAssigneeLabel\(member\.name, member\.email\) \|\| t\("operatorTasks\.assignee\.teammate"\)/
  );
  assert.match(
    createTaskSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationCreateTaskAssigneeLabelIdentity"/
  );

  // Leave prior Unicode assignee label trim removed from Create Task.
  assert.doesNotMatch(
    createTaskSource,
    /member\.name\?\.trim\(\) \|\| member\.email\?\.trim\(\)/
  );

  // Do not share greeting / profile-initials / outreach / durable profile-name modules.
  assert.doesNotMatch(
    createTaskSource,
    /presentationGreetingFirstNameIdentity|presentationProfileInitialsIdentity|outreachGreetingFirstNameIdentity/
  );

  // Team directory labels stay on their own tip (do not absorb into this change).
  assert.match(
    teamSource,
    /member\.name\?\.trim\(\) \|\| member\.email\?\.trim\(\) \|\| t\("team\.member\.unnamed"\)/
  );
  assert.doesNotMatch(
    teamSource,
    /presentationCreateTaskAssigneeLabelIdentity|presentationCreateTaskAssigneeLabel/
  );

  const contactName = "Alex Rivera";
  const contactEmail = "alex@example.com";
  assert.equal(
    asciiTrimPresentationCreateTaskAssigneeLabel(`  ${contactName}  `),
    contactName
  );
  assert.equal(asciiTrimPresentationCreateTaskAssigneeLabel(`\tAlex\n`), "Alex");
  assert.equal(
    normalizePresentationCreateTaskAssigneeLabelToken(`  ${contactName}  `),
    contactName
  );
  assert.equal(
    canonicalizePresentationCreateTaskAssigneeLabel(`  ${contactName}  `),
    contactName
  );
  assert.equal(
    presentationCreateTaskAssigneeLabel(`  ${contactName}  `, contactEmail),
    contactName
  );
  assert.equal(
    presentationCreateTaskAssigneeLabel(null, `  ${contactEmail}  `),
    contactEmail
  );
  assert.equal(
    presentationCreateTaskAssigneeLabel("", `  ${contactEmail}  `),
    contactEmail
  );

  // Soft empty / Unicode-only space preserves intentional i18n teammate fallback.
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken(""), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken("   "), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken("\u2003"), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken("\u00a0"), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken(null), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken(undefined), null);
  assert.equal(presentationCreateTaskAssigneeLabel(null, null), null);
  assert.equal(presentationCreateTaskAssigneeLabel("\u2003", "\u00a0"), null);
});

test("MISE-005TY refuses Unicode-trim inventing of clean Create Task assignee labels", () => {
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
  assert.equal(asciiTrimPresentationCreateTaskAssigneeLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationCreateTaskAssigneeLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationCreateTaskAssigneeLabel(paddedName), null);
  assert.equal(canonicalizePresentationCreateTaskAssigneeLabel(nbspName), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken(paddedName), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken(nbspName), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken(paddedEmail), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken(nbspEmail), null);
  assert.equal(presentationCreateTaskAssigneeLabel(paddedName, paddedEmail), null);
  assert.equal(presentationCreateTaskAssigneeLabel(nbspName, nbspEmail), null);
  assert.equal(presentationCreateTaskAssigneeLabel(paddedName, "alex@example.com"), "alex@example.com");
});

test("MISE-005TY soft-nulls controls and preserves name-over-email preference", () => {
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken("Alex\u0001Rivera"), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken("\u0007Chef"), null);
  assert.equal(normalizePresentationCreateTaskAssigneeLabelToken("alex\u0001@example.com"), null);

  assert.equal(
    presentationCreateTaskAssigneeLabel("Maria Elena Lopez", "maria@example.com"),
    "Maria Elena Lopez"
  );
  assert.equal(
    presentationCreateTaskAssigneeLabel("  Jordan Lee  ", "jordan@example.com"),
    "Jordan Lee"
  );
  assert.equal(
    presentationCreateTaskAssigneeLabel(null, "  jordan@example.com  "),
    "jordan@example.com"
  );
  assert.equal(
    presentationCreateTaskAssigneeLabel("\u2003Alex\u2003", "  jordan@example.com  "),
    "jordan@example.com"
  );
});


import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimTaskDetailOperationalDetail,
  canonicalizeTaskDetailOperationalDetail,
  normalizeTaskDetailOperationalDetail
} from "../services/domain/presentationTaskDetailOperationalDetailIdentity";
import { presentOperationalTodayTask } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTaskDetailOperationalDetailIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const taskDetailSource = readFileSync(
  new URL("../app/tasks/[id].tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const presentationSource = readFileSync(
  new URL("../services/presentation/operationsPresentation.ts", import.meta.url),
  "utf8"
);
const operationalTitleIdentityPath = new URL(
  "../services/domain/presentationTaskDetailOperationalTitleIdentity.ts",
  import.meta.url
);
const sharedTitleIdentityPath = new URL(
  "../services/domain/presentationTaskDetailSharedTitleIdentity.ts",
  import.meta.url
);
const operatingPlanDetailIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskDetailIdentity.ts",
  import.meta.url
);

const detail = "Walk fridge before open";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005ZG pins Task detail operational presentation.detail to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZG/);
  assert.match(taskDetailSource, /MISE-005ZG/);

  assert.match(
    identitySource,
    /export function asciiTrimTaskDetailOperationalDetail\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTaskDetailOperationalDetailIdentity"/
  );
  assert.match(taskDetailSource, /normalizeTaskDetailOperationalDetail\(/);
  assert.match(
    taskDetailSource,
    /normalizeTaskDetailOperationalDetail\(presentation\.detail\)\s*\|\|\s*t\("tasks\.operational\.detail\.none"\)/
  );
  assert.doesNotMatch(
    taskDetailSource,
    /styles\.instructionsBody[^>]*>\s*\{presentation\.detail\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"tasks\.operational\.detail\.none": "Details"/);
  assert.match(catalogSource, /"tasks\.operational\.detail\.none": "Detalles"/);
  assert.match(catalogSource, /"tasks\.operational\.detail\.none": "详情"/);

  // Leave operational presentation.title as raw pass-through on this tip (#1160 owns that surface).
  assert.match(
    taskDetailSource,
    /styles\.title[^>]*>\s*\{presentation\.title\}\s*<\/Text>/
  );

  // Leave sharedTask.detail / sharedTask.title as raw pass-through on this tip.
  assert.match(
    taskDetailSource,
    /styles\.instructionsBody[^>]*>\s*\{sharedTask\.detail \?\? t\("tasks\.shared\.noInstructions"\)\}\s*<\/Text>/
  );
  assert.match(
    taskDetailSource,
    /styles\.title[^>]*>\s*\{sharedTask\.title\}\s*<\/Text>/
  );

  // Descriptor-absent inventing path still embeds raw task.detail into presentation.detail.
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*title: task\.title,\s*detail: `\$\{copy\.evidenceLabel\}: \$\{task\.detail\}`,/
  );

  // Do not pull in title / Timeline-detail / shared helpers on this tip.
  assert.doesNotMatch(taskDetailSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(taskDetailSource, /normalizeTaskDetailSharedTitle\(/);
  assert.doesNotMatch(taskDetailSource, /normalizeOperatingPlanTaskDetail\(/);
  assert.doesNotMatch(taskDetailSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(taskDetailSource, /presentationTaskDetailSharedTitleIdentity/);
  assert.doesNotMatch(taskDetailSource, /presentationOperatingPlanTaskDetailIdentity/);
  assert.equal(filePresence(operationalTitleIdentityPath), "absent");
  assert.equal(filePresence(sharedTitleIdentityPath), "absent");
  assert.equal(filePresence(operatingPlanDetailIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailSharedTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskDetailIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeTaskDetailOperationalDetail(detail), detail);
  assert.equal(normalizeTaskDetailOperationalDetail(` ${detail} `), detail);
  assert.equal(normalizeTaskDetailOperationalDetail(`Case-${detail}`), `Case-${detail}`);
  assert.equal(
    normalizeTaskDetailOperationalDetail(`Evidence: ${detail}`),
    `Evidence: ${detail}`
  );
});

test("descriptor-absent task.detail pass-through invents via trim and is soft-nulled on Task detail", () => {
  const padded = `${em}${detail}${em}`;
  const presented = presentOperationalTodayTask("en", {
    title: "Count walk-in",
    detail: padded
  });

  // Inventing proof: no presentation descriptor → evidence-prefixed raw task.detail.
  assert.equal(presented.detail, `Evidence: ${padded}`);
  assert.equal(presented.evidenceOnly, true);
  assert.equal(padded.trim(), detail);
  assert.equal(presented.detail.trim(), `Evidence: ${em}${detail}`);
  assert.equal(Boolean(presented.detail), true);

  // ASCII C prep refuses that inventing equality before Task detail instructions render.
  assert.equal(asciiTrimTaskDetailOperationalDetail(presented.detail), presented.detail);
  assert.equal(canonicalizeTaskDetailOperationalDetail(presented.detail), null);
  assert.equal(normalizeTaskDetailOperationalDetail(presented.detail), null);
  assert.equal(
    normalizeTaskDetailOperationalDetail(presented.detail) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Task detail operational details", () => {
  const padded = `${em}${detail}${em}`;
  const nbspDetail = `${nbsp}${detail}${nbsp}`;
  const internalEm = `Walk${em}fridge before open`;
  const internalNbsp = `Walk${nbsp}fridge before open`;

  // Inventing proof: Unicode trim would invent the clean task detail.
  assert.equal(padded.trim(), detail);
  assert.equal(nbspDetail.trim(), detail);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspDetail), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimTaskDetailOperationalDetail(padded), padded);
  assert.equal(canonicalizeTaskDetailOperationalDetail(padded), null);
  assert.equal(canonicalizeTaskDetailOperationalDetail(nbspDetail), null);
  assert.equal(normalizeTaskDetailOperationalDetail(padded), null);
  assert.equal(normalizeTaskDetailOperationalDetail(nbspDetail), null);
  assert.equal(normalizeTaskDetailOperationalDetail(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeTaskDetailOperationalDetail(internalEm), internalEm);
  assert.equal(normalizeTaskDetailOperationalDetail(internalNbsp), internalNbsp);
  assert.equal(normalizeTaskDetailOperationalDetail(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Task detail operational details", () => {
  assert.equal(normalizeTaskDetailOperationalDetail(undefined), null);
  assert.equal(normalizeTaskDetailOperationalDetail(null), null);
  assert.equal(normalizeTaskDetailOperationalDetail(""), null);
  assert.equal(normalizeTaskDetailOperationalDetail("   "), null);
  assert.equal(normalizeTaskDetailOperationalDetail(123 as unknown as string), null);
  assert.equal(normalizeTaskDetailOperationalDetail(`\u0001${detail}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeTaskDetailOperationalDetail(`${detail}\t`), detail);
  assert.equal(normalizeTaskDetailOperationalDetail(`${detail}\u0007`), null);
  assert.equal(normalizeTaskDetailOperationalDetail(em), null);
  // LF/TAB/CR are rejected for single-line details (full cntrl; no multiline allowlist).
  assert.equal(normalizeTaskDetailOperationalDetail(`Walk\tfridge before open`), null);
  assert.equal(normalizeTaskDetailOperationalDetail(`Walk\nfridge before open`), null);
});

test("Task detail operational detail bypass proof: empty and Unicode-only-space details soft-null to localized none", () => {
  // Prior always-pass-detail path still rendered blank-looking instructions Text.
  assert.equal(normalizeTaskDetailOperationalDetail(""), null);
  assert.equal(normalizeTaskDetailOperationalDetail(em), null);
  assert.equal(normalizeTaskDetailOperationalDetail(nbsp), null);

  // Descriptor-absent evidence prefix with Unicode-only free-text still soft-nulls.
  const blankLooking = presentOperationalTodayTask("en", {
    title: "Count walk-in",
    detail: em
  });
  assert.equal(blankLooking.detail, `Evidence: ${em}`);
  assert.equal(Boolean(blankLooking.detail), true);
  assert.equal(normalizeTaskDetailOperationalDetail(blankLooking.detail), null);

  const missingDetail: string | null | undefined = undefined;
  const unicodeOnlyDetail: string | null | undefined = em;
  assert.equal(missingDetail ?? "", "");
  assert.equal(unicodeOnlyDetail ?? "", em);
  assert.notEqual(unicodeOnlyDetail ?? "", "");
  assert.equal(Boolean(unicodeOnlyDetail), true);
  assert.match(
    taskDetailSource,
    /normalizeTaskDetailOperationalDetail\(presentation\.detail\)\s*\|\|\s*t\("tasks\.operational\.detail\.none"\)/
  );
});

test("Task detail operational presentation.detail identity refuses Unicode inventing equality", () => {
  const padded = `${em}${detail}${em}`;
  assert.notEqual(asciiTrimTaskDetailOperationalDetail(padded), padded.trim());
  assert.equal(normalizeTaskDetailOperationalDetail(padded), null);
  assert.equal(normalizeTaskDetailOperationalDetail(padded) || "Details", "Details");
  assert.equal(normalizeTaskDetailOperationalDetail(`\t${detail}\n`), detail);
});

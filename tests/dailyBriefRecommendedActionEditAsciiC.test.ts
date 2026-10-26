import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalDailyBriefRecommendedActionEdit,
  DAILY_BRIEF_RECOMMENDED_ACTION_EDIT_MAX_CHARACTERS,
  normalizeDailyBriefRecommendedActionEdit
} from "../services/domain/dailyBriefRecommendedActionEditIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/dailyBriefRecommendedActionEditIdentity.ts", import.meta.url),
  "utf8"
);
const boardSource = readFileSync(
  new URL("../components/dailyBrief/DailyBriefBoard.tsx", import.meta.url),
  "utf8"
);
const findingDecisionsSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

const action = "Order chicken before lunch service.";
const accentedAction = "Pedir pollo antes del servicio de almuerzo.";
const multilineAction = "Order chicken before lunch.\nKeep cold.\tConfirm walk-in.";

test("MISE-005QX pins Daily Brief recommended-action edits to ASCII C", () => {
  assert.match(identitySource, /MISE-005QX/);
  assert.match(boardSource, /MISE-005QX/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /export function canonicalDailyBriefRecommendedActionEdit\(value: string\) \{/
  );
  assert.equal(DAILY_BRIEF_RECOMMENDED_ACTION_EDIT_MAX_CHARACTERS, 320);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalDailyBriefRecommendedActionEdit"),
    identitySource.indexOf("function hasUnsafeMultilineControls")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/dailyBriefRecommendedActionEditIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefRecommendedActionEdit\(editText\)/);
  assert.match(
    boardSource,
    /normalizeDailyBriefRecommendedActionEdit\(\s*finding\.recommendedAction/
  );

  const saveEditBody = boardSource.slice(
    boardSource.indexOf('title={t("dailyBrief.action.saveEdit")}'),
    boardSource.indexOf('title={t("dailyBrief.action.cancelEdit")}')
  );
  assert.doesNotMatch(saveEditBody, /editText\.trim\(\)/);
  assert.doesNotMatch(saveEditBody, /finding\.recommendedAction\.trim\(\)/);
  assert.doesNotMatch(saveEditBody, /next\.length > 320/);

  // Open #832 owns durable domain recommendedAction ASCII C; leave requireBoundedText alone.
  assert.match(findingDecisionsSource, /requireBoundedText/);

  // Do not rewrite sibling free-text or domain recommended-action tips through this module.
  assert.doesNotMatch(identitySource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /taskCompletionEvidenceNoteIdentity/);
  assert.doesNotMatch(identitySource, /askMiseQuestionIdentity/);
  assert.doesNotMatch(identitySource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(boardSource, /requireCanonicalOperationalFindingEditedRecommendedAction/);
  assert.doesNotMatch(boardSource, /normalizeTaskCompletionEvidenceNote/);
});

test("ASCII trim keeps ordinary Daily Brief recommended-action edits stable", () => {
  assert.equal(canonicalDailyBriefRecommendedActionEdit(`  ${action}  `), action);
  assert.equal(canonicalDailyBriefRecommendedActionEdit(`\t${action}\n`), action);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(`  ${action}  `), action);

  assert.equal(canonicalDailyBriefRecommendedActionEdit(accentedAction), accentedAction);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(accentedAction), accentedAction);

  assert.equal(canonicalDailyBriefRecommendedActionEdit(multilineAction), multilineAction);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(multilineAction), multilineAction);
});

test("NBSP folds and em-space padding cannot invent Daily Brief recommended-action edits", () => {
  const nbspAction = `\u00a0${action}\u00a0`;
  const emAction = `\u2003${action}\u2003`;
  const internalEm = `Order\u2003chicken before lunch service.`;
  const internalNbsp = `Order\u00a0chicken before lunch service.`;
  const emMultiline = `\u2003${multilineAction}\u2003`;

  assert.equal(nbspAction.trim(), action);
  assert.equal(canonicalDailyBriefRecommendedActionEdit(nbspAction), action);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(nbspAction), action);
  assert.equal(
    canonicalDailyBriefRecommendedActionEdit(internalNbsp),
    "Order chicken before lunch service."
  );

  // Unicode em-space trim invents a clean recommended action; C free-text prep does not.
  assert.equal(emAction.trim(), action);
  assert.notEqual(canonicalDailyBriefRecommendedActionEdit(emAction), action);
  assert.equal(canonicalDailyBriefRecommendedActionEdit(emAction), emAction);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(emAction), emAction);
  assert.notEqual(normalizeDailyBriefRecommendedActionEdit(emAction), action);

  // Unchanged gate must not invent equality between em-padded edit and clean current.
  assert.equal(emAction.trim(), action.trim());
  assert.notEqual(
    normalizeDailyBriefRecommendedActionEdit(emAction),
    normalizeDailyBriefRecommendedActionEdit(action)
  );

  assert.equal(canonicalDailyBriefRecommendedActionEdit(internalEm), internalEm);
  assert.notEqual(
    canonicalDailyBriefRecommendedActionEdit(internalEm),
    canonicalDailyBriefRecommendedActionEdit(action)
  );

  assert.equal(emMultiline.trim(), multilineAction);
  assert.notEqual(canonicalDailyBriefRecommendedActionEdit(emMultiline), multilineAction);
  assert.equal(canonicalDailyBriefRecommendedActionEdit(emMultiline), emMultiline);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(emMultiline), emMultiline);

  assert.equal(
    canonicalDailyBriefRecommendedActionEdit("Kelvin recommended action"),
    "Kelvin recommended action"
  );
});

test("Soft empty, over-long, and unsafe controls omit Daily Brief edits without inventing", () => {
  assert.equal(normalizeDailyBriefRecommendedActionEdit(null), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(undefined), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(""), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit("   "), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit("\t\n"), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit("\u2003"), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit("\u00a0"), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit("\u2003\u00a0\u2003"), null);

  assert.equal(normalizeDailyBriefRecommendedActionEdit(`\u0000${action}`), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(`${action}\u0007`), null);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(`${action}\u007f`), null);

  // LF/TAB/CR remain allowed inside recommended-action prose.
  assert.equal(
    normalizeDailyBriefRecommendedActionEdit("Line one.\nLine two.\tKeep."),
    "Line one.\nLine two.\tKeep."
  );

  const overLong = "x".repeat(DAILY_BRIEF_RECOMMENDED_ACTION_EDIT_MAX_CHARACTERS + 1);
  assert.equal(normalizeDailyBriefRecommendedActionEdit(overLong), null);
  assert.equal(
    normalizeDailyBriefRecommendedActionEdit(
      "x".repeat(DAILY_BRIEF_RECOMMENDED_ACTION_EDIT_MAX_CHARACTERS)
    ),
    "x".repeat(DAILY_BRIEF_RECOMMENDED_ACTION_EDIT_MAX_CHARACTERS)
  );
});

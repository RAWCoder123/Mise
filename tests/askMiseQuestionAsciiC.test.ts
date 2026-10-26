import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalAskMiseQuestionText,
  normalizeAskMiseQuestion
} from "../services/domain/askMiseQuestionIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/askMiseQuestionIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseScreenSource = readFileSync(
  new URL("../app/ask-mise.tsx", import.meta.url),
  "utf8"
);
const askMiseAiSource = readFileSync(
  new URL("../services/ai/askMise.ts", import.meta.url),
  "utf8"
);

const question = "What stock is low?";
const accentedQuestion = "¿Qué inventario está bajo?";
const multilineQuestion = "What stock is low?\nCheck herbs.\tKeep cold.";

test("MISE-005QS pins Ask Mise question identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005QS/);
  assert.match(askMiseScreenSource, /MISE-005QS/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /export function canonicalAskMiseQuestionText\(value: string\) \{/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalAskMiseQuestionText"),
    identitySource.indexOf("function hasUnsafeMultilineControls")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    askMiseScreenSource,
    /from "\.\.\/services\/domain\/askMiseQuestionIdentity"/
  );
  assert.match(askMiseScreenSource, /normalizeAskMiseQuestion\(question\)/);

  const askBody = askMiseScreenSource.slice(
    askMiseScreenSource.indexOf("const ask = useCallback"),
    askMiseScreenSource.indexOf("revealLatestMessage();", askMiseScreenSource.indexOf("const ask = useCallback")) +
      "revealLatestMessage();".length
  );
  assert.doesNotMatch(askBody, /question\.trim\(\)/);
  assert.doesNotMatch(askBody, /const trimmed = /);

  // Leave open Ask Mise intent-classify tip #700 on its existing Unicode-trim
  // + toLowerCase contract until that tip lands its ASCII C haystack.
  assert.match(askMiseAiSource, /const normalized = question\.trim\(\)\.toLowerCase\(\);/);

  // Do not rewrite sibling free-text or intent tips through this module.
  assert.doesNotMatch(identitySource, /dailyOpsAskBriefingIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanWhyIdentity/);
  assert.doesNotMatch(identitySource, /outreachDraftTextIdentity/);
  assert.doesNotMatch(identitySource, /normalizeAskMiseIntentToken/);
  assert.doesNotMatch(identitySource, /askMiseIntentHaystack/);
  assert.doesNotMatch(identitySource, /from ["']\.\.\/ai\/askMise["']/);
  assert.doesNotMatch(askMiseScreenSource, /normalizeAskMiseIntentToken/);
  assert.doesNotMatch(askMiseScreenSource, /askMiseIntentHaystack/);
});

test("ASCII trim keeps ordinary Ask Mise question padding stable", () => {
  assert.equal(canonicalAskMiseQuestionText(`  ${question}  `), question);
  assert.equal(canonicalAskMiseQuestionText(`\t${question}\n`), question);
  assert.equal(normalizeAskMiseQuestion(`  ${question}  `), question);

  assert.equal(canonicalAskMiseQuestionText(accentedQuestion), accentedQuestion);
  assert.equal(normalizeAskMiseQuestion(accentedQuestion), accentedQuestion);

  assert.equal(canonicalAskMiseQuestionText(multilineQuestion), multilineQuestion);
  assert.equal(normalizeAskMiseQuestion(multilineQuestion), multilineQuestion);
});

test("NBSP folds and em-space padding cannot invent Ask Mise question tokens", () => {
  const nbspQuestion = `\u00a0${question}\u00a0`;
  const emQuestion = `\u2003${question}\u2003`;
  const internalEm = `What\u2003stock is low?`;
  const internalNbsp = `What\u00a0stock is low?`;
  const emMultiline = `\u2003${multilineQuestion}\u2003`;

  assert.equal(nbspQuestion.trim(), question);
  assert.equal(canonicalAskMiseQuestionText(nbspQuestion), question);
  assert.equal(normalizeAskMiseQuestion(nbspQuestion), question);
  assert.equal(canonicalAskMiseQuestionText(internalNbsp), "What stock is low?");

  // Unicode em-space trim invents a clean question; C free-text prep does not.
  assert.equal(emQuestion.trim(), question);
  assert.notEqual(canonicalAskMiseQuestionText(emQuestion), question);
  assert.equal(canonicalAskMiseQuestionText(emQuestion), emQuestion);
  assert.equal(normalizeAskMiseQuestion(emQuestion), emQuestion);
  assert.notEqual(normalizeAskMiseQuestion(emQuestion), question);

  assert.equal(canonicalAskMiseQuestionText(internalEm), internalEm);
  assert.notEqual(
    canonicalAskMiseQuestionText(internalEm),
    canonicalAskMiseQuestionText(question)
  );

  assert.equal(emMultiline.trim(), multilineQuestion);
  assert.notEqual(canonicalAskMiseQuestionText(emMultiline), multilineQuestion);
  assert.equal(canonicalAskMiseQuestionText(emMultiline), emMultiline);
  assert.equal(normalizeAskMiseQuestion(emMultiline), emMultiline);

  assert.equal(
    canonicalAskMiseQuestionText("Kelvin stock question"),
    "Kelvin stock question"
  );
});

test("Soft empty and unsafe controls omit Ask Mise questions without inventing", () => {
  assert.equal(normalizeAskMiseQuestion(null), null);
  assert.equal(normalizeAskMiseQuestion(undefined), null);
  assert.equal(normalizeAskMiseQuestion(""), null);
  assert.equal(normalizeAskMiseQuestion("   "), null);
  assert.equal(normalizeAskMiseQuestion("\t\n"), null);
  assert.equal(normalizeAskMiseQuestion("\u2003"), null);
  assert.equal(normalizeAskMiseQuestion("\u00a0"), null);
  assert.equal(normalizeAskMiseQuestion("\u2003\u00a0\u2003"), null);

  assert.equal(normalizeAskMiseQuestion(`\u0000${question}`), null);
  assert.equal(normalizeAskMiseQuestion(`${question}\u0007`), null);
  assert.equal(normalizeAskMiseQuestion(`${question}\u007f`), null);

  // LF/TAB/CR remain allowed inside Ask Mise question prose.
  assert.equal(
    normalizeAskMiseQuestion("Line one.\nLine two.\tKeep."),
    "Line one.\nLine two.\tKeep."
  );
});

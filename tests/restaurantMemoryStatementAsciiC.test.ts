import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { measureOutcome } from "../services/domain/miseActions";
import {
  correctMemory,
  createMemory,
  createMemoryFromOutcome,
  restaurantMemoryFromPersistedRow,
  type PersistedRestaurantMemoryRow
} from "../services/domain/restaurantMemory";
import {
  canonicalRestaurantMemoryStatement,
  normalizeCanonicalRestaurantMemoryStatement,
  requireCanonicalRestaurantMemoryStatement
} from "../services/domain/restaurantMemoryStatementIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantMemoryStatementIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantMemory.ts", import.meta.url),
  "utf8"
);
const miseActionsSource = readFileSync(
  new URL("../services/domain/miseActions.ts", import.meta.url),
  "utf8"
);

const restaurantId = "rest_memory_statement";
const statement = "Friday dinner demand is typically 18% higher.";
const multilineStatement =
  "Friday dinner demand is typically 18% higher.\nCarry the same buffer Saturday.\nOwner note attached.";
const accentedStatement =
  "La demanda del viernes por la noche suele ser un 18% más alta.";
const lesson = "Owner usually increases chicken orders by about 10%.";

const evidence = [
  {
    type: "sales_window",
    id: "fri_4w",
    summary: "Last four Fridays above weekday baseline",
    observedAt: "2026-08-01T12:00:00.000Z"
  }
] as const;

function basePersistedRow(
  overrides: Partial<PersistedRestaurantMemoryRow> = {}
): PersistedRestaurantMemoryRow {
  return {
    id: "memory-1",
    restaurant_id: restaurantId,
    memory_type: "demand_pattern",
    statement,
    evidence: [...evidence],
    confidence: 0.4,
    first_observed_at: "2026-08-01T12:00:00.000Z",
    last_updated_at: "2026-08-02T12:00:00.000Z",
    scope: "restaurant",
    source: "mise_learning",
    status: "active",
    affects_recommendations: true,
    affects_automation: false,
    correction: null,
    ...overrides
  };
}

test("MISE-005OV pins restaurant-memory statement free-text to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005OV/);
  assert.match(domainSource, /MISE-005OV/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalRestaurantMemoryStatement("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  // Free-text must not collapse internal C whitespace the way title/display-name tips do.
  assert.doesNotMatch(canonicalBody, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.doesNotMatch(canonicalBody, /\.replace\(C_WHITESPACE/);

  assert.match(domainSource, /requireCanonicalRestaurantMemoryStatement\(value\)/);
  assert.match(
    domainSource,
    /normalizeCanonicalRestaurantMemoryStatement\(options\.statement\)/
  );
  assert.match(
    domainSource,
    /normalizeCanonicalRestaurantMemoryStatement\(outcome\.lesson\)/
  );
  assert.match(
    domainSource,
    /normalizeCanonicalRestaurantMemoryStatement\(\s*row\.correction\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantMemoryStatementIdentity"/);
  assert.doesNotMatch(domainSource, /outcome\.lesson\?\.trim\(\)/);
  assert.doesNotMatch(domainSource, /options\.statement\?\.trim\(\)/);
  assert.doesNotMatch(domainSource, /row\.correction\?\.trim\(\)/);
  assert.doesNotMatch(domainSource, /\.trim\(\)\.replace\(\/\\s\+\/g, " "\)/);

  // Leave sibling restaurantId / scope / source Unicode trim alone.
  assert.match(domainSource, /const normalized = restaurantId\.trim\(\);/);
  assert.match(
    domainSource,
    /scope: \(input\.scope \?\? "restaurant"\)\.trim\(\) \|\| "restaurant"/
  );
  assert.match(
    domainSource,
    /source: \(input\.source \?\? "mise_learning"\)\.trim\(\) \|\| "mise_learning"/
  );
  // Leave hydrate correctionNote raw pass-through alone.
  assert.match(domainSource, /correctionNote: row\.correction \?\? null/);
  // Leave learning-signal label/detail Unicode trim filters alone.
  assert.match(
    domainSource,
    /\.filter\(\(signal\) => signal\.label\.trim\(\) && signal\.detail\.trim\(\)\)/
  );
  // Leave mise-actions measureOutcome lesson on main Unicode trim until #829 lands.
  assert.match(miseActionsSource, /lesson: input\.lesson\?\.trim\(\) \|\| null/);

  assert.doesNotMatch(identitySource, /miseActionsLessonIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(domainSource, /miseActionsLessonIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(domainSource, /inventoryCountLineNoteIdentity/);
});

test("ASCII C multiline prep keeps ordinary restaurant-memory statements stable", () => {
  assert.equal(canonicalRestaurantMemoryStatement(`  ${statement}  `), statement);
  assert.equal(canonicalRestaurantMemoryStatement(`\t${statement}\n`), statement);
  assert.equal(requireCanonicalRestaurantMemoryStatement(`  ${statement}  `), statement);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement(`  ${statement}  `), statement);
  assert.equal(canonicalRestaurantMemoryStatement(accentedStatement), accentedStatement);
  assert.equal(requireCanonicalRestaurantMemoryStatement(accentedStatement), accentedStatement);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalRestaurantMemoryStatement(multilineStatement), multilineStatement);
  assert.equal(requireCanonicalRestaurantMemoryStatement(multilineStatement), multilineStatement);
  assert.equal(
    normalizeCanonicalRestaurantMemoryStatement(multilineStatement),
    multilineStatement
  );

  const memory = createMemory({
    restaurantId,
    memoryType: "demand_pattern",
    statement: `  ${statement}  `,
    evidence,
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(memory.statement, statement);

  const multilineMemory = createMemory({
    restaurantId,
    memoryType: "demand_pattern",
    statement: multilineStatement,
    evidence,
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(multilineMemory.statement, multilineStatement);

  const outcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson
  });
  const outcomeMemory = createMemoryFromOutcome(restaurantId, outcome, {
    statement: `  ${statement}  `
  });
  assert.equal(outcomeMemory.statement, statement);

  const lessonMemory = createMemoryFromOutcome(restaurantId, outcome);
  assert.equal(lessonMemory.statement, lesson);

  const hydrated = restaurantMemoryFromPersistedRow(
    basePersistedRow({ correction: `  ${statement}  ` })
  );
  assert.equal(hydrated.statement, statement);
});

test("NBSP folds and em-space padding cannot invent restaurant-memory statements", () => {
  const nbspStatement = `\u00a0${statement}\u00a0`;
  const emStatement = `\u2003${statement}\u2003`;
  const internalEm = `Friday\u2003dinner demand`;
  const internalNbsp = `Friday\u00a0dinner demand`;
  const emMultiline = `\u2003${multilineStatement}\u2003`;
  const emLesson = `\u2003${lesson}\u2003`;

  // Pasted NBSP is folded like MISE-005B / #821 / #823 / #824 / #827 / #828 / #829.
  assert.equal(nbspStatement.trim(), statement);
  assert.equal(canonicalRestaurantMemoryStatement(nbspStatement), statement);
  assert.equal(requireCanonicalRestaurantMemoryStatement(nbspStatement), statement);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement(nbspStatement), statement);
  assert.equal(canonicalRestaurantMemoryStatement(internalNbsp), "Friday dinner demand");

  const nbspMemory = createMemory({
    restaurantId,
    memoryType: "demand_pattern",
    statement: nbspStatement,
    evidence,
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(nbspMemory.statement, statement);

  // Unicode em-space trim invents a clean statement; C free-text prep does not.
  assert.equal(emStatement.trim(), statement);
  assert.equal(emStatement.trim().replace(/\s+/g, " "), statement);
  assert.notEqual(canonicalRestaurantMemoryStatement(emStatement), statement);
  assert.equal(canonicalRestaurantMemoryStatement(emStatement), emStatement);
  assert.equal(requireCanonicalRestaurantMemoryStatement(emStatement), emStatement);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement(emStatement), emStatement);

  const emMemory = createMemory({
    restaurantId,
    memoryType: "demand_pattern",
    statement: emStatement,
    evidence,
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(emMemory.statement, emStatement);
  assert.notEqual(emMemory.statement, statement);

  assert.equal(canonicalRestaurantMemoryStatement(internalEm), internalEm);
  assert.notEqual(
    canonicalRestaurantMemoryStatement(internalEm),
    canonicalRestaurantMemoryStatement("Friday dinner demand")
  );

  assert.equal(emMultiline.trim().replace(/\s+/g, " "), multilineStatement.replace(/\n/g, " "));
  assert.notEqual(canonicalRestaurantMemoryStatement(emMultiline), multilineStatement);
  assert.equal(canonicalRestaurantMemoryStatement(emMultiline), emMultiline);
  assert.equal(requireCanonicalRestaurantMemoryStatement(emMultiline), emMultiline);

  const emMultilineMemory = createMemory({
    restaurantId,
    memoryType: "demand_pattern",
    statement: emMultiline,
    evidence,
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(emMultilineMemory.statement, emMultiline);

  // createMemoryFromOutcome must not invent from em-padded lesson / statement.
  const plainOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson
  });
  // On main, measureOutcome still Unicode-trims lesson (#829 open). Build a
  // synthetic outcome that retains em-padding so the restaurantMemory consumer
  // inventing path is isolated from mise-actions lesson prep.
  const paddedLessonOutcome = { ...plainOutcome, lesson: emLesson };
  assert.equal(emLesson.trim(), lesson);
  const emLessonMemory = createMemoryFromOutcome(restaurantId, paddedLessonOutcome);
  assert.equal(emLessonMemory.statement, emLesson);
  assert.notEqual(emLessonMemory.statement, lesson);

  const emStatementMemory = createMemoryFromOutcome(restaurantId, plainOutcome, {
    statement: emStatement
  });
  assert.equal(emStatementMemory.statement, emStatement);
  assert.notEqual(emStatementMemory.statement, statement);

  const emHydrated = restaurantMemoryFromPersistedRow(
    basePersistedRow({ correction: emStatement })
  );
  assert.equal(emHydrated.statement, emStatement);
  assert.notEqual(emHydrated.statement, statement);
  // Raw correction column remains pass-through on correctionNote.
  assert.equal(emHydrated.correctionNote, emStatement);

  const corrected = correctMemory(emMemory, emStatement);
  assert.equal(corrected.statement, emStatement);
  assert.equal(corrected.correctionNote, emStatement);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalRestaurantMemoryStatement("Kelvin dinner pattern"),
    "Kelvin dinner pattern"
  );
  assert.notEqual(
    canonicalRestaurantMemoryStatement("Kelvin dinner pattern"),
    canonicalRestaurantMemoryStatement("Kelvin dinner pattern")
  );
});

test("restaurant-memory statements require non-empty; soft-null optional; unsafe fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantMemoryStatement(null), null);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement(undefined), null);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement(""), null);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement("   "), null);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement("\u2003"), null);
  assert.equal(normalizeCanonicalRestaurantMemoryStatement("\n\t\r"), null);

  assert.throws(
    () => requireCanonicalRestaurantMemoryStatement("   "),
    /Restaurant memory requires a non-empty statement\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryStatement("\u2003"),
    /Restaurant memory requires a non-empty statement\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryStatement(null),
    /Restaurant memory requires a non-empty statement\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryStatement(12),
    /Restaurant memory requires a non-empty statement\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryStatement("bad\u0000statement"),
    /Restaurant memory statement is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalRestaurantMemoryStatement("bad\u0000statement"),
    /Restaurant memory statement is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalRestaurantMemoryStatement(12),
    /Restaurant memory statement is invalid\./
  );

  assert.throws(
    () =>
      createMemory({
        restaurantId,
        memoryType: "demand_pattern",
        statement: "\u2003",
        evidence,
        now: "2026-08-02T12:00:00.000Z"
      }),
    /Restaurant memory requires a non-empty statement\./
  );

  const emptyLessonOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: "   "
  });
  assert.throws(
    () => createMemoryFromOutcome(restaurantId, emptyLessonOutcome),
    /Outcome memories require a lesson or explicit statement\./
  );
  assert.throws(
    () =>
      createMemoryFromOutcome(restaurantId, emptyLessonOutcome, {
        statement: "\u2003"
      }),
    /Outcome memories require a lesson or explicit statement\./
  );

  // Soft-empty correction falls through to the stored statement on hydrate.
  const hydrated = restaurantMemoryFromPersistedRow(
    basePersistedRow({ correction: "\u2003" })
  );
  assert.equal(hydrated.statement, statement);
  assert.equal(hydrated.correctionNote, "\u2003");

  // Prior write cap truncates at 320 without inventing via trim.
  const longBody = `${"a".repeat(400)} end`;
  assert.ok(longBody.length > 320);
  assert.equal(
    requireCanonicalRestaurantMemoryStatement(longBody),
    longBody.slice(0, 320)
  );
  const longMemory = createMemory({
    restaurantId,
    memoryType: "demand_pattern",
    statement: longBody,
    evidence,
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(longMemory.statement.length, 320);
  assert.equal(longMemory.statement, longBody.slice(0, 320));
});

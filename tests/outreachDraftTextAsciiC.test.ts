import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseOutreachDraft } from "../services/ai/outreachDraft";
import {
  canonicalOutreachDraftText,
  normalizeCanonicalOutreachDraftText
} from "../services/domain/outreachDraftTextIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/outreachDraftTextIdentity.ts", import.meta.url),
  "utf8"
);
const draftSource = readFileSync(
  new URL("../services/ai/outreachDraft.ts", import.meta.url),
  "utf8"
);

const subject = "A simpler prep rhythm";
const body = "Hi Corner Cafe team,\n\nWould a short walkthrough be useful?";
const personalizationNote = "Used only supplied business details.";
const accentedBody = "Hola equipo mañana";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005QN pins outreach draft requireBoundedText to ASCII C", () => {
  assert.match(identitySource, /MISE-005QN/);
  assert.match(draftSource, /MISE-005QN/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOutreachDraftText("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    draftSource,
    /normalizeCanonicalOutreachDraftText\(value, fieldName, maximumLength\)/
  );
  assert.match(
    draftSource,
    /from "\.\.\/domain\/outreachDraftTextIdentity"/
  );

  const requireBody = draftSource.slice(
    draftSource.indexOf("function requireBoundedText("),
    draftSource.length
  );
  assert.doesNotMatch(requireBody, /value\.trim\(\)/);
  assert.match(requireBody, /MISE-005QN/);

  // Leave lead requireText (#873), mailbox (#420), and Edge string (#724) alone.
  assert.doesNotMatch(identitySource, /outreachLeadTextIdentity/);
  assert.doesNotMatch(identitySource, /outreachStringIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/outreach"/);
  assert.doesNotMatch(identitySource, /from "\.\/accountAuth"/);
  assert.doesNotMatch(draftSource, /outreachLeadTextIdentity/);
  assert.doesNotMatch(draftSource, /outreachStringIdentity/);
});

test("ASCII C prep keeps ordinary outreach draft text padding stable", () => {
  assert.equal(canonicalOutreachDraftText(`  ${subject}  `), subject);
  assert.equal(canonicalOutreachDraftText(`\t${body}\n`), body);
  assert.equal(
    normalizeCanonicalOutreachDraftText(`  ${subject}  `, "subject", 78),
    subject
  );
  assert.equal(
    normalizeCanonicalOutreachDraftText(`  ${body}  `, "body", 1_200),
    body
  );
  assert.equal(
    normalizeCanonicalOutreachDraftText(
      `  ${personalizationNote}  `,
      "personalization_note",
      240
    ),
    personalizationNote
  );
  assert.equal(canonicalOutreachDraftText(accentedBody), accentedBody);

  assert.deepEqual(
    parseOutreachDraft({
      subject: `  ${subject}  `,
      body: `  ${body}  `,
      personalization_note: `  ${personalizationNote}  `
    }),
    {
      subject,
      body,
      personalizationNote
    }
  );
});

test("NBSP folds and em-space padding cannot invent outreach draft text", () => {
  const nbspSubject = `${nbsp}${subject}${nbsp}`;
  const emSubject = `${em}${subject}${em}`;
  const emBody = `${em}${body}${em}`;
  const emNote = `${em}${personalizationNote}${em}`;
  const internalEm = `Hi\u2003team`;
  const internalNbsp = `Hi\u00a0team`;

  // Pasted NBSP is folded like MISE-005PF / MISE-005PT free-text prep.
  assert.equal(nbspSubject.trim(), subject);
  assert.equal(canonicalOutreachDraftText(nbspSubject), subject);
  assert.equal(
    normalizeCanonicalOutreachDraftText(nbspSubject, "subject", 78),
    subject
  );
  assert.equal(canonicalOutreachDraftText(internalNbsp), "Hi team");

  // Unicode em-space trim invents a clean token; C free-text prep does not.
  assert.equal(emSubject.trim(), subject);
  assert.notEqual(canonicalOutreachDraftText(emSubject), subject);
  assert.equal(canonicalOutreachDraftText(emSubject), emSubject);
  assert.equal(
    normalizeCanonicalOutreachDraftText(emSubject, "subject", 78),
    emSubject
  );
  assert.notEqual(
    normalizeCanonicalOutreachDraftText(emSubject, "subject", 78),
    subject
  );

  assert.equal(emBody.trim(), body);
  assert.notEqual(canonicalOutreachDraftText(emBody), body);
  assert.equal(canonicalOutreachDraftText(emBody), emBody);

  const drafted = parseOutreachDraft({
    subject: emSubject,
    body: emBody,
    personalization_note: emNote
  });
  assert.equal(drafted.subject, emSubject);
  assert.equal(drafted.body, emBody);
  assert.equal(drafted.personalizationNote, emNote);
  assert.notEqual(drafted.subject, subject);
  assert.notEqual(drafted.body, body);
  assert.notEqual(drafted.personalizationNote, personalizationNote);

  assert.equal(canonicalOutreachDraftText(internalEm), internalEm);
  assert.notEqual(
    canonicalOutreachDraftText(internalEm),
    canonicalOutreachDraftText("Hi team")
  );

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalOutreachDraftText("Kelvin walkthrough"),
    "Kelvin walkthrough"
  );
  assert.notEqual(
    canonicalOutreachDraftText("Kelvin walkthrough"),
    canonicalOutreachDraftText("Kelvin walkthrough")
  );
});

test("soft empty and unsafe control outreach draft text fail closed without inventing", () => {
  assert.throws(
    () => normalizeCanonicalOutreachDraftText("   ", "subject", 78),
    /subject must contain 1-78 characters/
  );
  assert.throws(
    () => normalizeCanonicalOutreachDraftText(`${em}${em}`, "subject", 78),
    /subject must contain 1-78 characters/
  );
  assert.throws(
    () => normalizeCanonicalOutreachDraftText(`${nbsp}`, "body", 1_200),
    /body must contain 1-1200 characters/
  );
  assert.throws(
    () => normalizeCanonicalOutreachDraftText(12 as unknown, "subject", 78),
    /subject must be text/
  );
  assert.throws(
    () =>
      normalizeCanonicalOutreachDraftText(
        `\u0000${subject}`,
        "subject",
        78
      ),
    /subject must be text/
  );

  assert.throws(
    () =>
      parseOutreachDraft({
        subject: "   ",
        body,
        personalization_note: personalizationNote
      }),
    /subject must contain 1-78 characters/
  );
  assert.throws(
    () =>
      parseOutreachDraft({
        subject: `${em}${em}`,
        body,
        personalization_note: personalizationNote
      }),
    /subject must contain 1-78 characters/
  );
  assert.throws(
    () =>
      parseOutreachDraft({
        subject: `\u0001${subject}`,
        body,
        personalization_note: personalizationNote
      }),
    /subject must be text/
  );

  // Subject single-line header gate remains after ASCII C prep.
  assert.throws(
    () =>
      parseOutreachDraft({
        subject: "Safe subject\nBcc: injected@example.test",
        body: "Hello",
        personalization_note: "Unsafe subject"
      }),
    /single safe header line/
  );
  assert.throws(
    () =>
      parseOutreachDraft({
        subject: "Hello",
        body: "Visit https://invented.example",
        personalization_note: "Made up a link"
      }),
    /must not invent or insert links/
  );

  // Body may keep internal LF/TAB after prep (multiline allowlist).
  const multilineBody = "Line one.\nLine two.\tKeep going.";
  assert.equal(
    normalizeCanonicalOutreachDraftText(`  ${multilineBody}  `, "body", 1_200),
    multilineBody
  );
  assert.deepEqual(
    parseOutreachDraft({
      subject,
      body: `  ${multilineBody}  `,
      personalization_note: personalizationNote
    }).body,
    multilineBody
  );
});

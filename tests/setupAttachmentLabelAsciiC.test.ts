import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupAttachmentLabelToken,
  canonicalizeSetupAttachmentLabel,
  canonicalizeSetupAttachmentLabelToken,
  normalizeCanonicalSetupAttachmentLabel,
  requireCanonicalSetupAttachmentLabel,
  SETUP_ATTACHMENT_LABEL_DEFAULT
} from "../services/domain/setupAttachmentLabelIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupAttachmentLabelIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const draftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const label = "Menu CSV";
const accentedLabel = "Menú semanal";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005PI pins setup attachment labels to ASCII C", () => {
  assert.match(identitySource, /MISE-005PI/);
  assert.match(setupSource, /MISE-005PI/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupAttachmentLabelToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /normalizeCanonicalSetupAttachmentLabel\(attachment\.label\) \?\?\s*SETUP_ATTACHMENT_LABEL_DEFAULT/
  );
  assert.match(setupSource, /from "\.\.\/domain\/setupAttachmentLabelIdentity"/);
  assert.doesNotMatch(
    setupSource,
    /label:\s*attachment\.label\.trim\(\)\s*\|\|\s*"Setup reference"/
  );

  // Leave sibling normalize / name / draft emptiness contracts alone.
  assert.match(
    validationSource,
    /label: asString\(value\.label, "Setup reference"\)/
  );
  assert.match(validationSource, /export function requireRestaurantName\(/);
  assert.match(
    validationSource.slice(
      validationSource.indexOf("export function requireRestaurantName("),
      validationSource.indexOf("export function requireRestaurantName(") + 350
    ),
    /value\.trim\(\)/
  );
  assert.match(
    draftsSource,
    /Boolean\(attachment\.id && attachment\.label && \(attachment\.kind === "csv" \|\| attachment\.kind === "screenshot"\)\)/
  );

  // Leave restaurantId trim and other setup draft field trims alone.
  assert.match(setupSource, /const normalizedRestaurantId = restaurantId\.trim\(\);/);
  assert.match(setupSource, /supplier\.name\.trim\(\) \|\| supplier\.email\.trim\(\)/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantCuisineTypeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryScopeSourceIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(setupSource, /requireSetupAttachmentLabel/);
});

test("ASCII C prep keeps ordinary setup attachment labels stable", () => {
  assert.equal(asciiTrimSetupAttachmentLabelToken(`  ${label}  `), label);
  assert.equal(asciiTrimSetupAttachmentLabelToken(`\t${label}\n`), label);
  assert.equal(canonicalizeSetupAttachmentLabelToken(`  ${label}  `), label);
  assert.equal(canonicalizeSetupAttachmentLabel(`  ${label}  `), label);
  assert.equal(normalizeCanonicalSetupAttachmentLabel(`  ${label}  `), label);
  assert.equal(requireCanonicalSetupAttachmentLabel(`  ${label}  `), label);

  assert.equal(canonicalizeSetupAttachmentLabel(accentedLabel), accentedLabel);
  assert.equal(normalizeCanonicalSetupAttachmentLabel(accentedLabel), accentedLabel);

  assert.equal(SETUP_ATTACHMENT_LABEL_DEFAULT, "Setup reference");
  assert.equal(
    normalizeCanonicalSetupAttachmentLabel(null) ?? SETUP_ATTACHMENT_LABEL_DEFAULT,
    SETUP_ATTACHMENT_LABEL_DEFAULT
  );
  assert.equal(
    normalizeCanonicalSetupAttachmentLabel("   ") ?? SETUP_ATTACHMENT_LABEL_DEFAULT,
    SETUP_ATTACHMENT_LABEL_DEFAULT
  );
});

test("Unicode em-space / NBSP padding cannot invent clean setup attachment labels", () => {
  const padded = `${em}${label}${em}`;
  const nbspLabel = `${nbsp}${label}${nbsp}`;
  const internalEm = `Menu${em}CSV`;
  const internalNbsp = `Menu${nbsp}CSV`;

  // Inventing proof: Unicode trim would invent the clean label.
  assert.equal(padded.trim(), label);
  assert.equal(nbspLabel.trim(), label);
  assert.equal(padded.trim() || SETUP_ATTACHMENT_LABEL_DEFAULT, label);
  assert.equal(em.trim() || SETUP_ATTACHMENT_LABEL_DEFAULT, SETUP_ATTACHMENT_LABEL_DEFAULT);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupAttachmentLabelToken(padded), padded);
  assert.equal(canonicalizeSetupAttachmentLabelToken(padded), null);
  assert.equal(canonicalizeSetupAttachmentLabelToken(nbspLabel), null);
  assert.equal(canonicalizeSetupAttachmentLabel(padded), null);
  assert.equal(canonicalizeSetupAttachmentLabel(nbspLabel), null);

  assert.throws(
    () => normalizeCanonicalSetupAttachmentLabel(padded),
    /Setup attachment label is invalid\./
  );
  assert.throws(
    () => requireCanonicalSetupAttachmentLabel(nbspLabel),
    /Setup attachment label is invalid\./
  );

  // Soft empty still falls through to the prior default without inventing from a padded token.
  assert.equal(
    normalizeCanonicalSetupAttachmentLabel(`${em}${em}`) ?? SETUP_ATTACHMENT_LABEL_DEFAULT,
    SETUP_ATTACHMENT_LABEL_DEFAULT
  );
  assert.equal(
    normalizeCanonicalSetupAttachmentLabel(`${nbsp}`) ?? SETUP_ATTACHMENT_LABEL_DEFAULT,
    SETUP_ATTACHMENT_LABEL_DEFAULT
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSetupAttachmentLabelToken(internalEm), internalEm);
  assert.equal(canonicalizeSetupAttachmentLabel(internalNbsp), internalNbsp);
  assert.equal(normalizeCanonicalSetupAttachmentLabel(internalEm), internalEm);
});

test("soft empty stays null without inventing text; controls and non-strings fail closed", () => {
  assert.equal(normalizeCanonicalSetupAttachmentLabel(undefined), null);
  assert.equal(normalizeCanonicalSetupAttachmentLabel(""), null);
  assert.equal(normalizeCanonicalSetupAttachmentLabel("   "), null);
  assert.equal(normalizeCanonicalSetupAttachmentLabel(`${em}${em}`), null);
  assert.equal(normalizeCanonicalSetupAttachmentLabel(`${nbsp}`), null);
  assert.equal(canonicalizeSetupAttachmentLabel(`${em}${em}`), null);

  assert.throws(
    () => requireCanonicalSetupAttachmentLabel(`${em}${em}`),
    /Setup attachment label is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalSetupAttachmentLabel(123),
    /Setup attachment label is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalSetupAttachmentLabel(`\u0001${label}`),
    /Setup attachment label is invalid\./
  );
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeCanonicalSetupAttachmentLabel(`${label}\t`), label);
  assert.throws(
    () => normalizeCanonicalSetupAttachmentLabel(`${label}\u0007`),
    /Setup attachment label is invalid\./
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSuppliersSettingsRecipientEmail,
  canonicalizeSuppliersSettingsRecipientEmail,
  normalizeSuppliersSettingsRecipientEmail
} from "../services/domain/presentationSuppliersSettingsRecipientEmailIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSuppliersSettingsRecipientEmailIdentity.ts", import.meta.url),
  "utf8"
);
const suppliersUiSource = readFileSync(
  new URL("../app/settings/suppliers.tsx", import.meta.url),
  "utf8"
);

const recipientMailbox = "orders@farm.co";
const accentedMailbox = "órdenes@café.example";
const FALLBACK = "Not configured";

test("MISE-005VX pins Settings suppliers recipient-email presentation to ASCII C", () => {
  assert.match(identitySource, /MISE-005VX/);
  assert.match(suppliersUiSource, /MISE-005VX/);

  assert.match(
    identitySource,
    /export function asciiTrimSuppliersSettingsRecipientEmail\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Mailbox tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimSuppliersSettingsRecipientEmail("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    suppliersUiSource,
    /normalizeSuppliersSettingsRecipientEmail\(entry\.email\)/
  );
  assert.match(
    suppliersUiSource,
    /recipientEmail \|\| copy\.notConfigured/
  );
  assert.doesNotMatch(
    suppliersUiSource,
    /\{entry\.email \?\? copy\.notConfigured\}/
  );
  assert.doesNotMatch(
    suppliersUiSource,
    /Boolean\(entry\.email\)/
  );
  assert.doesNotMatch(
    suppliersUiSource,
    /label=\{entry\.email \? copy\.configured/
  );

  // Leave sibling tips / modules alone.
  assert.doesNotMatch(identitySource, /from ["'].*supplierSettingsEmailIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationGmailSenderEmailIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationOrdersGmailSenderIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSetupReadinessGmailSenderIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSettingsAccountEmailLabelIdentity/);
  assert.doesNotMatch(
    suppliersUiSource,
    /from ["'].*supplierSettingsEmailIdentity/
  );
  assert.doesNotMatch(
    suppliersUiSource,
    /from ["'].*presentationGmailSenderEmailIdentity/
  );
  // Draft equality / save path still uses raw entry.email (owned by #690).
  assert.match(
    suppliersUiSource,
    /draftEmail\.trim\(\)\.toLowerCase\(\) === \(entry\.email \?\? ""\)\.toLowerCase\(\)/
  );
});

test("ASCII C recipient prep keeps ordinary Settings suppliers emails stable", () => {
  assert.equal(asciiTrimSuppliersSettingsRecipientEmail(`  ${recipientMailbox}  `), recipientMailbox);
  assert.equal(asciiTrimSuppliersSettingsRecipientEmail(`\t${recipientMailbox}\n`), recipientMailbox);
  assert.equal(canonicalizeSuppliersSettingsRecipientEmail(`  ${recipientMailbox}  `), recipientMailbox);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(`  ${recipientMailbox}  `), recipientMailbox);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(accentedMailbox), accentedMailbox);
});

test("Unicode-only space and empty string bypass notConfigured via ?? / Boolean until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";

  // Prior truthy / `??` bypass proofs.
  assert.equal(Boolean(emOnly), true);
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeSuppliersSettingsRecipientEmail(emOnly), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(emOnly) || FALLBACK, FALLBACK);
  assert.equal(Boolean(normalizeSuppliersSettingsRecipientEmail(emOnly)), false);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(nbspOnly), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(paddedSpaces), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(empty), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(null), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(undefined), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(null) || FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean Settings suppliers recipient-email display", () => {
  const emRecipient = `\u2003${recipientMailbox}\u2003`;
  const nbspRecipient = `\u00a0${recipientMailbox}\u00a0`;

  // Inventing proof on Unicode trim.
  assert.equal(emRecipient.trim(), recipientMailbox);
  assert.equal(nbspRecipient.trim(), recipientMailbox);

  // Mailbox tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimSuppliersSettingsRecipientEmail(emRecipient), emRecipient);
  assert.equal(asciiTrimSuppliersSettingsRecipientEmail(nbspRecipient), nbspRecipient);

  // Soft-null refuses to invent clean recipient mailbox display.
  assert.equal(canonicalizeSuppliersSettingsRecipientEmail(emRecipient), null);
  assert.equal(canonicalizeSuppliersSettingsRecipientEmail(nbspRecipient), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(emRecipient), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(nbspRecipient), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(emRecipient) || FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for Settings suppliers recipient-email display", () => {
  assert.equal(normalizeSuppliersSettingsRecipientEmail(`${recipientMailbox}\u0000`), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(`\u0007${recipientMailbox}`), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(`${recipientMailbox}\u007f`), null);
  // Single-line mailboxes reject embedded LF/CR (unlike multiline body tips).
  assert.equal(normalizeSuppliersSettingsRecipientEmail(`${recipientMailbox}\nnext`), null);
  assert.equal(normalizeSuppliersSettingsRecipientEmail(`${recipientMailbox}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeSuppliersSettingsRecipientEmail(`${recipientMailbox}\t`), recipientMailbox);
  assert.equal(normalizeSuppliersSettingsRecipientEmail("orders@farm.co"), recipientMailbox);
});

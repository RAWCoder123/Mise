import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOutreachLeadText,
  canonicalizeOutreachLeadText,
  normalizeCanonicalOutreachLeadText
} from "../services/domain/outreachLeadTextIdentity";
import { normalizeOutreachLead } from "../services/domain/outreach";

const identitySource = readFileSync(
  new URL("../services/domain/outreachLeadTextIdentity.ts", import.meta.url),
  "utf8"
);
const outreachSource = readFileSync(
  new URL("../services/domain/outreach.ts", import.meta.url),
  "utf8"
);

const businessName = "Harbor Grill";
const city = "Newark";
const em = "\u2003";
const nbsp = "\u00a0";

const baseLead = {
  businessName,
  email: "chef@harbor.example",
  sourceUrl: "https://harbor.example/contact",
  contactBasis: "public_business_contact" as const
};

test("MISE-005QM pins outreach lead requireText to ASCII C", () => {
  assert.match(identitySource, /MISE-005QM/);
  assert.match(outreachSource, /MISE-005QM/);

  assert.match(
    identitySource,
    /export function asciiTrimOutreachLeadText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    outreachSource,
    /normalizeCanonicalOutreachLeadText\(value, fieldName, maximumLength\)/
  );
  assert.match(outreachSource, /from "\.\/outreachLeadTextIdentity"/);

  // Leave mailbox fold, greeting firstName, and AI draft bounded text alone.
  assert.match(
    outreachSource,
    /function normalizeOutreachEmail\(value: string\) \{\s*return value\.trim\(\)\.toLowerCase\(\);/
  );
  assert.match(
    outreachSource,
    /function firstName\(value: string\) \{\s*return value\.trim\(\)\.split/
  );
  assert.doesNotMatch(identitySource, /from "\.\/accountAuth"/);
  assert.doesNotMatch(identitySource, /outreachStringIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/ai\/outreachDraft"/);
  assert.doesNotMatch(outreachSource, /from "\.\.\/ai\/outreachDraft"/);
  assert.doesNotMatch(outreachSource, /outreachStringIdentity/);
});

test("ASCII C prep keeps ordinary outreach lead text padding stable", () => {
  assert.equal(asciiTrimOutreachLeadText(`  ${businessName}  `), businessName);
  assert.equal(asciiTrimOutreachLeadText(`\t${city}\n`), city);
  assert.equal(canonicalizeOutreachLeadText(`  ${businessName}  `), businessName);
  assert.equal(
    normalizeCanonicalOutreachLeadText(`  ${businessName}  `, "businessName", 160),
    businessName
  );
  assert.equal(
    normalizeCanonicalOutreachLeadText(`  ${city}  `, "city", 120),
    city
  );

  const lead = normalizeOutreachLead({
    ...baseLead,
    businessName: `  ${businessName}  `,
    email: "  HELLO@HARBOR.EXAMPLE  ",
    contactName: "  Alex Rivera  ",
    city: `  ${city}  `,
    state: "  NJ  ",
    cuisine: "  Seafood  ",
    fitNotes: "  Independent coastal spot.  "
  });

  assert.equal(lead.businessName, businessName);
  assert.equal(lead.email, "hello@harbor.example");
  assert.equal(lead.contactName, "Alex Rivera");
  assert.equal(lead.city, city);
  assert.equal(lead.state, "NJ");
  assert.equal(lead.cuisine, "Seafood");
  assert.equal(lead.fitNotes, "Independent coastal spot.");
});

test("NBSP and em-space padding cannot invent outreach lead text", () => {
  const paddedName = `${em}${businessName}${em}`;
  const nbspName = `${nbsp}${businessName}${nbsp}`;
  const paddedCity = `${em}${city}${em}`;
  const nbspCity = `${nbsp}${city}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean label.
  assert.equal(paddedName.trim(), businessName);
  assert.equal(nbspName.trim(), businessName);
  assert.equal(paddedCity.trim(), city);
  assert.equal(nbspCity.trim(), city);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimOutreachLeadText(paddedName), paddedName);
  assert.equal(canonicalizeOutreachLeadText(paddedName), null);
  assert.equal(canonicalizeOutreachLeadText(nbspName), null);
  assert.equal(canonicalizeOutreachLeadText(paddedCity), null);
  assert.equal(canonicalizeOutreachLeadText(nbspCity), null);

  assert.throws(
    () => normalizeCanonicalOutreachLeadText(paddedName, "businessName", 160),
    /businessName is required/
  );
  assert.throws(
    () => normalizeCanonicalOutreachLeadText(nbspName, "businessName", 160),
    /businessName is required/
  );
  assert.throws(
    () => normalizeOutreachLead({ ...baseLead, businessName: paddedName }),
    /businessName is required/
  );
  assert.throws(
    () => normalizeOutreachLead({ ...baseLead, city: paddedCity }),
    /city is required/
  );
  assert.throws(
    () =>
      normalizeOutreachLead({
        ...baseLead,
        contactName: `${em}Alex${em}`
      }),
    /contactName is required/
  );
  assert.throws(
    () =>
      normalizeOutreachLead({
        ...baseLead,
        fitNotes: `${nbsp}Keep the coastal voice.${nbsp}`
      }),
    /fitNotes is required/
  );
  assert.throws(
    () =>
      normalizeOutreachLead({
        ...baseLead,
        sourceUrl: `${em}https://harbor.example/contact${em}`
      }),
    /sourceUrl is required/
  );
});

test("ASCII-only empty and control outreach lead text fail closed without inventing", () => {
  assert.equal(canonicalizeOutreachLeadText(`${em}${em}`), null);
  assert.equal(canonicalizeOutreachLeadText(`${nbsp}`), null);
  assert.equal(canonicalizeOutreachLeadText(`\u0000${businessName}`), null);

  assert.throws(
    () => normalizeCanonicalOutreachLeadText("   ", "businessName", 160),
    /businessName must contain 1-160 characters/
  );
  assert.throws(
    () => normalizeCanonicalOutreachLeadText(`${em}${em}`, "businessName", 160),
    /businessName must contain 1-160 characters/
  );
  assert.throws(
    () => normalizeCanonicalOutreachLeadText(`${nbsp}`, "city", 120),
    /city must contain 1-120 characters/
  );
  assert.throws(
    () =>
      normalizeCanonicalOutreachLeadText(
        `\u0000${businessName}`,
        "businessName",
        160
      ),
    /businessName contains unsupported control characters/
  );
  assert.throws(
    () =>
      normalizeOutreachLead({
        ...baseLead,
        businessName: `\u0000${businessName}`
      }),
    /businessName contains unsupported control characters/
  );

  // TAB / LF / CR remain allowed (prior requireText allowlist) and ASCII-trim.
  assert.equal(
    normalizeCanonicalOutreachLeadText(
      `\t${businessName}\n`,
      "businessName",
      160
    ),
    businessName
  );
  assert.equal(
    normalizeOutreachLead({
      ...baseLead,
      fitNotes: "Line one.\nLine two."
    }).fitNotes,
    "Line one.\nLine two."
  );
});

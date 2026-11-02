import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimHomeApprovalsCardTitle,
  canonicalizeHomeApprovalsCardTitle,
  normalizeHomeApprovalsCardTitle
} from "../services/domain/presentationHomeApprovalsCardTitleIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationHomeApprovalsCardTitleIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const statusIdentityPath = new URL(
  "../services/domain/homeStatusApprovalTitleIdentity.ts",
  import.meta.url
);

const approvalTitle = "Approve chicken reorder";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WO pins Home ApprovalsSection card.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005WO/);
  assert.match(homeSource, /MISE-005WO/);

  assert.match(
    identitySource,
    /export function asciiTrimHomeApprovalsCardTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationHomeApprovalsCardTitleIdentity"/
  );
  assert.match(homeSource, /normalizeHomeApprovalsCardTitle\(/);
  assert.match(
    homeSource,
    /cardTitle\s*\|\|\s*t\("home\.approvals\.cardTitle\.none"\)/
  );
  assert.doesNotMatch(
    homeSource,
    /<Text style=\{styles\.cardTitle\}>\{card\.title\}<\/Text>/
  );

  assert.match(catalogSource, /"home\.approvals\.cardTitle\.none": "Needs approval"/);
  assert.match(catalogSource, /"home\.approvals\.cardTitle\.none": "Necesita aprobación"/);
  assert.match(catalogSource, /"home\.approvals\.cardTitle\.none": "需要批准"/);

  // Leave ApprovalsSection body / why copy as raw pass-through.
  assert.match(homeSource, /\{card\.recommendedAction\}/);
  assert.match(homeSource, /\{card\.whyItMatters\}/);

  // Leave Home greeting restaurant.name alone on main (open #1044).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );

  // Leave StatusNotice approval-title tip path alone (#1011 owns that module).
  assert.doesNotMatch(homeSource, /normalizeHomeStatusApprovalTitle/);
  assert.equal(
    (() => {
      try {
        readFileSync(statusIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsGmailRestaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeApprovalsCardTitle(approvalTitle), approvalTitle);
  assert.equal(normalizeHomeApprovalsCardTitle(` ${approvalTitle} `), approvalTitle);
  assert.equal(
    normalizeHomeApprovalsCardTitle(`Aprobar ${approvalTitle}`),
    `Aprobar ${approvalTitle}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home ApprovalsSection card titles", () => {
  const padded = `${em}${approvalTitle}${em}`;
  const nbspTitle = `${nbsp}${approvalTitle}${nbsp}`;
  const internalEm = `Approve${em}chicken reorder`;
  const internalNbsp = `Approve${nbsp}chicken reorder`;

  // Inventing proof: Unicode trim would invent the clean approval title.
  assert.equal(padded.trim(), approvalTitle);
  assert.equal(nbspTitle.trim(), approvalTitle);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimHomeApprovalsCardTitle(padded), padded);
  assert.equal(canonicalizeHomeApprovalsCardTitle(padded), null);
  assert.equal(canonicalizeHomeApprovalsCardTitle(nbspTitle), null);
  assert.equal(normalizeHomeApprovalsCardTitle(padded), null);
  assert.equal(normalizeHomeApprovalsCardTitle(nbspTitle), null);
  assert.equal(normalizeHomeApprovalsCardTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeHomeApprovalsCardTitle(internalEm), internalEm);
  assert.equal(normalizeHomeApprovalsCardTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeHomeApprovalsCardTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Home ApprovalsSection card titles", () => {
  assert.equal(normalizeHomeApprovalsCardTitle(undefined), null);
  assert.equal(normalizeHomeApprovalsCardTitle(null), null);
  assert.equal(normalizeHomeApprovalsCardTitle(""), null);
  assert.equal(normalizeHomeApprovalsCardTitle("   "), null);
  assert.equal(normalizeHomeApprovalsCardTitle(123 as unknown as string), null);
  assert.equal(normalizeHomeApprovalsCardTitle(`\u0001${approvalTitle}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeApprovalsCardTitle(`${approvalTitle}\t`), approvalTitle);
  assert.equal(normalizeHomeApprovalsCardTitle(`${approvalTitle}\u0007`), null);
  assert.equal(normalizeHomeApprovalsCardTitle(em), null);
});

test("Home ApprovalsSection bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking cardTitle Text.
  assert.equal(normalizeHomeApprovalsCardTitle(""), null);
  assert.equal(normalizeHomeApprovalsCardTitle(em), null);
  assert.equal(normalizeHomeApprovalsCardTitle(nbsp), null);
  assert.match(
    homeSource,
    /cardTitle\s*\|\|\s*t\("home\.approvals\.cardTitle\.none"\)/
  );
});

test("Home ApprovalsSection card-title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${approvalTitle}${em}`;
  assert.notEqual(asciiTrimHomeApprovalsCardTitle(padded), padded.trim());
  assert.equal(normalizeHomeApprovalsCardTitle(padded), null);
  assert.equal(normalizeHomeApprovalsCardTitle(`\t${approvalTitle}\n`), approvalTitle);
});

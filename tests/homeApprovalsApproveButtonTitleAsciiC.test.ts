import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimHomeApprovalsApproveButtonTitle,
  canonicalizeHomeApprovalsApproveButtonTitle,
  normalizeHomeApprovalsApproveButtonTitle
} from "../services/domain/presentationHomeApprovalsApproveButtonTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationHomeApprovalsApproveButtonTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const approvalTitle = "Approve chicken reorder";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ACA pins Home Approvals approve-button a11y card.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ACA/);
  assert.match(homeSource, /MISE-005ACA/);

  assert.match(
    identitySource,
    /export function asciiTrimHomeApprovalsApproveButtonTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationHomeApprovalsApproveButtonTitleIdentity"/
  );
  assert.match(homeSource, /normalizeHomeApprovalsApproveButtonTitle\(/);
  assert.match(
    homeSource,
    /normalizeHomeApprovalsApproveButtonTitle\(card\.title\)\s*\|\|\s*\n?\s*t\("home\.approvals\.approveAccessibility\.title\.none"\)/
  );
  assert.match(
    homeSource,
    /accessibilityLabel=\{\s*canOneTap\s*\?\s*t\("home\.approvals\.approveAccessibility", \{\s*title: approveButtonTitle\s*\}\)\s*:\s*t\("home\.approvals\.reviewAccessibility", \{\s*title: approveButtonTitle\s*\}\)\s*\}/
  );
  assert.match(homeSource, /accessibilityState=\{\{\s*disabled: Boolean\(approvingId\)\s*\}\}/);

  // Prior path had no accessibilityLabel on the ApprovalsSection Button.
  assert.doesNotMatch(
    homeSource,
    /accessibilityLabel=\{t\("home\.approvals\.approveAccessibility", \{\s*title: card\.title\s*\}\)/
  );

  assert.match(catalogSource, /"home\.approvals\.approveAccessibility": "Approve \{title\}"/);
  assert.match(catalogSource, /"home\.approvals\.reviewAccessibility": "Review \{title\}"/);
  assert.match(
    catalogSource,
    /"home\.approvals\.approveAccessibility\.title\.none": "Needs approval"/
  );
  assert.match(catalogSource, /"home\.approvals\.approveAccessibility": "Aprobar \{title\}"/);
  assert.match(catalogSource, /"home\.approvals\.reviewAccessibility": "Revisar \{title\}"/);
  assert.match(
    catalogSource,
    /"home\.approvals\.approveAccessibility\.title\.none": "Necesita aprobación"/
  );
  assert.match(catalogSource, /"home\.approvals\.approveAccessibility": "批准 \{title\}"/);
  assert.match(catalogSource, /"home\.approvals\.reviewAccessibility": "查看 \{title\}"/);
  assert.match(
    catalogSource,
    /"home\.approvals\.approveAccessibility\.title\.none": "需要批准"/
  );

  // Leave ApprovalsSection display card.title / body / whyItMatters alone.
  assert.match(homeSource, /<Text style=\{styles\.cardTitle\}>\{card\.title\}<\/Text>/);
  assert.match(homeSource, /<Text style=\{styles\.cardBody\}>\{card\.recommendedAction\}<\/Text>/);
  assert.match(
    homeSource,
    /\{t\("home\.approvals\.why"\)}: \{card\.whyItMatters\}/
  );
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsWhyItMattersIdentity/);
  assert.doesNotMatch(identitySource, /homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeApprovalsApproveButtonTitle(approvalTitle), approvalTitle);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(` ${approvalTitle} `), approvalTitle);
  assert.equal(
    normalizeHomeApprovalsApproveButtonTitle(`Case-${approvalTitle}`),
    `Case-${approvalTitle}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home Approvals approve-button a11y titles", () => {
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
  assert.equal(asciiTrimHomeApprovalsApproveButtonTitle(padded), padded);
  assert.equal(canonicalizeHomeApprovalsApproveButtonTitle(padded), null);
  assert.equal(canonicalizeHomeApprovalsApproveButtonTitle(nbspTitle), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(padded), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(nbspTitle), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeHomeApprovalsApproveButtonTitle(internalEm), internalEm);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Home Approvals approve-button a11y titles", () => {
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(undefined), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(null), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(""), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle("   "), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(123 as unknown as string), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(`\u0001${approvalTitle}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(`${approvalTitle}\t`), approvalTitle);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(`${approvalTitle}\u0007`), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(em), null);
});

test("Home Approvals approve-button a11y bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior path had no accessibilityLabel; new chrome must soft-null blank titles.
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(""), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(em), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    homeSource,
    /normalizeHomeApprovalsApproveButtonTitle\(card\.title\)\s*\|\|\s*\n?\s*t\("home\.approvals\.approveAccessibility\.title\.none"\)/
  );
});

test("Home Approvals approve-button a11y card.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${approvalTitle}${em}`;
  assert.notEqual(asciiTrimHomeApprovalsApproveButtonTitle(padded), padded.trim());
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(padded), null);
  assert.equal(normalizeHomeApprovalsApproveButtonTitle(`\t${approvalTitle}\n`), approvalTitle);
});

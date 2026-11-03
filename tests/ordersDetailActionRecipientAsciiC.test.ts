import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersDetailActionRecipient,
  canonicalizeOrdersDetailActionRecipient,
  normalizeOrdersDetailActionRecipient
} from "../services/domain/presentationOrdersDetailActionRecipientIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationOrdersDetailActionRecipientIdentity.ts", import.meta.url),
  "utf8"
);
const ordersDetailSource = readFileSync(new URL("../app/orders/[id].tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const recipient = "produce@local.example";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XI pins Orders detail approveAndSend a11y recipient to ASCII C", () => {
  assert.match(identitySource, /MISE-005XI/);
  assert.match(ordersDetailSource, /MISE-005XI/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersDetailActionRecipient\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    ordersDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOrdersDetailActionRecipientIdentity"/
  );
  assert.match(ordersDetailSource, /normalizeOrdersDetailActionRecipient\(/);
  assert.match(
    ordersDetailSource,
    /normalizeOrdersDetailActionRecipient\(visibleEmailPayload\?\.to\)\s*\|\|\s*t\("orders\.detail\.action\.recipient\.none"\)/
  );
  assert.match(
    ordersDetailSource,
    /t\("orders\.detail\.action\.approveAndSendAccessibility", \{\s*(?:\/\/[^\n]*\n\s*)*supplier: visibleOrder\.supplier_name,\s*recipient:\s*normalizeOrdersDetailActionRecipient\(visibleEmailPayload\?\.to\)\s*\|\|\s*t\("orders\.detail\.action\.recipient\.none"\)\s*\}\)/
  );
  assert.doesNotMatch(
    ordersDetailSource,
    /recipient:\s*visibleEmailPayload\?\.to\s*\?\?\s*""/
  );

  assert.match(catalogSource, /"orders\.detail\.action\.recipient\.none": "Recipient"/);
  assert.match(catalogSource, /"orders\.detail\.action\.recipient\.none": "Destinatario"/);
  assert.match(catalogSource, /"orders\.detail\.action\.recipient\.none": "收件人"/);

  // Leave Orders detail action a11y supplier_name alone on main (open #1068).
  assert.match(
    ordersDetailSource,
    /t\("orders\.detail\.action\.copyAccessibility", \{\s*supplier: visibleOrder\.supplier_name\s*\}\)/
  );
  assert.match(
    ordersDetailSource,
    /t\("orders\.detail\.action\.simulateAccessibility", \{ supplier: visibleOrder\.supplier_name \}\)/
  );
  assert.match(
    ordersDetailSource,
    /t\("orders\.detail\.action\.markReceivedAccessibility", \{\s*supplier: visibleOrder\.supplier_name\s*\}\)/
  );
  assert.doesNotMatch(ordersDetailSource, /normalizeOrdersDetailActionSupplierName/);
  assert.doesNotMatch(ordersDetailSource, /normalizeOrdersDetailEmailReviewHeader/);
  assert.doesNotMatch(identitySource, /ordersDetailEmailReviewHeaderIdentity/);
  assert.doesNotMatch(identitySource, /presentationOrdersDetailActionSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave email-review To display row as raw ?? unavailable on main (open #1015).
  assert.match(
    ordersDetailSource,
    /value=\{visibleEmailPayload\?\.to \?\? t\("orders\.detail\.review\.unavailable"\)\}/
  );

  assert.equal(normalizeOrdersDetailActionRecipient(recipient), recipient);
  assert.equal(normalizeOrdersDetailActionRecipient(` ${recipient} `), recipient);
  assert.equal(
    normalizeOrdersDetailActionRecipient(`ops+${recipient}`),
    `ops+${recipient}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Orders detail approveAndSend a11y recipients", () => {
  const padded = `${em}${recipient}${em}`;
  const nbspName = `${nbsp}${recipient}${nbsp}`;
  const internalEm = `produce${em}@local.example`;
  const internalNbsp = `produce${nbsp}@local.example`;

  // Inventing proof: Unicode trim would invent the clean mailbox.
  assert.equal(padded.trim(), recipient);
  assert.equal(nbspName.trim(), recipient);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimOrdersDetailActionRecipient(padded), padded);
  assert.equal(canonicalizeOrdersDetailActionRecipient(padded), null);
  assert.equal(canonicalizeOrdersDetailActionRecipient(nbspName), null);
  assert.equal(normalizeOrdersDetailActionRecipient(padded), null);
  assert.equal(normalizeOrdersDetailActionRecipient(nbspName), null);
  assert.equal(normalizeOrdersDetailActionRecipient(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOrdersDetailActionRecipient(internalEm), internalEm);
  assert.equal(normalizeOrdersDetailActionRecipient(internalNbsp), internalNbsp);
  assert.equal(normalizeOrdersDetailActionRecipient(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Orders detail approveAndSend a11y recipients", () => {
  assert.equal(normalizeOrdersDetailActionRecipient(undefined), null);
  assert.equal(normalizeOrdersDetailActionRecipient(null), null);
  assert.equal(normalizeOrdersDetailActionRecipient(""), null);
  assert.equal(normalizeOrdersDetailActionRecipient("   "), null);
  assert.equal(normalizeOrdersDetailActionRecipient(123 as unknown as string), null);
  assert.equal(normalizeOrdersDetailActionRecipient(`\u0001${recipient}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeOrdersDetailActionRecipient(`${recipient}\t`), recipient);
  assert.equal(normalizeOrdersDetailActionRecipient(`${recipient}\u0007`), null);
  assert.equal(normalizeOrdersDetailActionRecipient(em), null);
});

test("Orders detail approveAndSend a11y bypass proof: empty and Unicode-only-space recipients soft-null to localized none", () => {
  // Prior always-pass / ?? "" path still interpolated blank-looking recipient into a11y.
  assert.equal(normalizeOrdersDetailActionRecipient(""), null);
  assert.equal(normalizeOrdersDetailActionRecipient(em), null);
  assert.equal(normalizeOrdersDetailActionRecipient(nbsp), null);
  const missingTo: string | null | undefined = undefined;
  const unicodeOnlyTo: string | null | undefined = em;
  assert.equal(missingTo ?? "", "");
  assert.equal(unicodeOnlyTo ?? "", em);
  assert.notEqual(unicodeOnlyTo ?? "", "");
  assert.match(
    ordersDetailSource,
    /normalizeOrdersDetailActionRecipient\(visibleEmailPayload\?\.to\)\s*\|\|\s*t\("orders\.detail\.action\.recipient\.none"\)/
  );
});

test("Orders detail approveAndSend a11y recipient identity refuses Unicode inventing equality", () => {
  const padded = `${em}${recipient}${em}`;
  assert.notEqual(asciiTrimOrdersDetailActionRecipient(padded), padded.trim());
  assert.equal(normalizeOrdersDetailActionRecipient(padded), null);
  assert.equal(normalizeOrdersDetailActionRecipient(`\t${recipient}\n`), recipient);
});

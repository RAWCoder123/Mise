import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createInitialDemoState } from "../services/demoData";
import { buildSetupReadinessSummary } from "../services/domain/miseDomain";
import {
  asciiTrimSetupReadinessGmailSender,
  canonicalizeSetupReadinessGmailSender,
  normalizeSetupReadinessGmailSender
} from "../services/domain/presentationSetupReadinessGmailSenderIdentity";
import type { RestaurantEmailConnection } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSetupReadinessGmailSenderIdentity.ts", import.meta.url),
  "utf8"
);
const miseDomainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const settingsGmailSource = readFileSync(
  new URL("../app/settings/gmail.tsx", import.meta.url),
  "utf8"
);

const senderMailbox = "orders@harbor.kitchen";
const accentedMailbox = "órdenes@café.example";
const READY_FALLBACK = "Gmail ready";
const NOT_LINKED = "Gmail sender not linked";
const em = "\u2003";
const nbsp = "\u00a0";

function connectedEmail(sender_email: string | null): RestaurantEmailConnection {
  return {
    id: "email_1",
    restaurant_id: "rest_1",
    provider: "gmail",
    status: "connected",
    sender_email,
    last_verified_at: "2026-07-18T15:00:00.000Z",
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-18T15:00:00.000Z"
  };
}

test("MISE-005VW pins setup-readiness Email sender_email to ASCII C", () => {
  assert.match(identitySource, /MISE-005VW/);
  assert.match(miseDomainSource, /MISE-005VW/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupReadinessGmailSender\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Mailbox tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimSetupReadinessGmailSender("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    miseDomainSource,
    /from "\.\/presentationSetupReadinessGmailSenderIdentity"/
  );
  assert.match(miseDomainSource, /normalizeSetupReadinessGmailSender\(/);
  assert.match(
    miseDomainSource,
    /emailConnection\?\.status !== "connected" \|\| !setupReadinessSenderEmail/
  );
  assert.match(
    miseDomainSource,
    /setupReadinessSenderEmail \?\? "Gmail ready"/
  );
  assert.doesNotMatch(
    miseDomainSource,
    /!emailConnection\.sender_email/
  );
  assert.doesNotMatch(
    miseDomainSource,
    /emailConnection\.sender_email \?\? "Gmail ready"/
  );

  // Leave Settings/Gmail display tip (#1019) and supplier email payload alone.
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationGmailSenderEmailIdentity/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationOrdersGmailSenderIdentity/
  );
  assert.doesNotMatch(identitySource, /^import /m);
  assert.match(
    miseDomainSource,
    /const from = emailConnection\?\.sender_email \?\? null;/
  );
  // Settings/Gmail still uses its own ?? path on main (open #1019 owns it).
  assert.match(
    settingsGmailSource,
    /visibleConnection\?\.sender_email \?\? t\("settings\.gmail\.status\.notConnected"\)/
  );
});

test("ASCII C prep keeps ordinary setup-readiness Gmail sender_email stable", () => {
  assert.equal(asciiTrimSetupReadinessGmailSender(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(asciiTrimSetupReadinessGmailSender(`\t${senderMailbox}\n`), senderMailbox);
  assert.equal(canonicalizeSetupReadinessGmailSender(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(normalizeSetupReadinessGmailSender(`  ${senderMailbox}  `), senderMailbox);
  assert.equal(normalizeSetupReadinessGmailSender(accentedMailbox), accentedMailbox);
});

test("Unicode-only space truthy / ?? bypass marks Email complete until ASCII C soft-null restores not-linked", () => {
  const emOnly = em;
  const nbspOnly = nbsp;
  const paddedSpaces = "   ";
  const empty = "";

  // Prior truthy missing-gate bypass: Unicode-only space is truthy.
  assert.equal(Boolean(emOnly), true);
  assert.equal(!emOnly, false);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(!paddedSpaces, false);
  // Prior `??` bypass proofs against the intentional "Gmail ready" empty state.
  assert.equal(emOnly ?? READY_FALLBACK, emOnly);
  assert.notEqual(emOnly ?? READY_FALLBACK, READY_FALLBACK);
  assert.equal(empty ?? READY_FALLBACK, empty);
  assert.notEqual(empty ?? READY_FALLBACK, READY_FALLBACK);

  assert.equal(normalizeSetupReadinessGmailSender(emOnly), null);
  assert.equal(normalizeSetupReadinessGmailSender(emOnly) ?? READY_FALLBACK, READY_FALLBACK);
  assert.equal(normalizeSetupReadinessGmailSender(nbspOnly), null);
  assert.equal(normalizeSetupReadinessGmailSender(paddedSpaces), null);
  assert.equal(normalizeSetupReadinessGmailSender(empty), null);
  assert.equal(normalizeSetupReadinessGmailSender(null), null);
  assert.equal(normalizeSetupReadinessGmailSender(undefined), null);
});

test("NBSP/em-space padding cannot invent clean setup-readiness Gmail sender_email", () => {
  const emSender = `${em}${senderMailbox}${em}`;
  const nbspSender = `${nbsp}${senderMailbox}${nbsp}`;

  // Inventing proof on Unicode trim.
  assert.equal(emSender.trim(), senderMailbox);
  assert.equal(nbspSender.trim(), senderMailbox);

  // Mailbox tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimSetupReadinessGmailSender(emSender), emSender);
  assert.equal(asciiTrimSetupReadinessGmailSender(nbspSender), nbspSender);

  // Soft-null refuses to invent clean sender mailbox display.
  assert.equal(canonicalizeSetupReadinessGmailSender(emSender), null);
  assert.equal(canonicalizeSetupReadinessGmailSender(nbspSender), null);
  assert.equal(normalizeSetupReadinessGmailSender(emSender), null);
  assert.equal(normalizeSetupReadinessGmailSender(nbspSender), null);
  assert.equal(normalizeSetupReadinessGmailSender(emSender) ?? READY_FALLBACK, READY_FALLBACK);
});

test("Unsafe single-line controls soft-null for setup-readiness Gmail sender_email", () => {
  assert.equal(normalizeSetupReadinessGmailSender(`${senderMailbox}\u0000`), null);
  assert.equal(normalizeSetupReadinessGmailSender(`\u0007${senderMailbox}`), null);
  assert.equal(normalizeSetupReadinessGmailSender(`${senderMailbox}\u007f`), null);
  // Single-line mailboxes reject embedded LF/CR (unlike multiline body tips).
  assert.equal(normalizeSetupReadinessGmailSender(`${senderMailbox}\nnext`), null);
  assert.equal(normalizeSetupReadinessGmailSender(`${senderMailbox}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeSetupReadinessGmailSender(`${senderMailbox}\t`), senderMailbox);
  assert.equal(normalizeSetupReadinessGmailSender("orders@harbor.kitchen"), senderMailbox);
});

test("buildSetupReadinessSummary fails closed on Unicode-only-space sender_email", () => {
  const state = createInitialDemoState("Toast");
  const restaurant = state.restaurants[0]!;
  const inventoryItems = state.inventoryItems.filter((item) => item.restaurant_id === restaurant.id);
  const mappings = state.menuItemIngredients.filter(
    (mapping) => mapping.restaurant_id === restaurant.id
  );

  const unicodeOnly = buildSetupReadinessSummary({
    restaurant,
    sales: state.posSales,
    inventoryItems,
    mappings,
    orders: state.supplierOrders,
    emailConnection: {
      ...connectedEmail(em),
      restaurant_id: restaurant.id
    }
  });
  const emailStep = unicodeOnly.steps.find((step) => step.id === "email");
  assert.equal(unicodeOnly.missingEmailSender, true);
  assert.equal(emailStep?.detail, NOT_LINKED);
  assert.notEqual(emailStep?.status, "complete");
  assert.deepEqual(emailStep?.missing, ["restaurant Gmail sender"]);

  const padded = buildSetupReadinessSummary({
    restaurant,
    sales: state.posSales,
    inventoryItems,
    mappings,
    orders: state.supplierOrders,
    emailConnection: {
      ...connectedEmail(`${em}${senderMailbox}${em}`),
      restaurant_id: restaurant.id
    }
  });
  assert.equal(padded.missingEmailSender, true);
  assert.equal(padded.steps.find((step) => step.id === "email")?.detail, NOT_LINKED);

  const clean = buildSetupReadinessSummary({
    restaurant,
    sales: state.posSales,
    inventoryItems,
    mappings,
    orders: state.supplierOrders,
    emailConnection: {
      ...connectedEmail(senderMailbox),
      restaurant_id: restaurant.id
    }
  });
  assert.equal(clean.missingEmailSender, false);
  assert.equal(clean.steps.find((step) => step.id === "email")?.detail, senderMailbox);
  assert.equal(clean.steps.find((step) => step.id === "email")?.status, "complete");
});

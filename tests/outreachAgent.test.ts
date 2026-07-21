import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parseOutreachDraft } from "../services/ai/outreachDraft";
import {
  buildFallbackOutreachDraft,
  isWithinOutreachSendWindow,
  normalizeOutreachLead,
  renderOutreachEmail,
  suppressionReasonForProviderEvent
} from "../services/domain/outreach";

test("outreach leads require a traceable business-contact source", () => {
  const lead = normalizeOutreachLead({
    businessName: "  Corner Cafe  ",
    email: "HELLO@CORNER.EXAMPLE ",
    sourceUrl: "https://corner.example/contact",
    contactBasis: "public_business_contact",
    city: "Newark"
  });

  assert.equal(lead.businessName, "Corner Cafe");
  assert.equal(lead.email, "hello@corner.example");
  assert.equal(lead.sourceUrl, "https://corner.example/contact");
  assert.throws(
    () => normalizeOutreachLead({ ...lead, sourceUrl: "not-a-url" }),
    /sourceUrl must be an HTTP\(S\) URL/
  );
});

test("structured outreach drafts reject invented links", () => {
  assert.deepEqual(
    parseOutreachDraft({
      subject: "A simpler prep rhythm",
      body: "Hi Corner Cafe team,\n\nWould a short walkthrough be useful?",
      personalization_note: "Used only supplied business details."
    }),
    {
      subject: "A simpler prep rhythm",
      body: "Hi Corner Cafe team,\n\nWould a short walkthrough be useful?",
      personalizationNote: "Used only supplied business details."
    }
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
  assert.throws(
    () =>
      parseOutreachDraft({
        subject: "Safe subject\nBcc: injected@example.test",
        body: "Hello",
        personalization_note: "Unsafe subject"
      }),
    /single safe header line/
  );
});

test("rendered outreach email contains ad disclosure, postal address, and opt-out", () => {
  const draft = buildFallbackOutreachDraft({
    businessName: "Corner <Cafe>",
    city: "Newark",
    valueProposition: "Mise turns daily inventory, prep, and ordering signals into one compact workflow.",
    sequenceNumber: 0
  });
  const rendered = renderOutreachEmail({
    draft,
    companyName: "Mise",
    postalAddress: "123 Market St, Newark, NJ 07102",
    unsubscribeUrl: "https://example.test/unsubscribe?token=abc",
    ctaUrl: "https://mise.example/demo"
  });

  assert.match(rendered.text, /commercial message from Mise/i);
  assert.match(rendered.text, /123 Market St/);
  assert.match(rendered.text, /Unsubscribe: https:\/\/example\.test/);
  assert.match(rendered.html, /Unsubscribe from future Mise marketing emails/);
  assert.doesNotMatch(rendered.html, /Corner <Cafe>/);
  assert.match(rendered.html, /Corner &lt;Cafe&gt;/);
});

test("send windows are evaluated in the campaign timezone", () => {
  const policy = {
    timezone: "America/New_York",
    sendWindowStartHour: 9,
    sendWindowEndHour: 17,
    sendWeekdays: [1, 2, 3, 4, 5]
  };

  assert.equal(isWithinOutreachSendWindow(new Date("2026-07-17T14:00:00.000Z"), policy), true);
  assert.equal(isWithinOutreachSendWindow(new Date("2026-07-18T14:00:00.000Z"), policy), false);
  assert.equal(isWithinOutreachSendWindow(new Date("2026-07-17T23:00:00.000Z"), policy), false);
});

test("hard bounces, complaints, and provider suppressions stop outreach", () => {
  assert.equal(suppressionReasonForProviderEvent("email.bounced"), "hard_bounce");
  assert.equal(suppressionReasonForProviderEvent("email.complained"), "spam_complaint");
  assert.equal(suppressionReasonForProviderEvent("email.suppressed"), "provider_suppression");
  assert.equal(suppressionReasonForProviderEvent("email.delivered"), null);
});

test("outreach backend remains service-only and keeps provider secrets outside Expo", () => {
  const migration = readFileSync("supabase/migrations/20260718010000_outreach_agent.sql", "utf8");
  const functionSource = readFileSync("supabase/functions/outreach-agent/index.ts", "utf8");
  const unsubscribeSource = readFileSync("supabase/functions/outreach-unsubscribe/index.ts", "utf8");
  const webhookSource = readFileSync("supabase/functions/outreach-webhook/index.ts", "utf8");
  const functionConfig = readFileSync("supabase/config.toml", "utf8");

  for (const table of [
    "outreach_campaigns",
    "outreach_leads",
    "outreach_enrollments",
    "outreach_messages",
    "outreach_suppressions",
    "outreach_events",
    "outreach_agent_runs"
  ]) {
    assert.match(migration, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"));
    assert.match(migration, new RegExp(`revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+anon,\\s*authenticated`, "i"));
  }

  assert.match(functionSource, /MISE_OUTREACH_AGENT_SECRET/);
  assert.match(functionSource, /RESEND_API_KEY/);
  assert.match(functionSource, /OPENAI_API_KEY/);
  assert.doesNotMatch(functionSource, /EXPO_PUBLIC_(RESEND|OPENAI|OUTREACH)/);
  for (const functionName of ["outreach-agent", "outreach-unsubscribe", "outreach-webhook"]) {
    assert.match(functionConfig, new RegExp(`\\[functions\\.${functionName}\\]\\s*verify_jwt\\s*=\\s*false`, "i"));
  }
  assert.match(
    functionSource,
    /await\s+requireAgentSecret\(req\);[\s\S]*?await\s+readJsonObject\(req\);[\s\S]*?createServiceClient\(\)/,
    "agent authentication must happen before request parsing and service-role credential loading"
  );
  assert.match(
    webhookSource,
    /new\s+Webhook\(webhookSecret\)\.verify\([\s\S]*?createServiceClient\(\)/,
    "webhook signatures must be verified before service-role credential loading"
  );
  assert.match(
    unsubscribeSource,
    /if\s*\(!isUuid\(token\)\)[\s\S]*?Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/,
    "unsubscribe capability tokens must be validated before service-role credential loading"
  );
});

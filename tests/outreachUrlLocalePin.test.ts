import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  matchesOutreachHttpUrlPrefix,
  normalizeOutreachLead
} from "../services/domain/outreach";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927060000_mise_005ai_outreach_url_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalOutreach = readFileSync(
  new URL("../supabase/migrations/20260718010000_outreach_agent.sql", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/outreach_url_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/outreach.ts", import.meta.url),
  "utf8"
);
const agent = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);

test("MISE-005AI pins outreach HTTP(S) URL CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AI"), "additive pin must stay labeled");
  assert.ok(
    migration.includes(`cta_url collate "C" ~* '^https?://'`),
    "cta_url CHECK must pin COLLATE C"
  );
  assert.ok(
    migration.includes(`source_url collate "C" ~* '^https?://'`),
    "source_url CHECK must pin COLLATE C"
  );
  assert.ok(
    migration.includes(`website collate "C" ~* '^https?://'`),
    "website CHECK must pin COLLATE C"
  );
  assert.match(migration, /add constraint outreach_campaign_cta_url check \(/);
  assert.match(migration, /add constraint outreach_leads_source_url_check check \(/);
  assert.match(migration, /add constraint outreach_lead_website_url check \(/);
  // Compose: do not rewrite email/normalized keys owned by open #420/#421.
  assert.doesNotMatch(migration, /email_normalized/);
  assert.doesNotMatch(migration, /sender_email/);
  assert.doesNotMatch(migration, /reply_to/);
  assert.doesNotMatch(migration, /outreach_suppressions/);
  assert.doesNotMatch(migration, /create or replace function (public|private)\./i);
});

test("outreach agent originally left URL CHECKs on bare ~*", () => {
  assert.ok(
    originalOutreach.includes(`cta_url is null or cta_url ~* '^https?://'`),
    "original cta_url CHECK used bare ~*"
  );
  assert.ok(
    originalOutreach.includes(`source_url text not null check (source_url ~* '^https?://')`),
    "original source_url CHECK used bare ~*"
  );
  assert.ok(
    originalOutreach.includes(`website is null or website ~* '^https?://'`),
    "original website CHECK used bare ~*"
  );
  assert.doesNotMatch(originalOutreach, /cta_url collate "C"/);
  assert.doesNotMatch(originalOutreach, /source_url collate "C"/);
  assert.doesNotMatch(originalOutreach, /website collate "C"/);
});

test("pgTAP fixture pins all three outreach URL CHECK sites", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /outreach_campaign_cta_url/);
  assert.match(pgTap, /outreach_leads_source_url_check/);
  assert.match(pgTap, /outreach_lead_website_url/);
  assert.match(pgTap, /cta_url CHECK uses COLLATE C/);
  assert.match(pgTap, /source_url CHECK uses COLLATE C/);
  assert.match(pgTap, /website CHECK uses COLLATE C/);
});

test("matchesOutreachHttpUrlPrefix mirrors COLLATE C ~* https?://", () => {
  assert.match(domain, /MISE-005AI/);
  assert.match(domain, /OUTREACH_HTTP_URL_PREFIX/);
  assert.equal(matchesOutreachHttpUrlPrefix("https://mise.example/demo"), true);
  assert.equal(matchesOutreachHttpUrlPrefix("http://mise.example/demo"), true);
  assert.equal(matchesOutreachHttpUrlPrefix("HTTP://mise.example/demo"), true);
  assert.equal(matchesOutreachHttpUrlPrefix("HTTPS://mise.example/demo"), true);
  assert.equal(matchesOutreachHttpUrlPrefix("ftp://mise.example/demo"), false);
  assert.equal(matchesOutreachHttpUrlPrefix("not-a-url"), false);
  assert.equal(matchesOutreachHttpUrlPrefix("//mise.example/demo"), false);
});

test("normalizeOutreachLead rejects non-http(s) source URLs via shared prefix", () => {
  assert.throws(
    () =>
      normalizeOutreachLead({
        businessName: "Corner Cafe",
        email: "ops@corner.example",
        sourceUrl: "ftp://corner.example/contact",
        contactBasis: "public_business_contact"
      }),
    /sourceUrl must be an HTTP\(S\) URL/
  );
});

test("outreach agent optionalHttpUrl uses matchesOutreachHttpUrlPrefix", () => {
  assert.match(agent, /matchesOutreachHttpUrlPrefix/);
  assert.match(
    agent,
    /if \(!matchesOutreachHttpUrlPrefix\(text\)\) \{\s*throw new HttpError\(400/
  );
});

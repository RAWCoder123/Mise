import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  matchesOutreachEmailShape,
  normalizeOutreachEmail
} from "../services/domain/outreach";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926072000_mise_005m_outreach_campaign_email_locale_pin.sql",
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
    "../supabase/tests/database/outreach_campaign_email_locale_pin.test.sql",
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

test("MISE-005M pins outreach_campaigns sender/reply email CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005M"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint outreach_campaigns_sender_email_check check \([\s\S]*sender_email collate "C" ~/
  );
  assert.match(
    migration,
    /add constraint outreach_campaigns_reply_to_check check \([\s\S]*reply_to collate "C" ~/
  );
  assert.match(
    migration,
    /sender_email collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.match(
    migration,
    /reply_to collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  // Compose with MISE-005L: do not rewrite lead/suppression generated keys.
  assert.doesNotMatch(migration, /email_normalized/);
  assert.doesNotMatch(migration, /outreach_suppressions/);
  assert.doesNotMatch(migration, /create or replace function (public|private)\./i);
  assert.doesNotMatch(migration, /alter table public\.outreach_leads/i);
  assert.doesNotMatch(migration, /alter table public\.outreach_suppressions/i);
});

test("outreach agent originally left campaign email CHECKs on bare ~* [[:space:]]", () => {
  assert.match(
    originalOutreach,
    /sender_email text not null check \(sender_email ~\* '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'\)/
  );
  assert.match(
    originalOutreach,
    /reply_to text not null check \(reply_to ~\* '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'\)/
  );
  assert.doesNotMatch(
    originalOutreach,
    /sender_email collate "C" ~/
  );
  assert.doesNotMatch(
    originalOutreach,
    /reply_to collate "C" ~/
  );
});

test("pgTAP fixture pins both campaign email CHECK sites", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /outreach_campaigns_sender_email_check/);
  assert.match(pgTap, /outreach_campaigns_reply_to_check/);
  assert.match(pgTap, /sender_email CHECK uses COLLATE C/);
  assert.match(pgTap, /reply_to CHECK uses COLLATE C/);
  assert.match(pgTap, /\[\[:space:\]\]/);
});

test("matchesOutreachEmailShape mirrors ASCII C [[:space:]] rejection", () => {
  assert.match(domain, /MISE-005M/);
  assert.match(domain, /OUTREACH_EMAIL_SHAPE/);
  assert.equal(matchesOutreachEmailShape("ops@mise.example"), true);
  assert.equal(matchesOutreachEmailShape("ops\t@mise.example"), false);
  assert.equal(matchesOutreachEmailShape("ops\n@mise.example"), false);
  assert.equal(matchesOutreachEmailShape("ops mise@example.test"), false);
  assert.equal(matchesOutreachEmailShape("not-an-email"), false);
  // JS \\s would reject NBSP; COLLATE C [[:space:]] does not treat U+00A0 as space.
  assert.equal(matchesOutreachEmailShape("ops\u00a0@mise.example"), true);
});

test("outreach agent requireEmail uses matchesOutreachEmailShape", () => {
  assert.match(agent, /matchesOutreachEmailShape/);
  assert.match(
    agent,
    /if \(!matchesOutreachEmailShape\(email\)\) throw new HttpError\(400/
  );
  assert.doesNotMatch(
    agent,
    /if \(!\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\/\.test\(email\)\)/
  );
});

test("normalizeOutreachEmail remains available for discovery-key callers", () => {
  assert.equal(normalizeOutreachEmail("HELLO@CORNER.EXAMPLE "), "hello@corner.example");
});

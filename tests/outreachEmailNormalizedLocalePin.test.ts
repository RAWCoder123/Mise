import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeOutreachEmail } from "../services/domain/outreach";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926061000_mise_005l_outreach_email_normalized_locale_pin.sql",
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
    "../supabase/tests/database/outreach_email_normalized_locale_pin.test.sql",
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

test("MISE-005L pins outreach email_normalized generation to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005L"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add column email_normalized text generated always as \([\s\S]*collate "C"[\s\S]*\) stored/i
  );
  assert.match(
    migration,
    /pg_catalog\.lower\(pg_catalog\.btrim\(email\) collate "C"\) collate "C"/
  );
  assert.match(
    migration,
    /add constraint outreach_leads_email_normalized_key unique \(email_normalized\)/
  );
  assert.match(
    migration,
    /add constraint outreach_suppressions_email_normalized_key unique \(email_normalized\)/
  );
  assert.match(
    migration,
    /email collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  // Email discovery must not accent-fold mailboxes.
  assert.doesNotMatch(migration, /fold_purchase_line_accents/);
  // Keep Edge auth/service gates out of this CHECK/generated-column pin.
  assert.doesNotMatch(
    migration,
    /create or replace function (public|private)\./i
  );
});

test("outreach agent originally left email_normalized on bare lower(btrim(email))", () => {
  assert.match(
    originalOutreach,
    /email_normalized text generated always as \(lower\(btrim\(email\)\)\) stored/
  );
  assert.doesNotMatch(originalOutreach, /lower\(btrim\(email\) collate "C"\)/);
  assert.match(
    originalOutreach,
    /email ~\* '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
});

test("pgTAP pins outreach email_normalized generation to COLLATE C", () => {
  assert.ok(pgTap.includes("MISE-005L"));
  assert.match(pgTap, /outreach_leads\.email_normalized generation uses COLLATE C/);
  assert.match(pgTap, /outreach_suppressions\.email_normalized generation uses COLLATE C/);
  assert.match(pgTap, /Turkish I \(U\+0130\) is not folded under COLLATE C/);
  assert.match(pgTap, /ASCII upper mailbox folds under COLLATE C/);
  assert.match(pgTap, /select plan\(10\)/);
});

test("normalizeOutreachEmail matches lower(btrim(email) COLLATE C)", () => {
  assert.match(
    domain,
    /replace\(\/\^ \+\/, ""\)\.replace\(\/ \+\$\/, ""\)/
  );
  assert.match(domain, /replace\(\/\[A-Z\]\/g/);
  assert.equal(normalizeOutreachEmail("HELLO@CORNER.EXAMPLE "), "hello@corner.example");
  assert.equal(normalizeOutreachEmail("Cafe@Example.TEST"), "cafe@example.test");
  // Unicode toLowerCase would fold U+0130; COLLATE C must leave it unchanged.
  assert.equal(
    normalizeOutreachEmail("\u0130stanbul@example.test"),
    "\u0130stanbul@example.test"
  );
  // Do not accent-fold mailboxes.
  assert.equal(normalizeOutreachEmail("Café@example.test"), "café@example.test");
  assert.notEqual(
    normalizeOutreachEmail("Café@example.test"),
    "cafe@example.test"
  );
});

test("outreach agent queries email_normalized through normalizeOutreachEmail", () => {
  assert.match(agent, /normalizeOutreachEmail/);
  assert.match(
    agent,
    /normalizeOutreachEmail\(requireString\(value, fieldName, 320\)\)/
  );
  assert.match(
    agent,
    /eq\("email_normalized", normalizeOutreachEmail\(claim\.lead\.email\)\)/
  );
  assert.doesNotMatch(
    agent,
    /eq\("email_normalized", claim\.lead\.email\.toLowerCase\(\)\)/
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requireSetupAttachmentLabel } from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261006000000_mise_005ij_setup_attachments_label_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260625212050_operational_constraints.sql",
    import.meta.url
  ),
  "utf8"
);
const writer = readFileSync(
  new URL(
    "../supabase/migrations/20260713103021_atomic_setup_and_operational_signals.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const setupApplication = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/setup_attachments_label_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IJ pins setup_attachments.label CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IJ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint setup_attachments_metadata_only_check check \(\s*length\(trim\(label\)\) between 1 and 240\s*and label collate "C" !~ '\[\[:cntrl:\]\]'\s*and metadata \? 'storage_status'\s*and metadata->>'storage_status' = 'metadata_only'\s*\)/
  );
  assert.ok(
    migration.includes(`label collate "C" !~ '[[:cntrl:]]'`),
    "setup attachment label CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(label)) between 1 and 240"),
    "label length bound must align with save_restaurant_setup writer"
  );
  assert.ok(
    migration.includes("metadata->>'storage_status' = 'metadata_only'"),
    "metadata_only storage_status contract must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite setup writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);

  const attachedCheck = migration.match(
    /add constraint setup_attachments_metadata_only_check check \(([\s\S]*?)\)\s*;/
  );
  assert.ok(attachedCheck, "migration must reattach metadata_only_check");
  assert.doesNotMatch(
    attachedCheck[1],
    /\bkind\b|\bqueued\b|\bcsv\b|\bscreenshot\b/i,
    "reattached CHECK must not expand into kind/status vocabulary"
  );
  assert.match(
    migration,
    /not ilike '%kind%'/,
    "must leave kind/status vocabulary untouched"
  );
});

test("original setup_attachments label CHECK was length>0 only; writer already bounds 1..240", () => {
  assert.match(
    original,
    /add constraint setup_attachments_metadata_only_check\s+check \(\s*length\(trim\(label\)\) > 0 and\s+metadata \? 'storage_status' and\s+metadata->>'storage_status' = 'metadata_only'\s*\)/
  );
  assert.doesNotMatch(
    original,
    /setup_attachments_metadata_only_check[\s\S]*?\[\[:cntrl:\]\]/
  );
  assert.match(
    writer,
    /length\(payload\.label\) not between 1 and 240/
  );
});

test("requireSetupAttachmentLabel rejects ASCII C control characters", () => {
  assert.equal(requireSetupAttachmentLabel(" Weekly CSV "), "Weekly CSV");
  assert.equal(requireSetupAttachmentLabel("   "), "Setup reference");
  assert.throws(
    () => requireSetupAttachmentLabel("Weekly\tCSV"),
    /without control characters/
  );
  assert.throws(
    () => requireSetupAttachmentLabel("Weekly\nCSV"),
    /without control characters/
  );
  assert.throws(
    () => requireSetupAttachmentLabel("Weekly\u007fCSV"),
    /without control characters/
  );
  assert.match(
    validation,
    /export function requireSetupAttachmentLabel[\s\S]*hasControlCharacters\(normalized\)/
  );
  assert.match(
    validation,
    /function hasControlCharacters\(value: string\) \{\s*return \/\[\\u0000-\\u001f\\u007f\]\/\.test\(value\);/
  );
  assert.match(
    setupApplication,
    /requireSetupAttachmentLabel\(attachment\.label\)/
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /label collate "C" !~/);
  assert.match(pgTap, /\[\[:cntrl:\]\]/);
  assert.match(pgTap, /tab in setup attachment label is rejected/);
  assert.match(pgTap, /newline in setup attachment label is rejected/);
  assert.match(pgTap, /public\.setup_attachments/);
  assert.match(pgTap, /between 1 and 240/);
  assert.match(pgTap, /metadata_only/);
});

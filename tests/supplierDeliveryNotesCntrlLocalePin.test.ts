import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  requireSupplierDeliveryDiscrepancyReason,
  requireSupplierDeliveryNotes
} from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001190000_mise_005eo_supplier_delivery_notes_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_delivery_notes_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005EO pins supplier delivery note CHECKs to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EO"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_deliveries_notes_bound_check check \(\s*notes is null\s*or \(\s*length\(notes\) <= 2000\s*and notes collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.match(
    migration,
    /add constraint supplier_delivery_items_reason_bound_check check \(\s*discrepancy_reason is null\s*or \(\s*length\(discrepancy_reason\) <= 500\s*and discrepancy_reason collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`notes collate "C" !~ '[[:cntrl:]]'`),
    "supplier delivery notes CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(`discrepancy_reason collate "C" !~ '[[:cntrl:]]'`),
    "discrepancy_reason CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(migration.includes("length(notes) <= 2000"), "exact notes length bound must be preserved");
  assert.ok(
    migration.includes("length(discrepancy_reason) <= 500"),
    "exact discrepancy_reason length bound must be preserved"
  );
  assert.ok(migration.includes("notes is null"), "notes nullability must be preserved");
  assert.ok(
    migration.includes("discrepancy_reason is null"),
    "discrepancy_reason nullability must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite delivery RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_supplier_order_delivery/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /insights_content_bounds/i);
});

test("original supplier delivery note CHECKs had length only without cntrl gate", () => {
  assert.match(
    original,
    /constraint supplier_deliveries_notes_bound_check\s+check \(notes is null or length\(notes\) <= 2000\)/
  );
  assert.match(
    original,
    /constraint supplier_delivery_items_reason_bound_check\s+check \(discrepancy_reason is null or length\(discrepancy_reason\) <= 500\)/
  );
  assert.doesNotMatch(
    original,
    /supplier_deliveries_notes_bound_check[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
  assert.doesNotMatch(
    original,
    /supplier_delivery_items_reason_bound_check[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("requireSupplierDeliveryNotes rejects ASCII C control characters", () => {
  assert.equal(requireSupplierDeliveryNotes(" Three heads missing "), "Three heads missing");
  assert.equal(requireSupplierDeliveryNotes(""), null);
  assert.equal(requireSupplierDeliveryNotes(null), null);
  assert.throws(
    () => requireSupplierDeliveryNotes("Three heads\tmissing"),
    /without control characters/
  );
  assert.throws(
    () => requireSupplierDeliveryNotes("Three heads\nmissing"),
    /without control characters/
  );
  assert.throws(
    () => requireSupplierDeliveryNotes("Three heads\u007fmissing"),
    /without control characters/
  );
  assert.throws(
    () => requireSupplierDeliveryNotes("A".repeat(2001)),
    /2000 characters/
  );
  assert.match(
    validation,
    /export function requireSupplierDeliveryNotes[\s\S]*hasControlCharacters\(normalized\)/
  );
});

test("requireSupplierDeliveryDiscrepancyReason rejects ASCII C control characters", () => {
  assert.equal(requireSupplierDeliveryDiscrepancyReason(" Short "), "Short");
  assert.equal(requireSupplierDeliveryDiscrepancyReason(""), null);
  assert.throws(
    () => requireSupplierDeliveryDiscrepancyReason("Short\treason"),
    /without control characters/
  );
  assert.throws(
    () => requireSupplierDeliveryDiscrepancyReason("Short\nreason"),
    /without control characters/
  );
  assert.throws(
    () => requireSupplierDeliveryDiscrepancyReason("Short\u007freason"),
    /without control characters/
  );
  assert.throws(
    () => requireSupplierDeliveryDiscrepancyReason("B".repeat(501)),
    /500 characters/
  );
  assert.match(
    validation,
    /export function requireSupplierDeliveryDiscrepancyReason[\s\S]*hasControlCharacters\(normalized\)/
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(/^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim)
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.ok(
    pgTap.includes(`notes collate "C" !~ ''[[:cntrl:]]''`),
    "pgTAP must exercise the exact COLLATE C cntrl class for notes"
  );
  assert.ok(
    pgTap.includes(`discrepancy_reason collate "C" !~ ''[[:cntrl:]]''`),
    "pgTAP must exercise the exact COLLATE C cntrl class for discrepancy_reason"
  );
  assert.match(pgTap, /length\\\(notes\\\) <= 2000/);
  assert.match(pgTap, /length\\\(discrepancy_reason\\\) <= 500/);
  assert.match(pgTap, /tab in supplier delivery note text is rejected/);
  assert.match(pgTap, /DEL in supplier delivery note text is rejected/);
});

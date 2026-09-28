import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928160000_mise_005bq_purchase_line_normalized_item_key_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const purchaseLineLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_line_normalized_item_key_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005BQ pins purchase_lines.normalized_item_key cntrl CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BQ"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint purchase_lines_normalized_item_key_check check \(/i
  );
  assert.match(
    migration,
    /normalized_item_key collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(migration, /length\(normalized_item_key\) between 1 and 500/);
  assert.match(migration, /normalized_item_key is null/);

  // Preserve normalize equality CHECK; only replace the length-only shape gate.
  assert.match(migration, /con\.conname <> 'purchase_lines_normalized_key_check'/);
  assert.match(
    migration,
    /not ilike '%normalize_purchase_item_key%'/
  );

  // Compose: CHECK-only. Do not rewrite normalize helpers, contested ingest /
  // append stacks, or the four text CHECKs owned by #414.
  // The drop loop may mention normalize_purchase_item_key only as a filter
  // string to avoid dropping the equality CHECK — that is intentional.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /private\.normalize_purchase_item_key/i);
  assert.doesNotMatch(sqlBody, /purchase_line_text/i);
  assert.doesNotMatch(sqlBody, /purchase_line_has_control_characters/i);
  assert.doesNotMatch(sqlBody, /ingest_purchase_lines/i);
  assert.doesNotMatch(sqlBody, /append_purchase_line/i);
  assert.doesNotMatch(sqlBody, /source_document_reference/i);
  assert.doesNotMatch(sqlBody, /raw_item_description/i);
  assert.doesNotMatch(sqlBody, /unit_of_measure/i);
  assert.doesNotMatch(sqlBody, /pack_size/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("foundation normalized_item_key CHECK was length-only without cntrl", () => {
  assert.match(
    purchaseLineLedger,
    /normalized_item_key text check \(\s*normalized_item_key is null\s*or pg_catalog\.length\(normalized_item_key\) between 1 and 500\s*\)/m
  );
  assert.doesNotMatch(
    purchaseLineLedger,
    /normalized_item_key collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    purchaseLineLedger,
    /constraint purchase_lines_normalized_key_check check \(/
  );
});

test("nullable length+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedNormalizedItemKey = (value: string | null) =>
    value === null ||
    (value.length >= 1 &&
      value.length <= 500 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedNormalizedItemKey(null), true);
  assert.equal(isAllowedNormalizedItemKey("chicken breast"), true);
  assert.equal(isAllowedNormalizedItemKey("a".repeat(500)), true);
  assert.equal(isAllowedNormalizedItemKey("a".repeat(501)), false);
  assert.equal(isAllowedNormalizedItemKey(""), false);
  assert.equal(isAllowedNormalizedItemKey("chicken\tbreast"), false);
  assert.equal(isAllowedNormalizedItemKey("chicken\u007fbreast"), false);
  assert.equal(isAllowedNormalizedItemKey("chicken\nbreast"), false);
});

test("pgTAP fixture pins purchase_lines.normalized_item_key CHECK site", () => {
  assert.match(pgTap, /select plan\(9\)/);
  assert.match(pgTap, /purchase_lines_normalized_item_key_check exists/);
  assert.match(
    pgTap,
    /purchase_lines_normalized_key_check \(normalize equality\) still exists/
  );
  assert.match(pgTap, /purchase_lines\.normalized_item_key CHECK allows NULL/);
  assert.match(
    pgTap,
    /purchase_lines\.normalized_item_key CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /purchase_lines\.normalized_item_key CHECK preserves length 1–500 bound/
  );
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII normalized item key is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
  assert.match(
    pgTap,
    /max-length printable ASCII key is not a control under COLLATE C/
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INVENTORY_EVENT_METADATA_MAX_BYTES,
  INVENTORY_EVENT_REASON_CODE_MAX_CHARACTERS
} from "../services/domain/securityLimits";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260903140000_bound_inventory_event_reason_metadata.sql",
    import.meta.url
  ),
  "utf8"
);

const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);

const pgTap = readFileSync(
  new URL("../supabase/tests/database/inventory_event_ledger.test.sql", import.meta.url),
  "utf8"
);

test("additive migration bounds reason_code and metadata on the ledger RPC and table", () => {
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+public\.record_inventory_event/i
  );
  assert.match(migration, /security\s+definer[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    new RegExp(
      String.raw`char_length\(normalized_reason\)\s*>\s*${INVENTORY_EVENT_REASON_CODE_MAX_CHARACTERS}`,
      "i"
    )
  );
  assert.match(
    migration,
    /Inventory event reason code is too long/i
  );
  assert.match(
    migration,
    new RegExp(
      String.raw`octet_length\(safe_metadata::text\)\s*>\s*${INVENTORY_EVENT_METADATA_MAX_BYTES}`,
      "i"
    )
  );
  assert.match(migration, /Inventory event metadata is too large/i);
  assert.match(
    migration,
    /add constraint inventory_events_reason_code_length_check[\s\S]*char_length\(reason_code\)\s*<=\s*80/i
  );
  assert.match(
    migration,
    /add constraint inventory_events_metadata_byte_length_check[\s\S]*octet_length\(metadata::text\)\s*<=\s*8192/i
  );
  // Privileges stay manager-authenticated; no client DML grant is introduced.
  assert.doesNotMatch(
    migration,
    /grant\s+(insert|update|delete)[\s\S]*inventory_events[\s\S]*to\s+authenticated/i
  );
});

test("foundation RPC historically lacked reason and metadata size guards", () => {
  assert.doesNotMatch(
    foundation,
    /Inventory event reason code is too long/i
  );
  assert.doesNotMatch(
    foundation,
    /Inventory event metadata is too large/i
  );
  assert.doesNotMatch(
    foundation,
    /inventory_events_reason_code_length_check/i
  );
});

test("pgTAP rejects oversized reason codes and metadata through the RPC", () => {
  assert.match(pgTap, /select plan\(28\)/i);
  assert.match(pgTap, /Inventory event reason code is too long/i);
  assert.match(pgTap, /Inventory event metadata is too large/i);
  assert.match(pgTap, /repeat\('r',\s*81\)/i);
  assert.match(pgTap, /repeat\('n',\s*8200\)/i);
});

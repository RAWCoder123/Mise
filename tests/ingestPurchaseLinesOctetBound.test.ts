import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ingestPurchaseLines } from "../services/application/purchaseLines";
import { setMiseRepositoryForTesting } from "../services/application/repository";
import {
  PURCHASE_LINE_INGEST_MAX_BYTES,
  PURCHASE_LINE_INGEST_MAX_LINES
} from "../services/domain/securityLimits";
import type { MiseRepository } from "../services/repositories/repositoryContracts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926011100_mise_005g_ingest_purchase_lines_octet_bound.sql",
    import.meta.url
  ),
  "utf8"
);
const ledger = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const delivery = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const securityLimits = readFileSync(
  new URL("../services/domain/securityLimits.ts", import.meta.url),
  "utf8"
);
const application = readFileSync(
  new URL("../services/application/purchaseLines.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/ingest_purchase_lines_octet_bound.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005G pins ingest_purchase_lines to a 256 KiB octet_length ceiling", () => {
  assert.ok(migration.includes("MISE-005G"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function public\.ingest_purchase_lines[\s\S]*security definer[\s\S]*set search_path = ''/
  );
  assert.match(
    migration,
    /pg_catalog\.octet_length\(p_lines::text\) > 262144/
  );
  assert.match(
    migration,
    /raise exception 'Purchase line payload exceeds the allowed size'/
  );
  assert.doesNotMatch(
    migration,
    /pg_column_size\s*\(\s*p_lines\s*\)/,
    "must not use restore-unsafe pg_column_size for the ingest guard"
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.append_purchase_line/i,
    "must not rewrite append_purchase_line (open MISE-006 owns that path)"
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.record_supplier_delivery/i,
    "must not rewrite contested receive"
  );
  assert.match(
    migration,
    /grant execute on function public\.ingest_purchase_lines\(uuid, text, text, jsonb, uuid, uuid\)\nto authenticated/
  );
});

test("MISE-004C originally left ingest without a byte ceiling (prove the gap)", () => {
  const ingestStart = ledger.indexOf(
    "create or replace function public.ingest_purchase_lines("
  );
  const ingestEnd = ledger.indexOf(
    "revoke all on function public.ingest_purchase_lines",
    ingestStart
  );
  assert.ok(ingestStart >= 0 && ingestEnd > ingestStart);
  const ingestBody = ledger.slice(ingestStart, ingestEnd);
  assert.match(
    ingestBody,
    /jsonb_array_length\(p_lines\) not between 1 and 500/
  );
  assert.doesNotMatch(ingestBody, /octet_length\s*\(\s*p_lines/i);
  assert.doesNotMatch(ingestBody, /pg_column_size\s*\(\s*p_lines/i);
});

test("delivery already used a 256 KiB p_lines ceiling (contract parity)", () => {
  assert.match(
    delivery,
    /jsonb_array_length\(p_lines\) not between 1 and 200[\s\S]*pg_column_size\(p_lines\) > 262144/
  );
});

test("domain constants lockstep with the SQL ceiling", () => {
  assert.equal(PURCHASE_LINE_INGEST_MAX_BYTES, 256 * 1024);
  assert.equal(PURCHASE_LINE_INGEST_MAX_LINES, 500);
  assert.match(securityLimits, /PURCHASE_LINE_INGEST_MAX_BYTES = 256 \* 1024/);
  assert.match(securityLimits, /PURCHASE_LINE_INGEST_MAX_LINES = 500/);
  assert.match(securityLimits, /MISE-005G/);
});

test("application ingest preflight mirrors the SQL ceiling before the RPC", () => {
  assert.match(application, /PURCHASE_LINE_INGEST_MAX_BYTES/);
  assert.match(application, /PURCHASE_LINE_INGEST_MAX_LINES/);
  assert.match(
    application,
    /Purchase line payload exceeds the allowed size/
  );
  assert.match(
    application,
    /Between 1 and 500 purchase lines are required/
  );
  assert.match(application, /toPurchaseLinePayload/);
  assert.match(application, /utf8ByteLength/);
});

test("pgTAP fixture asserts the live function body carries the octet_length guard", () => {
  // Plan derived from assertion call sites in the fixture (4× select ok),
  // never from a prior run.
  assert.match(pgTap, /select plan\(4\)/);
  assert.match(pgTap, /pg_get_functiondef/);
  assert.match(pgTap, /octet_length\\\(p_lines::text\\\)/);
  assert.match(pgTap, /262144/);
  assert.match(pgTap, /Purchase line payload exceeds the allowed size/);
  assert.match(pgTap, /pg_column_size\\\(p_lines\\\)/);
});

function lineFixture(lineIndex: number, rawItemDescription: string) {
  return {
    lineIndex,
    lineType: "purchase" as const,
    rawItemDescription,
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 1,
    extendedPrice: 1,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed" as const
  };
}

test("application rejects oversized ingest payloads before calling the repository", async () => {
  let called = false;
  const restore = setMiseRepositoryForTesting({
    async ingestPurchaseLines() {
      called = true;
      throw new Error("repository must not be reached for oversized payloads");
    }
  } as unknown as MiseRepository);

  try {
    // Stay under per-field text caps (500) and the 500-line count ceiling while
    // still exceeding PURCHASE_LINE_INGEST_MAX_BYTES after JSON serialization.
    const description = "Item ".padEnd(500, "x");
    const lines = Array.from({ length: PURCHASE_LINE_INGEST_MAX_LINES }, (_, index) =>
      lineFixture(index, description)
    );
    await assert.rejects(
      () =>
        ingestPurchaseLines({
          restaurantId: "5a000000-0000-4000-8000-000000000001",
          source: "invoice",
          sourceDocumentReference: "INV-OVERSIZE",
          lines
        }),
      /Purchase line payload exceeds the allowed size/
    );
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("application rejects more than 500 lines before calling the repository", async () => {
  let called = false;
  const restore = setMiseRepositoryForTesting({
    async ingestPurchaseLines() {
      called = true;
      throw new Error("repository must not be reached for oversized line counts");
    }
  } as unknown as MiseRepository);

  try {
    const lines = Array.from({ length: PURCHASE_LINE_INGEST_MAX_LINES + 1 }, (_, index) =>
      lineFixture(index, `Item ${index}`)
    );
    await assert.rejects(
      () =>
        ingestPurchaseLines({
          restaurantId: "5a000000-0000-4000-8000-000000000001",
          source: "invoice",
          sourceDocumentReference: "INV-TOO-MANY",
          lines
        }),
      /Between 1 and 500 purchase lines are required/
    );
    assert.equal(called, false);
  } finally {
    restore();
  }
});

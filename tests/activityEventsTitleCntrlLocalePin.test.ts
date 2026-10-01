import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  activityEventFromPersistedRow,
  fromOperationalFinding,
  type PersistedActivityEventRow
} from "../services/domain/activityEvents";
import type { OperationalFinding } from "../services/domain/operationalFindings";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001260000_mise_005ev_activity_events_title_cntrl_locale_pin.sql",
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
const domain = readFileSync(
  new URL("../services/domain/activityEvents.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/activity_events_title_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

const restaurantId = "a0000000-0000-4000-8000-000000000001";

function finding(overrides: Partial<OperationalFinding> = {}): OperationalFinding {
  return {
    id: "finding_title_cntrl",
    restaurantId,
    category: "inventory",
    severity: "urgent",
    priority: "now",
    title: "Chicken may run out",
    explanation: "Usage is above forecast.",
    confidence: { score: 0.91, rationale: "Fresh count and mapped demand agree." },
    evidence: [
      {
        type: "inventory_item",
        id: "inv_chicken",
        observedAt: "2026-08-02T12:00:00.000Z",
        summary: "15.7 lb on hand"
      }
    ],
    affectedWorkflow: "purchasing",
    recommendedAction: "Approve chicken reorder",
    sourceWindow: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-02T12:00:00.000Z" },
    generatedAt: "2026-08-02T12:05:00.000Z",
    freshness: {
      state: "fresh",
      asOf: "2026-08-02T12:00:00.000Z",
      staleAfter: "2026-08-04T12:00:00.000Z",
      missingData: []
    },
    managerFeedback: {
      state: "unreviewed",
      decisionId: null,
      recordedAt: null,
      effectiveRecommendedAction: "Approve chicken reorder"
    },
    policyVersion: "beta-findings-v1",
    ...overrides
  };
}

function persistedRow(
  overrides: Partial<PersistedActivityEventRow> = {}
): PersistedActivityEventRow {
  return {
    id: "activity_title_cntrl",
    restaurant_id: restaurantId,
    event_type: "approval_required",
    category: "approvals",
    title: "Approval required",
    summary: "Chicken thighs need manager approval before send.",
    occurred_at: "2026-08-02T12:14:00.000Z",
    recorded_at: "2026-08-02T12:14:00.000Z",
    trigger_type: "recommendation_created",
    autonomy_level: 3,
    status: "waiting_for_approval",
    idempotency_key: "recommendation_created:rec_title_cntrl",
    ...overrides
  };
}

test("MISE-005EV pins activity_events.title CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EV"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint activity_events_title_check check \(\s*length\(trim\(title\)\) between 1 and 160\s*and title collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`title collate "C" !~ '[[:cntrl:]]'`),
    "activity_events title CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(title)) between 1 and 160"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite activity RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_activity/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /activity_events_summary/i);
  assert.match(
    migration,
    /not ilike '%summary%'/,
    "must leave summary bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%trigger_type%'/,
    "must leave trigger_type bounds untouched"
  );
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
});

test("original activity_events.title CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?title text not null check \(length\(trim\(title\)\) between 1 and 160\)/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?title text not null check \(length\(trim\(title\)\) between 1 and 160\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("activity builders reject ASCII C control characters in title", () => {
  assert.equal(fromOperationalFinding(finding({ title: " Chicken may run out " })).title, "Chicken may run out");
  assert.equal(
    fromOperationalFinding(finding({ title: "Chicken  may   run out" })).title,
    "Chicken may run out"
  );
  assert.throws(
    () => fromOperationalFinding(finding({ title: "Chicken\tmay run out" })),
    /without control characters/
  );
  assert.throws(
    () => fromOperationalFinding(finding({ title: "Chicken\nmay run out" })),
    /without control characters/
  );
  assert.throws(
    () => fromOperationalFinding(finding({ title: "Chicken\u0000may run out" })),
    /without control characters/
  );
  assert.throws(
    () => fromOperationalFinding(finding({ title: "Chicken\u007fmay run out" })),
    /without control characters/
  );
  assert.throws(
    () => fromOperationalFinding(finding({ title: "A".repeat(161) })),
    /without control characters|160 characters|invalid/
  );

  assert.equal(activityEventFromPersistedRow(persistedRow()).title, "Approval required");
  assert.throws(
    () => activityEventFromPersistedRow(persistedRow({ title: "Approval\trequired" })),
    /without control characters/
  );
  assert.throws(
    () => activityEventFromPersistedRow(persistedRow({ title: "Approval\u007frequired" })),
    /without control characters/
  );

  assert.match(
    domain,
    /function requiredActivityTitle[\s\S]*hasAsciiControlCharacters\(trimmed\)/
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

  assert.match(pgTap, /title collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(title\\\)\\\) between 1 and 160/);
  assert.match(pgTap, /tab in activity title is rejected/);
  assert.match(pgTap, /DEL in activity title is rejected/);
});

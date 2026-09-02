import assert from "node:assert/strict";
import test from "node:test";

import { syncDemoOperationalIssuesFromRecommendations } from "../services/demo/demoOperationalIssues";
import { createInitialDemoState } from "../services/demo/replaceableDemoData";
import { filterOperationalIssues } from "../services/domain/operationalIssues";

test("demo sync mirrors open and resolved inventory-risk issues from recommendations", () => {
  const state = createInitialDemoState();
  assert.equal((state.operationalIssues ?? []).length, 0);

  syncDemoOperationalIssuesFromRecommendations(state);
  assert.ok((state.operationalIssues ?? []).length > 0);

  for (const issue of state.operationalIssues) {
    assert.equal(issue.restaurantId, state.restaurants[0]?.id);
    assert.equal(issue.category, "inventory");
    assert.match(issue.dedupeKey, /^inventory-risk:/);
  }

  const open = filterOperationalIssues(state.operationalIssues, "open");
  const resolved = filterOperationalIssues(state.operationalIssues, "resolved");
  assert.equal(open.length + resolved.length, state.operationalIssues.length);
});

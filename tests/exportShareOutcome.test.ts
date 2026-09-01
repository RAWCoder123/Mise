import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  classifyExpoSharingSettlement,
  classifyNativeShareAction,
  isExportShareDismissalError
} from "../services/domain/exportShareOutcome";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("native share actions distinguish shared from dismissed without inventing delivery", () => {
  assert.equal(classifyNativeShareAction("sharedAction"), "shared");
  assert.equal(classifyNativeShareAction("dismissedAction"), "dismissed");
  assert.equal(classifyNativeShareAction("other"), "unconfirmed");
  assert.equal(classifyNativeShareAction(undefined), "unconfirmed");
  assert.equal(classifyNativeShareAction(null), "unconfirmed");
});

test("share dismissal errors fail closed instead of mapping to export failure", () => {
  assert.equal(isExportShareDismissalError(new Error("User did not share")), true);
  assert.equal(isExportShareDismissalError(new Error("Sharing was cancelled")), true);
  assert.equal(isExportShareDismissalError(new Error("Share canceled by user")), true);
  assert.equal(isExportShareDismissalError(new Error("dismissed")), true);
  assert.equal(isExportShareDismissalError(new Error("Sharing unavailable on this device.")), false);
  assert.equal(isExportShareDismissalError(new Error("Export too large")), false);
  assert.equal(isExportShareDismissalError(null), false);
});

test("expo-sharing settlement never claims shared on sheet close", () => {
  assert.equal(classifyExpoSharingSettlement({ platform: "ios" }), "unconfirmed");
  assert.equal(classifyExpoSharingSettlement({ platform: "android" }), "unconfirmed");
  assert.equal(
    classifyExpoSharingSettlement({ platform: "android", error: new Error("User cancelled share") }),
    "dismissed"
  );
  assert.equal(
    classifyExpoSharingSettlement({ platform: "android", error: new Error("Sharing unavailable") }),
    "unconfirmed"
  );
});

test("export UI fails closed on share dismiss and avoids success-on-sheet-close", () => {
  const exportScreen = source("app/settings/export.tsx");
  const catalog = source("i18n/catalog.ts");

  assert.match(exportScreen, /classifyNativeShareAction/);
  assert.match(exportScreen, /classifyExpoSharingSettlement/);
  assert.match(exportScreen, /isExportShareDismissalError/);
  assert.match(exportScreen, /Share\.share/);
  assert.match(exportScreen, /Platform\.OS === "ios"/);
  assert.match(exportScreen, /noticeForShareOutcome/);
  assert.match(exportScreen, /export\.notice\.dismissedTitle/);
  assert.match(exportScreen, /export\.notice\.unconfirmedTitle/);
  assert.match(exportScreen, /return classifyExpoSharingSettlement\(\{ platform: Platform\.OS \}\)/);
  assert.match(exportScreen, /if \(isExportShareDismissalError\(shareError\)\) \{\s*return "dismissed";/);
  assert.doesNotMatch(exportScreen, /Sharing\.shareAsync\([\s\S]{0,400}tone:\s*"success"/);

  assert.equal((catalog.match(/"export\.notice\.dismissedTitle":/g) || []).length, 3);
  assert.equal((catalog.match(/"export\.notice\.unconfirmedTitle":/g) || []).length, 3);
  assert.equal((catalog.match(/"export\.notice\.dismissedBody":/g) || []).length, 3);
  assert.equal((catalog.match(/"export\.notice\.unconfirmedBody":/g) || []).length, 3);
});

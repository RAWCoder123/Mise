import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
const wasteScreen = readFileSync("app/more/waste.tsx", "utf8");

test("successful account deletion clears local session even when remote signOut would fail", () => {
  assert.match(session, /clearSessionAfterAccountDeletion/);
  assert.match(session, /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.match(
    session,
    /const signOut = useCallback\(async \(\) => \{[\s\S]*?try \{[\s\S]*?await supabase\.auth\.signOut\(\);[\s\S]*?\} catch[\s\S]*?await clearSessionState\(\);/
  );

  assert.match(settings, /clearSessionAfterAccountDeletion/);
  assert.match(
    settings,
    /await deleteAccount\(restaurant\.id\);[\s\S]*?await clearSessionAfterAccountDeletion\(\);[\s\S]*?router\.replace\("\/login"\)/
  );
  assert.doesNotMatch(
    settings,
    /await deleteAccount\(restaurant\.id\);[\s\S]*?await signOut\(\);[\s\S]*?router\.replace\("\/login"\)/
  );
});

test("waste analysis summary CTA uses action-aware recovery presentation", () => {
  assert.match(wasteScreen, /presentWasteRecoveryAction/);
  assert.match(wasteScreen, /recoveryAction\.href/);
  assert.match(wasteScreen, /recoveryAction\.labelKey/);
  assert.doesNotMatch(
    wasteScreen,
    /title=\{t\("waste\.action\.record"\)\}[\s\S]{0,200}router\.push\("\/inventory"\)/
  );
});

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { publicQaEnv } from "./safe-env.mjs";
import { assertLoopbackOrigin, assertStagingPreflight } from "./staging-preflight.mjs";

const stagingUrl = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const password = process.env.MISE_STAGING_SEED_PASSWORD;
const existingBaseUrl = process.env.MISE_STAGING_CLIENT_RACE_URL;
const expoPort = Number(process.env.MISE_STAGING_CLIENT_RACE_PORT ?? 8086);
const debugPort = Number(process.env.MISE_STAGING_CLIENT_RACE_DEBUG_PORT ?? 9336);
const baseUrl = existingBaseUrl ?? `http://localhost:${expoPort}`;
const chromeCandidates = process.platform === "darwin"
  ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
const chromePath = process.env.CHROME_PATH ?? chromeCandidates.find(existsSync);
const timeoutMs = Number(process.env.MISE_STAGING_CLIENT_RACE_TIMEOUT_MS ?? 120000);
const tenantAInventoryId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const tenantBInventoryId = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";
const tenantAOrderId = "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa";
const tenantBOrderId = "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb";

if (!stagingUrl || !anonKey || !password || !process.env.SUPABASE_STAGING_PROJECT_REF || !process.env.MISE_STAGING_MARKER) {
  console.error(
    "Set SUPABASE_STAGING_URL, SUPABASE_STAGING_ANON_KEY, and MISE_STAGING_SEED_PASSWORD before running the client race suite."
  );
  process.exit(1);
}
if (!chromePath) {
  console.error("Set CHROME_PATH or install Chrome/Chromium before running the client race suite.");
  process.exit(1);
}

assertLoopbackOrigin(baseUrl, "MISE_STAGING_CLIENT_RACE_URL");
await assertStagingPreflight();

let expoProcess = null;
let chromeProcess = null;
let chromeProfile = null;
let expoOutput = "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnLogged(command, args, env, onOutput = () => {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => onOutput(chunk.toString()));
  child.stderr.on("data", (chunk) => onOutput(chunk.toString()));
  return child;
}

function stopProcess(child, signal = "SIGTERM") {
  if (!child || child.killed) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      child.kill(signal);
      return;
    }
  }
  child.kill(signal);
}

async function stopChild(child) {
  if (!child || child.killed) return;
  stopProcess(child);
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(2500).then(() => false)
  ]);
  if (!exited && !child.killed) stopProcess(child, "SIGKILL");
}

async function startExpo() {
  if (existingBaseUrl) return;
  expoProcess = spawnLogged(
    "npx",
    ["expo", "start", "--web", "--port", String(expoPort), "--host", "localhost"],
    publicQaEnv({
      CI: "1",
      EXPO_NO_TELEMETRY: "1",
      EXPO_PUBLIC_APP_ENV: "staging",
      EXPO_PUBLIC_ENABLE_DEMO_MODE: "false",
      EXPO_PUBLIC_SUPABASE_URL: stagingUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey
    }),
    (chunk) => {
      expoOutput += chunk;
    }
  );
}

async function waitForExpo() {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok && Buffer.byteLength(await response.text()) > 900) return;
    } catch {
      // Keep polling until the bounded timeout.
    }
    await sleep(750);
  }
  throw new Error(`Expo staging app did not start.\n${expoOutput.split(/\r?\n/).slice(-30).join("\n")}`);
}

async function startChrome() {
  if (typeof WebSocket === "undefined") throw new Error("Node WebSocket support is required for Chrome CDP.");
  chromeProfile = await mkdtemp(join(tmpdir(), "mise-staging-race-"));
  chromeProcess = spawnLogged(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${chromeProfile}`,
      "about:blank"
    ],
    publicQaEnv()
  );
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return;
    } catch {
      // Keep polling until Chrome exposes CDP.
    }
    await sleep(400);
  }
  throw new Error("Chrome debugging endpoint did not start.");
}

async function createTarget() {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT"
  });
  if (!response.ok) throw new Error(`Could not create Chrome target: HTTP ${response.status}`);
  const target = await response.json();
  if (!target.webSocketDebuggerUrl) throw new Error("Chrome target did not expose a CDP websocket.");
  return target.webSocketDebuggerUrl;
}

function connectCdp(webSocketUrl) {
  const ws = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result ?? {});
      return;
    }
    for (const listener of listeners.get(message.method) ?? []) listener(message.params ?? {});
  });

  return {
    async open() {
      if (ws.readyState === WebSocket.OPEN) return;
      await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve, { once: true });
        ws.addEventListener("error", reject, { once: true });
      });
    },
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(method, listener) {
      const methodListeners = listeners.get(method) ?? [];
      methodListeners.push(listener);
      listeners.set(method, methodListeners);
    },
    close() {
      ws.close();
    }
  };
}

async function evaluate(cdp, expression, returnByValue = true) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  return result.result?.value;
}

async function waitFor(cdp, expression, message, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await sleep(200);
  }
  const body = await evaluate(cdp, "document.body?.innerText ?? ''");
  throw new Error(`${message}\nVisible text:\n${String(body).slice(0, 3000)}`);
}

async function clickAria(cdp, label) {
  const clicked = await evaluate(
    cdp,
    `(() => { const node = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!node) return false; node.click(); return true; })()`
  );
  if (!clicked) {
    const body = await evaluate(cdp, "document.body?.innerText ?? ''");
    throw new Error(`Missing control with aria-label ${label}.\nVisible text:\n${String(body).slice(0, 3000)}`);
  }
}

async function clickText(cdp, text) {
  const clicked = await evaluate(
    cdp,
    `(() => { const node = [...document.querySelectorAll('button,[role="button"]')].find((item) => item.textContent?.trim().includes(${JSON.stringify(text)})); if (!node) return false; node.click(); return true; })()`
  );
  assert.equal(clicked, true, `missing control containing ${text}`);
}

async function signIn(cdp) {
  await cdp.send("Page.navigate", { url: `${baseUrl}/login` });
  await waitFor(cdp, "document.body?.innerText.includes('Open Mise')", "Login screen did not render");
  const filled = await evaluate(
    cdp,
    `(() => {
      const inputs = [...document.querySelectorAll('input')];
      if (inputs.length < 2) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(inputs[0], 'switcher@mise-staging.test');
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(inputs[1], ${JSON.stringify(password)});
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`
  );
  assert.equal(filled, true, "login inputs were not available");
  await clickText(cdp, "Sign in");
  await waitFor(
    cdp,
    `document.body?.innerText.includes('Luna Bistro') &&
      !document.body?.innerText.includes('Northside Cafe') &&
      (document.body?.innerText.includes('Review Chicken Breast reorder') ||
        document.body?.innerText.includes('Set up your restaurant'))`,
    "Dual-tenant account did not enter tenant A"
  );
  const alreadyOnTenantAToday = await evaluate(
    cdp,
    "document.body?.innerText.includes('Review Chicken Breast reorder')"
  );
  if (!alreadyOnTenantAToday) {
    await cdp.send("Page.navigate", { url: `${baseUrl}/today` });
  }
  await waitFor(
    cdp,
    "document.body?.innerText.includes('Review Chicken Breast reorder') && !document.body?.innerText.includes('Review Espresso Beans reorder')",
    "Dual-tenant account did not establish tenant A before race checks"
  );
}

function createRequestHold(cdp) {
  let predicate = null;
  let heldRequestId = null;
  let holdLabel = null;
  let observedPaths = [];
  let resolveHeld = null;
  let rejectHeld = null;
  let timeoutId = null;

  cdp.on("Fetch.requestPaused", (event) => {
    if (predicate && observedPaths.length < 12) {
      const observed = new URL(event.request.url);
      observedPaths.push(`${event.request.method} ${observed.pathname}${observed.search}`.slice(0, 500));
    }
    const shouldHold = predicate && !heldRequestId && predicate(event.request.url, event.request.method);
    if (shouldHold) {
      heldRequestId = event.requestId;
      if (timeoutId) clearTimeout(timeoutId);
      resolveHeld?.(event.request.url);
      return;
    }
    void cdp.send("Fetch.continueRequest", { requestId: event.requestId }).catch((error) => rejectHeld?.(error));
  });

  return {
    async holdNext(nextPredicate, label) {
      predicate = nextPredicate;
      heldRequestId = null;
      holdLabel = label;
      observedPaths = [];
      await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
      return new Promise((resolve, reject) => {
        resolveHeld = resolve;
        rejectHeld = reject;
        timeoutId = setTimeout(
          () => reject(new Error(`Timed out waiting for ${holdLabel}. Observed:\n${observedPaths.join("\n") || "(no requests)"}`)),
          20000
        );
      });
    },
    async release() {
      if (!heldRequestId) throw new Error("No staging request is being held.");
      const requestId = heldRequestId;
      heldRequestId = null;
      predicate = null;
      holdLabel = null;
      observedPaths = [];
      await cdp.send("Fetch.continueRequest", { requestId });
      await cdp.send("Fetch.disable");
    }
  };
}

async function switchWorkspace(cdp, targetName) {
  await clickAria(cdp, "More");
  await clickText(cdp, "Settings");
  const switchLabel = `Switch to ${targetName}`;
  const switchSelector = `[aria-label=${JSON.stringify(switchLabel)}]`;
  await waitFor(
    cdp,
    `location.pathname.includes('/settings') &&
      document.querySelector('[aria-label^="Current restaurant: "]') &&
      (() => {
        const control = document.querySelector(${JSON.stringify(switchSelector)});
        return Boolean(control && !control.disabled && control.getAttribute('aria-disabled') !== 'true');
      })()`,
    `More did not render the switch control for ${targetName}`
  );
  await clickAria(cdp, switchLabel);
  await waitFor(
    cdp,
    `document.body?.innerText.includes(${JSON.stringify(targetName)}) && document.querySelector(${JSON.stringify(`[aria-label="Current restaurant: ${targetName}"]`)})`,
    `Workspace did not switch to ${targetName}`
  );
}

async function assertTenantBOnly(cdp, tenantBMarker, tenantAMarker) {
  await waitFor(cdp, `document.body?.innerText.includes(${JSON.stringify(tenantBMarker)})`, `Tenant B marker ${tenantBMarker} did not render`);
  await sleep(750);
  const body = await evaluate(cdp, "document.body?.innerText ?? ''");
  assert.match(body, new RegExp(tenantBMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.doesNotMatch(body, new RegExp(tenantAMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

async function main() {
  await startExpo();
  await waitForExpo();
  await startChrome();
  const cdp = connectCdp(await createTarget());
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });

  try {
    await signIn(cdp);
    const hold = createRequestHold(cdp);

    await clickAria(cdp, "More");
    await clickText(cdp, "Settings");
    const todayPause = hold.holdNext(
      (requestUrl) => requestUrl.includes("/rest/v1/inventory_items") && requestUrl.includes("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      "tenant A Today inventory request"
    );
    await clickAria(cdp, "Today");
    await todayPause;
    await switchWorkspace(cdp, "Northside Cafe");
    await clickAria(cdp, "Today");
    await waitFor(
      cdp,
      "document.body?.innerText.includes('Northside Cafe ·')",
      "Tenant B Today did not load before releasing tenant A"
    );
    await hold.release();
    await assertTenantBOnly(cdp, "Northside Cafe ·", "Luna Bistro · Monday");
    console.log("Staging race passed: Today workspace switch");

    await switchWorkspace(cdp, "Luna Bistro");
    const inventoryPause = hold.holdNext(
      (requestUrl) => requestUrl.includes("/rest/v1/inventory_items") && requestUrl.includes("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      "tenant A inventory list request"
    );
    await clickAria(cdp, "Inventory");
    await inventoryPause;
    await switchWorkspace(cdp, "Northside Cafe");
    await clickAria(cdp, "Inventory");
    await waitFor(cdp, "document.body?.innerText.includes('Espresso Beans')", "Tenant B inventory did not load before releasing tenant A");
    await hold.release();
    await assertTenantBOnly(cdp, "Espresso Beans", "Chicken Breast");
    console.log("Staging race passed: inventory list workspace switch");

    await switchWorkspace(cdp, "Luna Bistro");
    await clickAria(cdp, "Inventory");
    await waitFor(cdp, "document.body?.innerText.includes('Chicken Breast')", "Tenant A inventory did not render before detail race");
    const inventoryDetailPause = hold.holdNext(
      (requestUrl) => requestUrl.includes("/rest/v1/inventory_items") && requestUrl.includes("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      "tenant A inventory detail request"
    );
    await clickText(cdp, "Chicken Breast");
    await inventoryDetailPause;
    await clickAria(cdp, "Back to inventory");
    await switchWorkspace(cdp, "Northside Cafe");
    await clickAria(cdp, "Inventory");
    await waitFor(cdp, "document.body?.innerText.includes('Espresso Beans')", "Tenant B inventory did not render for detail race");
    await clickText(cdp, "Espresso Beans");
    await waitFor(
      cdp,
      `location.pathname.includes(${JSON.stringify(tenantBInventoryId)}) && document.body?.innerText.includes('Espresso Beans')`,
      "Tenant B inventory detail did not load before releasing tenant A"
    );
    await hold.release();
    await assertTenantBOnly(cdp, "Espresso Beans", "Chicken Breast");
    await clickAria(cdp, "Back to inventory");
    console.log("Staging race passed: inventory detail workspace switch");

    await switchWorkspace(cdp, "Luna Bistro");
    const insightPause = hold.holdNext(
      (requestUrl) => requestUrl.includes("/rest/v1/insights") && requestUrl.includes("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      "tenant A insights request"
    );
    await clickAria(cdp, "More");
    await clickText(cdp, "Insights");
    await insightPause;
    await switchWorkspace(cdp, "Northside Cafe");
    await clickAria(cdp, "More");
    await clickText(cdp, "Insights");
    await waitFor(cdp, "document.body?.innerText.includes('Northside espresso')", "Tenant B insights did not load before releasing tenant A");
    await hold.release();
    await assertTenantBOnly(cdp, "Northside espresso", "Luna chicken");
    console.log("Staging race passed: insights workspace switch");

    await switchWorkspace(cdp, "Luna Bistro");
    await clickAria(cdp, "Today");
    const settingsPause = hold.holdNext(
      (requestUrl) => requestUrl.includes("/rest/v1/supplier_items") && requestUrl.includes("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      "tenant A settings supplier request"
    );
    await clickAria(cdp, "More");
    await clickText(cdp, "Settings");
    await settingsPause;
    await waitFor(
      cdp,
      `(() => {
        const control = document.querySelector('[aria-label="Switch to Northside Cafe"]');
        return Boolean(control && !control.disabled && control.getAttribute('aria-disabled') !== 'true');
      })()`,
      "Tenant B switch control did not become available during the held settings request"
    );
    await clickAria(cdp, "Switch to Northside Cafe");
    await waitFor(
      cdp,
      "document.querySelector('[aria-label=\"Current restaurant: Northside Cafe\"]') && document.body?.innerText.includes('Cafe Supply')",
      "Tenant B settings did not load before releasing tenant A"
    );
    await hold.release();
    await waitFor(cdp, "document.querySelector('[aria-label=\"Current restaurant: Northside Cafe\"]')", "More did not retain tenant B after the stale supplier response");
    await assertTenantBOnly(cdp, "Cafe Supply", "Fresh Produce Co.");
    console.log("Staging race passed: settings workspace switch");

    await switchWorkspace(cdp, "Luna Bistro");
    await clickAria(cdp, "Orders");
    await waitFor(
      cdp,
      "location.pathname === '/orders' && document.querySelector('[aria-label=\"Open Fresh Produce Co. order. Status: Draft.\"]')",
      "Tenant A order did not render"
    );
    const orderDetailPause = hold.holdNext(
      (requestUrl) => requestUrl.includes("/rest/v1/supplier_orders") && requestUrl.includes(tenantAOrderId),
      "tenant A order detail request"
    );
    await clickAria(cdp, "Open Fresh Produce Co. order. Status: Draft.");
    await orderDetailPause;
    await clickAria(cdp, "Back to orders");
    await switchWorkspace(cdp, "Northside Cafe");
    await clickAria(cdp, "Orders");
    await waitFor(
      cdp,
      "location.pathname === '/orders' && document.querySelector('[aria-label=\"Open Cafe Supply order. Status: Draft.\"]')",
      "Tenant B orders did not render for detail race"
    );
    await clickAria(cdp, "Open Cafe Supply order. Status: Draft.");
    await waitFor(
      cdp,
      `location.pathname.includes(${JSON.stringify(tenantBOrderId)}) && document.body?.innerText.includes('Cafe Supply')`,
      "Tenant B order detail did not load before releasing tenant A"
    );
    await hold.release();
    await assertTenantBOnly(cdp, "Cafe Supply", "Fresh Produce Co.");
    await clickAria(cdp, "Back to orders");
    console.log("Staging race passed: order detail workspace switch");

    await switchWorkspace(cdp, "Luna Bistro");
    await clickAria(cdp, "Orders");
    await waitFor(
      cdp,
      "location.pathname === '/orders' && document.querySelector('[aria-label=\"Open Fresh Produce Co. order. Status: Draft.\"]')",
      "Tenant A order did not render before mutation race"
    );
    const mutationPause = hold.holdNext(
      (requestUrl, method) => method === "POST" && requestUrl.includes("/rest/v1/rpc/approve_purchase_recommendation"),
      "tenant A recommendation approval mutation"
    );
    await clickText(cdp, "Open review");
    await waitFor(
      cdp,
      "document.querySelector('[aria-label=\"Approve Chicken Breast\"]')",
      "Tenant A recommendation review did not render"
    );
    await clickAria(cdp, "Approve Chicken Breast");
    await mutationPause;
    await switchWorkspace(cdp, "Northside Cafe");
    await hold.release();
    await clickAria(cdp, "Orders");
    await assertTenantBOnly(cdp, "Cafe Supply", "Fresh Produce Co.");
    console.log("Staging race passed: order mutation workspace switch");

    console.log("Mise rendered two-tenant request and mutation race checks passed.");
  } finally {
    cdp.close();
  }
}

try {
  await main();
} finally {
  await stopChild(chromeProcess);
  await stopChild(expoProcess);
  if (chromeProfile) await rm(chromeProfile, { recursive: true, force: true });
}

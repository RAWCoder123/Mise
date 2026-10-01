import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { publicQaEnv, testflightPublicQaEnv } from "./safe-env.mjs";

const baseRoutes = [
  "/",
  "/login",
  "/accept-invite",
  "/setup",
  "/home",
  "/today",
  "/inventory",
  "/inventory/count",
  "/orders",
  "/insights",
  "/more",
  "/more/waste",
  "/more/daily-brief",
  "/ask-mise",
  "/tasks/layout-smoke-task",
  "/settings",
  "/settings/export",
  "/settings/privacy",
  "/settings/terms",
  "/settings/support",
  "/settings/language",
  "/settings/gmail",
  "/settings/suppliers",
  "/settings/pos",
  "/settings/pos-mappings",
  "/settings/recipes"
];
const fallbackDetailRoutes = [
  "/inventory/00000000-0000-4000-8000-000000000101",
  "/orders/00000000-0000-4000-8000-000000000601"
];
const detailRoutePatterns = [/^\/inventory\/[0-9a-f-]{36}$/i, /^\/orders\/[0-9a-f-]{36}$/i];
const expoPort = Number(process.env.MISE_MOBILE_LAYOUT_PORT ?? 8084);
const debugPort = Number(process.env.MISE_MOBILE_LAYOUT_DEBUG_PORT ?? 9333);
const existingBaseUrl = process.env.MISE_MOBILE_LAYOUT_URL;
const baseUrl = existingBaseUrl ?? `http://localhost:${expoPort}`;
const timeoutMs = Number(process.env.MISE_MOBILE_LAYOUT_TIMEOUT_MS ?? 120000);
const interactionMode = process.env.MISE_QA_INTERACTIONS ?? "none";
if (!["none", "demo", "testflight"].includes(interactionMode)) {
  throw new Error("MISE_QA_INTERACTIONS must be none, demo, or testflight.");
}
const shouldRunInteractionQa = interactionMode !== "none";
const shouldEmulateReducedMotion = process.env.MISE_QA_REDUCED_MOTION === "1";
const screenshotPath = process.env.MISE_QA_SCREENSHOT_PATH;
const viewport = {
  width: Number(process.env.MISE_MOBILE_LAYOUT_WIDTH ?? 390),
  height: Number(process.env.MISE_MOBILE_LAYOUT_HEIGHT ?? 844),
  deviceScaleFactor: Number(process.env.MISE_MOBILE_LAYOUT_SCALE ?? 3)
};
const chromeCandidates = process.platform === "darwin"
  ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
const chromePath = process.env.CHROME_PATH ?? chromeCandidates.find(existsSync);

if (interactionMode === "testflight" && existingBaseUrl) {
  throw new Error("TestFlight interaction QA must launch its own staging-configured Expo server.");
}

const qaChildEnv = interactionMode === "testflight"
  ? testflightPublicQaEnv()
  : interactionMode === "demo"
    ? publicQaEnv({
        CI: "1",
        EXPO_NO_TELEMETRY: "1",
        EXPO_NO_DOTENV: "1",
        EXPO_PUBLIC_APP_ENV: "development",
        EXPO_PUBLIC_ENABLE_DEMO_MODE: "true"
      })
    : publicQaEnv({ CI: "1", EXPO_NO_TELEMETRY: "1" });

let expoProcess = null;
let chromeProcess = null;
let expoOutput = "";
let chromeProfileDir = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnLogged(command, args, outputSink, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: qaChildEnv,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
  child.stdout.on("data", (chunk) => {
    outputSink(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    outputSink(chunk.toString());
  });
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
  stopProcess(child, "SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(2500).then(() => false)
  ]);
  if (!exited && !child.killed) stopProcess(child, "SIGKILL");
}

async function startExpoServer() {
  if (existingBaseUrl) return;
  expoProcess = spawnLogged(
    "npx",
    ["expo", "start", "--web", "--port", String(expoPort), "--host", "localhost"],
    (chunk) => {
      expoOutput += chunk;
    }
  );
}

async function waitForExpo() {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/`);
      const body = await response.text();
      if (response.status === 200 && Buffer.byteLength(body) > 900) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  const tail = expoOutput.split(/\r?\n/).slice(-30).join("\n");
  throw new Error(
    `Expo web server did not become ready within ${timeoutMs}ms.` +
      (lastError ? ` Last error: ${lastError.message}` : "") +
      (tail ? `\nExpo output tail:\n${tail}` : "")
  );
}

async function startChrome() {
  if (typeof WebSocket === "undefined") {
    throw new Error("This Node runtime does not provide WebSocket, which is required for Chrome layout QA.");
  }
  chromeProfileDir = await mkdtemp(join(tmpdir(), "mise-chrome-"));
  chromeProcess = spawnLogged(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${chromeProfileDir}`,
      "about:blank"
    ],
    () => {}
  );
}

async function waitForChrome() {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < 30000) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Chrome debugging endpoint did not start.${lastError ? ` Last error: ${lastError.message}` : ""}`);
}

async function createTarget() {
  let response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT"
  });
  if (!response.ok) {
    response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`);
  }
  if (!response.ok) throw new Error(`Could not create Chrome target: HTTP ${response.status}`);
  const target = await response.json();
  if (!target.webSocketDebuggerUrl) throw new Error("Chrome target did not return a WebSocket debugger URL.");
  return target.webSocketDebuggerUrl;
}

function connectCdp(webSocketUrl) {
  const ws = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const events = new Map();

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method && events.has(message.method)) {
      events.get(message.method).forEach((handler) => handler(message.params ?? {}));
    }
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        on(method, handler) {
          const handlers = events.get(method) ?? [];
          handlers.push(handler);
          events.set(method, handlers);
        },
        send(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((commandResolve, commandReject) => {
            pending.set(id, { resolve: commandResolve, reject: commandReject });
          });
        },
        close() {
          ws.close();
        }
      });
    });
    ws.addEventListener("error", () => reject(new Error("Could not connect to Chrome DevTools Protocol.")));
  });
}

async function navigateAndMeasure(cdp, route, runtimeErrors) {
  const startedAt = Date.now();
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: true
  });
  await cdp.send("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [
      {
        name: "prefers-reduced-motion",
        value: shouldEmulateReducedMotion ? "reduce" : "no-preference"
      }
    ]
  });

  let loaded = false;
  const loadedPromise = new Promise((resolve) => {
    cdp.on("Page.loadEventFired", () => {
      loaded = true;
      resolve();
    });
  });

  await cdp.send("Page.navigate", { url: `${baseUrl}${route}` });
  await Promise.race([loadedPromise, sleep(15000)]);
  if (!loaded) await sleep(2000);
  await sleep(1200);

  const expression = `(() => {
    const root = document.getElementById("root");
    const doc = document.documentElement;
    const body = document.body;
    const width = window.innerWidth;
    const scrollWidth = Math.max(doc.scrollWidth || 0, body?.scrollWidth || 0, root?.scrollWidth || 0);
    const visibleText = (body?.innerText || "").replace(/\\s+/g, " ").trim();
    const wideElements = Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80);
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.className || "").slice(0, 80),
          text,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((entry) => entry.width > width + 2 || entry.right > width + 2 || entry.left < -2)
      .slice(0, 8);
    return {
      url: location.href,
      title: document.title,
      width,
      height: window.innerHeight,
      scrollWidth,
      overflowX: Math.max(0, scrollWidth - width),
      visibleTextLength: visibleText.length,
      textSample: visibleText.slice(0, 180),
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      wideElements
    };
  })()`;

  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return {
    route,
    durationMs: Date.now() - startedAt,
    runtimeErrors: [...runtimeErrors],
    ...result.result.value
  };
}

function normalizeAppRoute(href) {
  if (!href) return null;
  try {
    const url = new URL(href, baseUrl);
    if (url.origin !== new URL(baseUrl).origin) return null;
    return url.pathname;
  } catch {
    if (href.startsWith("/")) return href.split(/[?#]/)[0];
    return null;
  }
}

async function collectLinkedDetailRoutes(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => Array.from(document.querySelectorAll("a[href]")).map((anchor) => anchor.getAttribute("href")))()`,
    returnByValue: true,
    awaitPromise: true
  });
  const hrefs = Array.isArray(result.result.value) ? result.result.value : [];
  return hrefs
    .map(normalizeAppRoute)
    .filter((route) => route && detailRoutePatterns.some((pattern) => pattern.test(route)));
}

async function discoverDetailRoutes(cdp) {
  const discovered = new Set();
  for (const route of ["/inventory", "/orders"]) {
    await navigateAndMeasure(cdp, route, []);
    const linkedRoutes = await collectLinkedDetailRoutes(cdp);
    linkedRoutes.forEach((linkedRoute) => discovered.add(linkedRoute));
  }
  fallbackDetailRoutes.forEach((route) => discovered.add(route));
  return [...discovered].filter((route) => !baseRoutes.includes(route));
}

async function evaluateValue(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result.value;
}

async function waitForBrowserCondition(cdp, expression, label, waitMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < waitMs) {
    if (await evaluateValue(cdp, expression)) return;
    await sleep(150);
  }
  throw new Error("Timed out waiting for " + label + ".");
}

async function clickByRoleAndText(cdp, role, label) {
  const expression =
    "(() => {" +
    "const role=" + JSON.stringify(role) + ";" +
    "const label=" + JSON.stringify(label) + ";" +
    "const nodes=Array.from(document.querySelectorAll('[role=\"'+role+'\"]'));" +
    "const node=nodes.find((entry)=>{" +
    "const text=(entry.textContent||'').replace(/\\\\s+/g,' ').trim();" +
    "const aria=(entry.getAttribute('aria-label')||'').trim();" +
    "return text.includes(label)||aria.includes(label);" +
    "});" +
    "if(!node)return false;node.click();return true;" +
    "})()";
  const clicked = await evaluateValue(cdp, expression);
  if (!clicked) {
    const available = await evaluateValue(
      cdp,
      "(() => Array.from(document.querySelectorAll('[role=\"" + role + "\"]'))" +
        ".map((node)=>(node.textContent||node.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim())" +
        ".filter(Boolean).slice(0,12))()"
    );
    throw new Error(
      "Could not find " + role + " containing \"" + label + "\". Available: " + JSON.stringify(available)
    );
  }
  await sleep(350);
}

async function firstAriaLabel(cdp, prefix) {
  return evaluateValue(
    cdp,
    "(() => document.querySelector('[aria-label^=" +
      JSON.stringify(prefix) +
      "]')?.getAttribute('aria-label') || null)()"
  );
}

async function firstAriaLabelEnding(cdp, suffix) {
  return evaluateValue(
    cdp,
    "(() => Array.from(document.querySelectorAll('[aria-label]')).find((node)=>" +
      "(node.getAttribute('aria-label')||'').endsWith(" + JSON.stringify(suffix) + "))?.getAttribute('aria-label') || null)()"
  );
}

async function inputValueByAriaLabel(cdp, label) {
  return evaluateValue(
    cdp,
    "document.querySelector('[aria-label=" + JSON.stringify(label) + "]')?.value ?? null"
  );
}

async function clickByAriaLabel(cdp, label) {
  const clicked = await evaluateValue(
    cdp,
    "(() => { const node=document.querySelector('[aria-label=" +
      JSON.stringify(label) +
      "]'); if(!node)return false; node.click(); return true; })()"
  );
  if (!clicked) throw new Error("Could not find control \"" + label + "\".");
  await sleep(350);
}

async function setInputByAriaLabel(cdp, label, value) {
  const changed = await evaluateValue(
    cdp,
    "(() => {" +
      "const node=document.querySelector('[aria-label=" + JSON.stringify(label) + "]');" +
      "if(!node)return false;" +
      "const prototype=node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;" +
      "const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;" +
      "if(setter)setter.call(node," + JSON.stringify(value) + ");else node.value=" + JSON.stringify(value) + ";" +
      "node.dispatchEvent(new Event('input',{bubbles:true}));" +
      "node.dispatchEvent(new Event('change',{bubbles:true}));" +
      "return true;" +
      "})()"
  );
  if (!changed) throw new Error("Could not edit \"" + label + "\".");
  await sleep(200);
}

const localizedLayoutRoutes = [
  "/home",
  "/today",
  "/inventory",
  "/orders",
  "/insights",
  "/more",
  "/more/daily-brief",
  "/setup",
  "/accept-invite",
  "/settings",
  "/settings/export"
];

async function verifyLocalizedLayouts(cdp, localeLabel) {
  console.log(`Mise localized layout QA: ${localeLabel}`);
  for (const route of localizedLayoutRoutes) {
    await navigateAndMeasure(cdp, route, []);
  }
  await navigateAndMeasure(cdp, "/settings/language", []);
}

async function runAskMiseInteractionQa(cdp) {
  console.log("Mise Ask interaction QA: type question -> thinking -> visible grounded answer");
  await navigateAndMeasure(cdp, "/ask-mise", []);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('What are my top priorities today?') && Boolean(document.querySelector('[aria-label=\"Ask Mise a question\"]'))",
    "seeded Ask Mise conversation"
  );

  const question = "How are sales today?";
  await setInputByAriaLabel(cdp, "Ask Mise a question", question);
  await clickByAriaLabel(cdp, "Send question");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Sales today are') && document.body.innerText.includes('Top seller so far')",
    "grounded Ask Mise sales answer",
    15000
  );

  const answerGeometry = await evaluateValue(
    cdp,
    `(() => {
      const node = Array.from(document.querySelectorAll('*')).find((entry) =>
        entry.children.length === 0 && (entry.textContent || '').includes('Sales today are')
      );
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewport: window.innerHeight };
    })()`
  );
  if (
    !answerGeometry ||
    answerGeometry.top < 0 ||
    answerGeometry.bottom > answerGeometry.viewport
  ) {
    throw new Error(
      "Ask Mise answered outside the visible chat viewport: " + JSON.stringify(answerGeometry)
    );
  }

  console.log("Mise Ask interaction QA passed.");
}

async function runDemoInteractionQa(cdp) {
  console.log("Mise core interaction QA: initialize -> phase brief -> inventory -> Gmail simulation -> orders -> recipes -> insights -> POS -> reset");
  await evaluateValue(cdp, "localStorage.clear(); true");
  await navigateAndMeasure(cdp, "/login", []);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Demo data is ready to test')",
    "demo data launcher"
  );
  await clickByRoleAndText(cdp, "button", "Open demo data");
  await waitForBrowserCondition(
    cdp,
    "location.pathname === '/home' && document.body.innerText.includes('Sales today')",
    "initialized demo data"
  );

  await navigateAndMeasure(cdp, "/settings/language", []);
  await clickByAriaLabel(cdp, "Use Español for Mise");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Idioma de la aplicación') && Boolean(document.querySelector('[aria-label=\"Volver\"]'))",
    "Spanish operator chrome"
  );
  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(1200);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Idioma de la aplicación') && Boolean(document.querySelector('[aria-label=\"Usar Español en Mise\"]'))",
    "persisted Spanish preference"
  );
  await verifyLocalizedLayouts(cdp, "Español");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Idioma de la aplicación')",
    "Spanish language settings return"
  );

  await clickByAriaLabel(cdp, "Usar 简体中文 en Mise");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('应用语言') && Boolean(document.querySelector('[aria-label=\"返回\"]'))",
    "Simplified Chinese operator chrome"
  );
  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(1200);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('应用语言') && Boolean(document.querySelector('[aria-label=\"Mise 使用简体中文\"]'))",
    "persisted Simplified Chinese preference"
  );
  await verifyLocalizedLayouts(cdp, "简体中文");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('应用语言')",
    "Simplified Chinese language settings return"
  );

  await clickByAriaLabel(cdp, "Mise 使用English");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('App language') && Boolean(document.querySelector('[aria-label=\"Back\"]'))",
    "restored English operator chrome"
  );
  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(1200);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('App language') && Boolean(document.querySelector('[aria-label=\"Use English for Mise\"]'))",
    "persisted restored English preference"
  );

  await runAskMiseInteractionQa(cdp);

  await navigateAndMeasure(cdp, "/more/daily-brief", []);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('What matters now') && document.body.innerText.includes('Still unknown')",
    "interpreted phase brief"
  );
  await clickByRoleAndText(cdp, "tab", "Pre-service");
  await waitForBrowserCondition(
    cdp,
    "Array.from(document.querySelectorAll('[role=\"tab\"]')).some((node)=>node.textContent.includes('Pre-service')&&node.getAttribute('aria-selected')==='true')",
    "selected pre-service brief"
  );
  await clickByRoleAndText(cdp, "tab", "Closing");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Finish with evidence') && document.body.innerText.includes('Open full daily report')",
    "interactive closing brief"
  );

  await navigateAndMeasure(cdp, "/inventory", []);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Low stock items') && document.body.innerText.includes('Stock alerts')",
    "Inventory operational groups"
  );
  const inventoryRowLabel = await firstAriaLabelEnding(
    cdp,
    "Record count, receive, waste, or stockout."
  );
  if (!inventoryRowLabel) throw new Error("Inventory did not render an editable stock row.");
  await clickByAriaLabel(cdp, inventoryRowLabel);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Inventory operations')",
    "Inventory ledger operations"
  );
  const countInputLabel = await firstAriaLabel(cdp, "Quantity (");
  if (!countInputLabel) throw new Error("Inventory detail did not expose the canonical count input.");
  const canonicalCount = "453.59237";
  await setInputByAriaLabel(cdp, countInputLabel, canonicalCount);
  await clickByRoleAndText(cdp, "button", "Submit inventory event");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Inventory event accepted into the ledger.')",
    "inventory ledger acceptance"
  );
  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(1200);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('1 lb') && document.body.innerText.includes('Accepted')",
    "persisted canonical inventory projection and accepted queue evidence"
  );

  await navigateAndMeasure(cdp, "/settings/gmail", []);
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Restaurant Gmail')", "Gmail settings");
  await clickByRoleAndText(cdp, "button", "Connect Gmail");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Demo Gmail connected') && document.body.innerText.toLowerCase().includes('local simulation')",
    "connected local Gmail simulation"
  );

  await navigateAndMeasure(cdp, "/orders/00000000-0000-4000-8000-000000000601", []);
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Generated order')", "seeded supplier order detail");
  await clickByRoleAndText(cdp, "button", "Approve & simulate");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Demo send simulated') && document.body.innerText.includes('No email was sent')",
    "simulated send confirmation"
  );

  await navigateAndMeasure(cdp, "/orders", []);
  await waitForBrowserCondition(
    cdp,
    "location.pathname === '/orders' && Boolean(document.querySelector('[aria-label^=\"Review,\"]'))",
    "Orders Drafts lane and review queue prompt"
  );
  await clickByRoleAndText(cdp, "tab", "Review");
  await waitForBrowserCondition(
    cdp,
    "Boolean(document.querySelector('[aria-label^=\"Order quantity for \"]'))",
    "Review lane recommendation queue"
  );

  const firstQuantityLabel = await firstAriaLabel(cdp, "Order quantity for ");
  if (!firstQuantityLabel) throw new Error("No recommendation quantity input was rendered.");
  const firstItem = firstQuantityLabel.replace("Order quantity for ", "");
  await setInputByAriaLabel(cdp, firstQuantityLabel, "0");
  await clickByAriaLabel(cdp, "Approve " + firstItem);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Enter a quantity from 1 to')",
    "positive quantity validation"
  );

  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(1200);
  await waitForBrowserCondition(
    cdp,
    "location.pathname === '/orders' && Boolean(document.querySelector('[aria-label^=\"Drafts,\"]'))",
    "Orders after invalid quantity validation"
  );
  await clickByRoleAndText(cdp, "tab", "Review");
  await waitForBrowserCondition(
    cdp,
    "Boolean(document.querySelector('[aria-label=" +
      JSON.stringify("Approve " + firstItem) +
      "]'))",
    "recommendation review after validation reload"
  );
  await clickByAriaLabel(cdp, "Approve " + firstItem);
  try {
    await waitForBrowserCondition(
      cdp,
      "!document.querySelector('[aria-label=" + JSON.stringify("Approve " + firstItem) + "]')",
      "approved recommendation to leave Review"
    );
  } catch (error) {
    const snapshot = await evaluateValue(
      cdp,
      "(() => ({body:(document.body?.innerText||'').slice(0,1800),quantity:document.querySelector('[aria-label=" +
        JSON.stringify(firstQuantityLabel) +
        "]')?.value ?? null,disabled:Boolean(document.querySelector('[aria-label=" +
        JSON.stringify("Approve " + firstItem) +
        "]')?.disabled)}))()"
    );
    throw new Error(`${error instanceof Error ? error.message : String(error)} ${JSON.stringify(snapshot)}`);
  }

  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(1600);
  await waitForBrowserCondition(
    cdp,
    "location.pathname === '/orders' && Boolean(document.querySelector('[aria-label^=\"Drafts,\"]'))",
    "Orders after reload"
  );
  await clickByRoleAndText(cdp, "tab", "Review");
  const repeatedAfterReload = await evaluateValue(
    cdp,
    "Boolean(document.querySelector('[aria-label=" + JSON.stringify("Approve " + firstItem) + "]'))"
  );
  if (repeatedAfterReload) {
    throw new Error(firstItem + " returned to Review after approval and reload.");
  }

  const secondQuantityLabel = await firstAriaLabel(cdp, "Order quantity for ");
  if (secondQuantityLabel) {
    const secondItem = secondQuantityLabel.replace("Order quantity for ", "");
    await clickByAriaLabel(cdp, "Approve " + secondItem);
    const undoLabel = await firstAriaLabel(cdp, "Undo approved ");
    if (undoLabel) {
      await clickByAriaLabel(cdp, undoLabel);
      await waitForBrowserCondition(
        cdp,
        "Boolean(document.querySelector('[aria-label=" + JSON.stringify("Approve " + secondItem) + "]'))",
        "undone recommendation to return to Review"
      );
      await clickByAriaLabel(cdp, "Approve " + secondItem);
      await waitForBrowserCondition(
        cdp,
        "!document.querySelector('[aria-label=" + JSON.stringify("Approve " + secondItem) + "]')",
        "re-approved recommendation to leave Review"
      );
    }
  }

  await clickByRoleAndText(cdp, "tab", "Drafts");
  const draftTabState = await evaluateValue(
    cdp,
    "(() => Array.from(document.querySelectorAll('[role=\"tab\"]')).map((tab)=>({" +
      "text:(tab.textContent||'').trim(),label:tab.getAttribute('aria-label')," +
      "selected:tab.getAttribute('aria-selected'),checked:tab.getAttribute('aria-checked')" +
      "})))()"
  );
  const selectedDrafts = draftTabState.some(
    (tab) => tab.text.includes("Drafts") && (tab.selected === "true" || tab.checked === "true")
  );
  if (!selectedDrafts) {
    throw new Error(
      "Drafts lane did not expose its selected state: " + JSON.stringify(draftTabState)
    );
  }

  await clickByRoleAndText(cdp, "tab", "Sent");
  const approveInSent = await firstAriaLabel(cdp, "Approve ");
  if (approveInSent) throw new Error("Sent lane rendered a recommendation approval control.");
  const selectedSent = await evaluateValue(
    cdp,
    "(() => Array.from(document.querySelectorAll('[role=\"tab\"]')).some((tab)=>" +
      "(tab.textContent||'').includes('Sent')&&tab.getAttribute('aria-selected')==='true'))()"
  );
  if (!selectedSent) throw new Error("Sent lane did not expose its selected state.");

  if (screenshotPath) {
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false
    });
    await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
    console.log("Saved interaction screenshot to " + screenshotPath);
  }

  await navigateAndMeasure(cdp, "/settings/recipes", []);
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Mapped dishes')", "Recipe baseline list");
  const recipeInputLabel = await firstAriaLabelEnding(cdp, " quantity per sale");
  if (!recipeInputLabel) throw new Error("Recipe baselines did not expose an editable ingredient quantity.");
  const currentRecipeQuantity = Number(await inputValueByAriaLabel(cdp, recipeInputLabel));
  if (!Number.isFinite(currentRecipeQuantity)) throw new Error("Recipe baseline quantity was not numeric.");
  const nextRecipeQuantity = String(Math.round((currentRecipeQuantity + 0.01) * 10000) / 10000);
  await setInputByAriaLabel(cdp, recipeInputLabel, nextRecipeQuantity);
  await clickByRoleAndText(cdp, "button", "Save");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Recipe baseline saved')",
    "recipe baseline confirmation"
  );
  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(1200);
  await waitForBrowserCondition(
    cdp,
    "document.querySelector('[aria-label=" + JSON.stringify(recipeInputLabel) + "]')?.value === " + JSON.stringify(nextRecipeQuantity),
    "persisted recipe baseline"
  );

  await navigateAndMeasure(cdp, "/insights", []);
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Manager brief')", "Insights manager brief");
  await clickByAriaLabel(cdp, "Refresh insights");
  await waitForBrowserCondition(
    cdp,
    "Boolean(document.querySelector('[aria-label=\"Refresh insights\"]')) && !document.body.innerText.includes('Insights could not refresh')",
    "completed insight refresh"
  );
  await clickByRoleAndText(cdp, "tab", "Urgent insights");
  await waitForBrowserCondition(
    cdp,
    "document.querySelector('[aria-label=\"Urgent insights\"]')?.getAttribute('aria-selected') === 'true'",
    "selected urgent insight filter"
  );

  await navigateAndMeasure(cdp, "/settings/pos", []);
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Available providers')", "POS provider list");
  await clickByRoleAndText(cdp, "button", "Square");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Square demo data loaded.') && document.body.innerText.includes('Square is connected')",
    "Square demo POS connection"
  );

  await navigateAndMeasure(cdp, "/settings", []);
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Restore demo data')", "demo reset control");
  await clickByRoleAndText(cdp, "button", "Restore demo data");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Demo data restored.')",
    "demo reset confirmation"
  );
  await navigateAndMeasure(cdp, "/home", []);
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Sales today')",
    "restored Home command board"
  );

  await navigateAndMeasure(cdp, "/settings", []);
  await clickByRoleAndText(cdp, "button", "Sign out");
  await waitForBrowserCondition(
    cdp,
    "location.pathname === '/login' && document.body.innerText.includes('Demo data is ready to test')",
    "signed-out login"
  );
  await clickByRoleAndText(cdp, "button", "Customize setup first");
  await waitForBrowserCondition(
    cdp,
    "location.pathname === '/setup' && document.body.innerText.includes('Set up demo data')",
    "guided demo setup"
  );
  await setInputByAriaLabel(cdp, "Restaurant name", "");
  await clickByRoleAndText(cdp, "button", "Continue");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Add the restaurant name and service style to continue.')",
    "setup profile validation"
  );
  await setInputByAriaLabel(cdp, "Restaurant name", "QA Sample Restaurant");
  await clickByRoleAndText(cdp, "button", "Continue");
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Inventory baseline')", "setup inventory step");
  await clickByRoleAndText(cdp, "button", "Continue");
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Recipes')", "setup recipes step");
  await clickByRoleAndText(cdp, "button", "Continue");
  await waitForBrowserCondition(cdp, "document.body.innerText.includes('Ordering rhythm')", "setup ordering step");
  await clickByRoleAndText(cdp, "button", "Start Local Demo");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Learning setup complete')",
    "completed guided setup"
  );
  await clickByRoleAndText(cdp, "button", "Open Today");
  await waitForBrowserCondition(
    cdp,
    "location.pathname === '/today' && Boolean(document.querySelector('[aria-label=\"Today\"]'))",
    "Today after guided setup"
  );

  console.log("Mise core interaction QA passed.");
}

const testflightForbiddenText = [
  "Demo data is ready to test",
  "Open demo data",
  "Customize setup first",
  "Open demo kitchen",
  "Restore demo data",
  "Simulate send",
  "Approve & simulate",
  "Start Local Demo"
];

async function assertTestFlightRoute(cdp, route, expectedText) {
  await navigateAndMeasure(cdp, route, []);
  await waitForBrowserCondition(
    cdp,
    `document.body.innerText.includes(${JSON.stringify(expectedText)})`,
    `${route} non-demo content`
  );
  const state = await evaluateValue(cdp, `(() => {
    const text = document.body.innerText || "";
    return {
      forbidden: ${JSON.stringify(testflightForbiddenText)}.filter((label) => text.includes(label)),
      loading: text.includes("Loading the restaurant workspace.")
    };
  })()`);
  if (state.forbidden.length > 0) {
    throw new Error(`${route} exposed demo-only UI: ${state.forbidden.join(", ")}`);
  }
  if (state.loading) throw new Error(`${route} remained on the workspace loading state.`);
}

async function runTestFlightInteractionQa(cdp) {
  console.log("Mise TestFlight interaction QA: hosted staging shell with demo affordances disabled");
  await evaluateValue(cdp, "localStorage.clear(); true");

  await assertTestFlightRoute(cdp, "/login", "Supabase is configured");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Log in') && Boolean(document.querySelector('[aria-label=\"Email\"]'))",
    "hosted login controls"
  );

  await assertTestFlightRoute(cdp, "/accept-invite", "Invitation link unavailable");
  await clickByAriaLabel(cdp, "Back to sign in");
  await waitForBrowserCondition(cdp, "location.pathname === '/login'", "invite back navigation");

  await assertTestFlightRoute(cdp, "/setup", "Sign in required");
  for (const [route, expectedText] of [
    ["/today", "Today"],
    ["/inventory", "Inventory"],
    ["/orders", "Orders"],
    ["/settings", "Profile"],
    ["/settings/gmail", "Gmail connection"],
    ["/settings/pos", "POS Connection"]
  ]) {
    await assertTestFlightRoute(cdp, route, expectedText);
  }

  console.log("Mise TestFlight interaction QA passed.");
}

async function main() {
  if (!chromePath || !existsSync(chromePath)) {
    throw new Error("Set CHROME_PATH to an installed browser or install Chrome/Chromium before running mobile QA.");
  }
  await startExpoServer();
  await waitForExpo();
  await startChrome();
  await waitForChrome();

  const webSocketUrl = await createTarget();
  const cdp = await connectCdp(webSocketUrl);
  const runtimeErrors = [];
  cdp.on("Runtime.exceptionThrown", (params) => {
    runtimeErrors.push(params.exceptionDetails?.text ?? "Runtime exception");
  });
  cdp.on("Log.entryAdded", (params) => {
    if (params.entry?.level === "error") {
      runtimeErrors.push(params.entry.text ?? "Console error");
    }
  });

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    const detailRoutes = await discoverDetailRoutes(cdp);
    const routes = [...baseRoutes, ...detailRoutes];
    console.log(`Mise mobile layout smoke routes: ${routes.join(", ")}`);

    const results = [];
    const failures = [];
    for (const route of routes) {
      runtimeErrors.length = 0;
      const result = await navigateAndMeasure(cdp, route, runtimeErrors);
      results.push(result);
      if (result.overflowX > 2) failures.push(`${route}: horizontal overflow ${result.overflowX}px`);
      if (result.wideElements.length > 0) {
        failures.push(`${route}: ${result.wideElements.length} wide element(s) detected`);
      }
      if (result.runtimeErrors.length > 0) {
        failures.push(`${route}: runtime error(s): ${result.runtimeErrors.join("; ")}`);
      }
      if (result.visibleTextLength < 20) failures.push(`${route}: rendered text is unexpectedly sparse`);
      if (shouldEmulateReducedMotion && !result.prefersReducedMotion) {
        failures.push(`${route}: reduced-motion preference was not applied`);
      }
    }

    results.forEach((result) => {
      console.log(
        `${result.route} ${result.width}x${result.height} duration=${result.durationMs}ms scrollWidth=${result.scrollWidth} overflowX=${result.overflowX} text=${result.visibleTextLength} motion=${result.prefersReducedMotion ? "reduce" : "default"}`
      );
      result.wideElements.forEach((element) => {
        console.log(
          `  wide ${element.tag} left=${element.left} right=${element.right} width=${element.width} text="${element.text}"`
        );
      });
    });

    if (failures.length > 0) {
      console.error("Mise mobile layout smoke failed:");
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exitCode = 1;
    } else {
      console.log("Mise mobile layout smoke passed.");
    }

    if (failures.length === 0 && shouldRunInteractionQa) {
      if (interactionMode === "demo") await runDemoInteractionQa(cdp);
      else await runTestFlightInteractionQa(cdp);
    }
  } finally {
    cdp.close();
    await stopChild(chromeProcess);
    await stopChild(expoProcess);
    if (chromeProfileDir) await rm(chromeProfileDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await stopChild(chromeProcess);
  await stopChild(expoProcess);
  if (chromeProfileDir) await rm(chromeProfileDir, { recursive: true, force: true });
  process.exit(1);
});

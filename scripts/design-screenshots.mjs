// Reference-convergence screenshot harness.
//
// Boots Expo web, initializes local demo data, and captures each reference
// screen at an iPhone-class viewport so the rendered app can be compared
// side by side with docs/design/references/*.png.
//
// Usage:
//   node scripts/design-screenshots.mjs [--out docs/design/screenshots/after]
//
// This is a design tool, not a gate. It never asserts; it only captures.

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { publicQaEnv } from "./safe-env.mjs";

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const index = args.indexOf(flag);
  return index === -1 || index === args.length - 1 ? fallback : args[index + 1];
}

const outputDir = argValue("--out", "docs/design/screenshots/current");
const expoPort = Number(process.env.MISE_DESIGN_SHOT_PORT ?? 8087);
const debugPort = Number(process.env.MISE_DESIGN_SHOT_DEBUG_PORT ?? 9336);
const existingBaseUrl = process.env.MISE_DESIGN_SHOT_URL;
const baseUrl = existingBaseUrl ?? `http://localhost:${expoPort}`;
const timeoutMs = Number(process.env.MISE_DESIGN_SHOT_TIMEOUT_MS ?? 180000);
const viewport = {
  width: Number(process.env.MISE_DESIGN_SHOT_WIDTH ?? 390),
  height: Number(process.env.MISE_DESIGN_SHOT_HEIGHT ?? 844),
  deviceScaleFactor: Number(process.env.MISE_DESIGN_SHOT_SCALE ?? 2)
};

// The reference board is eight screens plus the setup flow from reference 2.
// `discover` routes resolve a real entity id at runtime instead of hardcoding one.
const shots = [
  { name: "01-home", route: "/home", settle: "Good morning|Good afternoon|Good evening" },
  { name: "02-today", route: "/today" },
  { name: "03-inventory", route: "/inventory" },
  { name: "04-orders", route: "/orders" },
  { name: "05-task-detail", discover: "task" },
  { name: "06-ask-mise", route: "/ask-mise" },
  { name: "07-more", route: "/more" },
  { name: "08-settings", route: "/settings" },
  { name: "09-setup", route: "/setup" }
];

const chromeCandidates = process.platform === "darwin"
  ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
const chromePath = process.env.CHROME_PATH ?? chromeCandidates.find(existsSync);

let expoProcess = null;
let chromeProcess = null;
let expoOutput = "";
let chromeProfileDir = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function spawnLogged(command, commandArgs, outputSink) {
  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: publicQaEnv({ CI: "1", EXPO_NO_TELEMETRY: "1" }),
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => outputSink(chunk.toString()));
  child.stderr.on("data", (chunk) => outputSink(chunk.toString()));
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

async function waitForChrome() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still coming up.
    }
    await sleep(500);
  }
  throw new Error("Chrome debugging endpoint did not start.");
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

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
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

async function evaluateValue(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text}`);
  }
  return result.result?.value;
}

async function waitForBrowserCondition(cdp, expression, label, waitMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < waitMs) {
    if (await evaluateValue(cdp, `Boolean(${expression})`)) return true;
    await sleep(250);
  }
  console.warn(`  ! timed out waiting for ${label}`);
  return false;
}

async function clickByRoleAndText(cdp, role, label) {
  const clicked = await evaluateValue(
    cdp,
    `(() => {
      const nodes = Array.from(document.querySelectorAll('[role="${role}"], button'));
      const match = nodes.find((node) => (node.innerText || '').trim().includes(${JSON.stringify(label)}));
      if (!match) return false;
      match.click();
      return true;
    })()`
  );
  if (!clicked) throw new Error(`Could not find ${role} labelled "${label}".`);
  await sleep(900);
}

async function navigate(cdp, route) {
  await cdp.send("Page.navigate", { url: `${baseUrl}${route}` });
  await sleep(1800);
  await waitForBrowserCondition(cdp, "document.body && document.body.innerText.length > 40", `content on ${route}`);
}

async function applyViewport(cdp) {
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
  // Freeze entrance animations so captures are deterministic.
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }]
  });
}

async function capture(cdp, name) {
  const viewportShot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(outputDir, `${name}.png`), Buffer.from(viewportShot.data, "base64"));

  const fullHeight = await evaluateValue(
    cdp,
    "Math.min(4000, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))"
  );
  if (fullHeight > viewport.height + 24) {
    const fullShot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: viewport.width, height: fullHeight, scale: 1 }
    });
    await writeFile(join(outputDir, `${name}-full.png`), Buffer.from(fullShot.data, "base64"));
  }
  console.log(`  captured ${name} (viewport ${viewport.width}x${viewport.height}, page height ${fullHeight})`);
}

async function discoverTaskRoute(cdp) {
  // React Native Web renders rows as pressable divs, not anchors, so the only
  // reliable way to reach a real task id is to open one the way an operator does.
  await navigate(cdp, "/today");
  const href = await evaluateValue(
    cdp,
    `(() => {
      const link = Array.from(document.querySelectorAll('a[href*="/tasks/"]'))[0];
      return link ? new URL(link.href, location.origin).pathname : null;
    })()`
  );
  if (href) return href;

  const opened = await evaluateValue(
    cdp,
    `(() => {
      const rows = Array.from(document.querySelectorAll('[role="button"], [tabindex]'));
      const row = rows.find((node) => {
        const label = (node.getAttribute('aria-label') || node.innerText || '').trim();
        return label.length > 8 && /task|delivery|temperature|count|review|order|prep|checklist/i.test(label);
      });
      if (!row) return false;
      row.click();
      return true;
    })()`
  );
  if (opened) {
    await sleep(1600);
    const path = await evaluateValue(cdp, "location.pathname");
    if (typeof path === "string" && path.startsWith("/tasks/")) return path;
  }
  console.warn("  ! could not open a real task; falling back to the smoke id");
  return "/tasks/layout-smoke-task";
}

async function main() {
  if (!chromePath) {
    throw new Error("Could not find Chrome. Set CHROME_PATH to a Chrome or Chromium binary.");
  }
  await mkdir(outputDir, { recursive: true });

  if (!existingBaseUrl) {
    expoProcess = spawnLogged("npx", ["expo", "start", "--web", "--port", String(expoPort), "--host", "localhost"], (chunk) => {
      expoOutput += chunk;
    });
  }
  await waitForExpo();

  chromeProfileDir = await mkdtemp(join(tmpdir(), "mise-design-shot-"));
  chromeProcess = spawnLogged(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${chromeProfileDir}`,
      "about:blank"
    ],
    () => {}
  );
  await waitForChrome();

  const cdp = await connectCdp(await createTarget());
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await applyViewport(cdp);

  // Bring up local demo data so every screen renders real operational state.
  await navigate(cdp, "/login");
  await evaluateValue(cdp, "localStorage.clear(); true");
  await navigate(cdp, "/login");
  await waitForBrowserCondition(
    cdp,
    "document.body.innerText.includes('Demo data is ready to test')",
    "demo data launcher"
  );
  await clickByRoleAndText(cdp, "button", "Open demo data");
  await waitForBrowserCondition(cdp, "location.pathname === '/home'", "initialized demo data");
  await sleep(1500);

  for (const shot of shots) {
    const route = shot.discover === "task" ? await discoverTaskRoute(cdp) : shot.route;
    console.log(`- ${shot.name} -> ${route}`);
    await navigate(cdp, route);
    if (shot.settle) {
      await waitForBrowserCondition(
        cdp,
        `/${shot.settle}/.test(document.body.innerText)`,
        `settled content on ${route}`
      );
    }
    if (shot.name === "09-setup") {
      await clickByRoleAndText(cdp, "button", "Continue");
      await waitForBrowserCondition(
        cdp,
        "document.body.innerText.includes('Inventory baseline')",
        "inventory setup step"
      );
    }
    await sleep(700);
    await capture(cdp, shot.name);
  }

  cdp.close();
  console.log(`\nScreenshots written to ${outputDir}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopChild(chromeProcess);
    await stopChild(expoProcess);
    if (chromeProfileDir) await rm(chromeProfileDir, { recursive: true, force: true });
  });

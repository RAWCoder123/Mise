import { spawn } from "node:child_process";
import { publicQaEnv } from "./safe-env.mjs";

const routes = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/setup",
  "/today",
  "/inventory",
  "/inventory/count",
  "/inventory/new",
  "/orders",
  "/insights",
  "/settings",
  "/settings/language",
  "/settings/gmail",
  "/settings/suppliers",
  "/settings/team",
  "/invite/0000000000000000000000000000000000000000000000000000000000000000"
];
const port = Number(process.env.MISE_ROUTE_SMOKE_PORT ?? 8083);
const existingBaseUrl = process.env.MISE_ROUTE_SMOKE_URL;
const baseUrl = existingBaseUrl ?? `http://localhost:${port}`;
const timeoutMs = Number(process.env.MISE_ROUTE_SMOKE_TIMEOUT_MS ?? 120000);
const minShellBytes = 900;

let serverProcess = null;
let output = "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startExpoServer() {
  serverProcess = spawn(
    "npx",
    ["expo", "start", "--web", "--port", String(port), "--host", "localhost"],
    {
      cwd: process.cwd(),
      env: publicQaEnv({
        CI: "1",
        EXPO_NO_TELEMETRY: "1"
      }),
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  serverProcess.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
}

async function stopExpoServer() {
  if (!serverProcess || serverProcess.killed) return;

  if (process.platform !== "win32") {
    try {
      process.kill(-serverProcess.pid, "SIGTERM");
    } catch {
      serverProcess.kill("SIGTERM");
    }
  } else {
    serverProcess.kill("SIGTERM");
  }

  const exited = await Promise.race([
    new Promise((resolve) => serverProcess.once("exit", () => resolve(true))),
    sleep(2500).then(() => false)
  ]);

  if (!exited && !serverProcess.killed) {
    if (process.platform !== "win32") {
      try {
        process.kill(-serverProcess.pid, "SIGKILL");
      } catch {
        serverProcess.kill("SIGKILL");
      }
    } else {
      serverProcess.kill("SIGKILL");
    }
  }
}

async function fetchRoute(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  return {
    path,
    status: response.status,
    bytes: Buffer.byteLength(body),
    body
  };
}

function assertHealthyShell(result) {
  const failures = [];
  if (result.status !== 200) failures.push(`HTTP ${result.status}`);
  if (result.bytes < minShellBytes) failures.push(`small shell (${result.bytes} bytes)`);
  if (/expo-error-overlay|webpack-dev-server-client-overlay|React Refresh runtime error/i.test(result.body)) {
    failures.push("framework error overlay marker");
  }
  if (!/id=["']root["']|expo-router|__expo/i.test(result.body)) {
    failures.push("missing Expo app shell marker");
  }
  return failures;
}

async function waitForServer() {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await fetchRoute("/");
      if (result.status === 200 && result.bytes >= minShellBytes) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }

  const tail = output.split(/\r?\n/).slice(-30).join("\n");
  throw new Error(
    `Expo web server did not become ready within ${timeoutMs}ms.` +
      (lastError ? ` Last error: ${lastError.message}` : "") +
      (tail ? `\nServer output tail:\n${tail}` : "")
  );
}

async function main() {
  if (!existingBaseUrl) startExpoServer();

  try {
    await waitForServer();
    const results = [];
    const failures = [];

    for (const route of routes) {
      const result = await fetchRoute(route);
      results.push(result);
      const routeFailures = assertHealthyShell(result);
      if (routeFailures.length > 0) {
        failures.push(`${route}: ${routeFailures.join(", ")}`);
      }
    }

    results.forEach((result) => {
      console.log(`${result.path} ${result.status} ${result.bytes} bytes`);
    });

    if (failures.length > 0) {
      console.error("Mise route smoke failed:");
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exitCode = 1;
    } else {
      console.log("Mise route smoke passed.");
    }
  } finally {
    if (!existingBaseUrl) await stopExpoServer();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (!existingBaseUrl) await stopExpoServer();
  process.exit(1);
});

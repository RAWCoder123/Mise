import { spawn } from "node:child_process";
import { testflightPublicQaEnv } from "./safe-env.mjs";

const child = spawn(
  "npx",
  ["expo", "export", "--platform", "web", "--output-dir", "/private/tmp/mise-testflight-web-export"],
  {
    cwd: process.cwd(),
    env: testflightPublicQaEnv(),
    stdio: "inherit"
  }
);

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`TestFlight web export terminated by ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

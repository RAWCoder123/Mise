import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../.easignore", import.meta.url), "utf8");
const lines = source
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

const requiredPatterns = [
  "node_modules/",
  ".env",
  ".env.*",
  ".mise-staging.env",
  ".cursor/",
  "site/",
  "docs/",
  "scripts/",
  "supabase/",
  "tests/",
  ".git/"
];

const missing = requiredPatterns.filter((pattern) => !lines.includes(pattern));
if (missing.length > 0) {
  throw new Error(`EAS archive exclusions are missing: ${missing.join(", ")}`);
}

const forbiddenNegations = lines.filter(
  (line) =>
    line.startsWith("!") &&
    requiredPatterns.some((pattern) => line.slice(1) === pattern)
);
if (forbiddenNegations.length > 0) {
  throw new Error(
    `EAS archive exclusions cannot be re-included: ${forbiddenNegations.join(", ")}`
  );
}

console.log(
  "Mise EAS archive policy passed: credentials, local agent state, tests, operations, Supabase, and the independent site are excluded."
);

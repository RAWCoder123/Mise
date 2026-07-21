import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const scanRoots = ["app", "components", "constants", "contexts", "services", "utils", "types", "supabase/seed", "supabase/migrations"];

const allowedHardcodedColorFiles = new Set([
  "constants/theme.ts",
  "components/ui/BrandLockup.tsx",
  "components/ui/MiseIllustrations.tsx"
]);

const deprecatedPalette = [
  "#2F6B3B",
  "#1F4F2C",
  "#C7E1CC",
  "#E5F1E7",
  "#34A853",
  "#FBBC05",
  "#EBCF8D",
  "#FFF3D7",
  "#C98518",
  "#7A4D10"
];

const deprecatedColorAliases =
  /\bcolors\.(basil|basilDark|basilSoft|mint|mintDark|mintSoft|saffron|saffronDark|saffronSoft|berry|berryDark|berrySoft)\b/;

const requiredThemeTokens = [
  ['background', '#FFFFFF'],
  ['surface', '#FFFFFF'],
  ['text', '#171715'],
  ['muted', '#6A6965'],
  ['border', '#E7E7E3'],
  ['accent', '#F5222D'],
  ['accentDark', '#E51620'],
  ['accentSoft', '#FDEBEC'],
  ['success', '#357B45'],
  ['successSoft', '#EAF4EC'],
  ['caution', '#9A6700'],
  ['cautionSoft', '#FFF4D6'],
  ['warning', '#B35600'],
  ['danger', '#D91019']
];

function listFiles(path) {
  const absolute = join(root, path);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return [];
  }

  if (stats.isFile()) return [path];
  return readdirSync(absolute).flatMap((entry) => {
    const next = join(path, entry);
    if (next.includes("node_modules") || next.includes(".expo")) return [];
    const nextStats = statSync(join(root, next));
    return nextStats.isDirectory() ? listFiles(next) : [next];
  });
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const failures = [];
const files = scanRoots
  .flatMap(listFiles)
  .filter((path) => /\.(ts|tsx|js|sql)$/.test(path))
  .filter((path) => !path.includes(".test."));

for (const file of files) {
  const contents = read(file);
  const allowedHardcodedColors = allowedHardcodedColorFiles.has(file);

  if (!allowedHardcodedColors) {
    deprecatedPalette.forEach((color) => {
      if (contents.toLowerCase().includes(color.toLowerCase())) {
        failures.push(`${file}: deprecated non-Mise palette color ${color}`);
      }
    });
  }

  if (file !== "constants/theme.ts" && deprecatedColorAliases.test(contents)) {
    failures.push(`${file}: use red/neutral theme tokens instead of deprecated green/amber/berry aliases`);
  }

  if (file.startsWith("components/ui/") && /fontWeight:\s*["'](?:800|900)["']/.test(contents)) {
    failures.push(`${file}: use bundled Inter 400-700 faces instead of 800/900 defaults`);
  }
}

const theme = read("constants/theme.ts");
requiredThemeTokens.forEach(([token, value]) => {
  const tokenPattern = new RegExp(`\\b${token}:\\s*["']${value.replace("#", "#")}["']`, "i");
  if (!tokenPattern.test(theme)) failures.push(`constants/theme.ts: ${token} must use approved value ${value}`);
});

const semanticInventoryPalette = [
  ["Good", "colors.success"],
  ["Watch", "colors.caution"],
  ["Low", "colors.warning"],
  ["Critical", "colors.danger"]
];
semanticInventoryPalette.forEach(([status, token]) => {
  if (!theme.includes(`${status}: ${token}`)) {
    failures.push(`constants/theme.ts: inventory ${status} must map to ${token}`);
  }
});

for (const file of ["components/ui/InventoryHealth.tsx", "app/(tabs)/inventory.tsx", "app/(tabs)/today.tsx"]) {
  if (!read(file).includes("inventoryStatusColors")) {
    failures.push(`${file}: use the authoritative inventory status palette`);
  }
}

const inventoryScreen = read("app/(tabs)/inventory.tsx");
for (const filterTone of ['"At risk", label: t("inventory.filter.atRisk"), tone: "warning"', '"Watch", label: t("inventory.filter.watch"), tone: "caution"', '"Good", label: t("inventory.filter.good"), tone: "success"']) {
  if (!inventoryScreen.includes(filterTone)) failures.push("app/(tabs)/inventory.tsx: inventory filters must retain semantic status tones");
}

const insightsScreen = read("app/(tabs)/insights.tsx");
if (!insightsScreen.includes("backgroundColor: colors.panelStrong") || !insightsScreen.includes("backgroundColor: colors.accent")) {
  failures.push("app/(tabs)/insights.tsx: historical chart marks must stay neutral with a brand-colored latest value");
}

for (const fontFace of ["Fraunces_600SemiBold", "Inter_400Regular", "Inter_500Medium", "Inter_600SemiBold", "Inter_700Bold"]) {
  if (!theme.includes(fontFace) || !read("app/_layout.tsx").includes(fontFace)) {
    failures.push(`typography: bundle and register ${fontFace}`);
  }
}

const rootLayout = read("app/_layout.tsx");
if (!rootLayout.includes("*:focus-visible") || !rootLayout.includes("outline: 3px solid")) {
  failures.push("app/_layout.tsx: keep a visible global keyboard focus treatment");
}

const screen = read("components/ui/Screen.tsx");
if (!/appBar:\s*\{[\s\S]*?height:\s*56,/.test(screen)) {
  failures.push("components/ui/Screen.tsx: app bar must remain 56px");
}

const tabs = read("app/(tabs)/_layout.tsx");
if (!/tabBar:\s*\{[\s\S]*?height:\s*62,/.test(tabs)) {
  failures.push("app/(tabs)/_layout.tsx: bottom navigation must remain 62px plus safe area");
}

if (failures.length > 0) {
  console.error("Mise static design checks failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mise static design checks passed.");

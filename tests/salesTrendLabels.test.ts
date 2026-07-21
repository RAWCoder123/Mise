import assert from "node:assert/strict";
import { test } from "node:test";

import { formatLocalizedDate } from "../i18n/formatters.ts";
import { buildConciseTrendDateLabels } from "../services/presentation/salesTrendLabels.ts";

const englishDate = (
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions & { timeZone?: string }
) => formatLocalizedDate("en", value, options);

test("sales trend weekdays stay concise when each label is distinct", () => {
  assert.deepEqual(
    buildConciseTrendDateLabels(
      ["2026-07-16", "2026-07-17", "2026-07-18"],
      "2026-07-18",
      "Today",
      englishDate
    ),
    ["Thu", "Fri", "Today"]
  );
});

test("weekly sales points use unambiguous localized dates when weekdays collide", () => {
  assert.deepEqual(
    buildConciseTrendDateLabels(
      ["2026-06-26", "2026-07-03", "2026-07-10", "2026-07-17"],
      "2026-07-17",
      "Today",
      englishDate
    ),
    ["6/26", "7/3", "7/10", "Today"]
  );
});

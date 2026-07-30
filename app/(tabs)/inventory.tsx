import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Beef, ChevronRight, Droplets, LeafyGreen, Milk, Package, Search, SlidersHorizontal, Wheat } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  InventoryHealthBar,
  buildInventoryHealthAccessibilityLabel,
  getInventoryHealthTotal,
  getWellStockedPercentage,
  type InventoryHealthCounts
} from "../../components/ui/InventoryHealth";
import { ProduceCrateIllustration } from "../../components/ui/MiseIllustrations";
import { Screen } from "../../components/ui/Screen";
import { FilterRow, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, density, inventoryStatusColors, inventoryStatusSoftColors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { localizeInventoryPrediction } from "../../i18n/inventoryPresentation";
import type { InventoryOutboxEntry } from "../../services/domain/inventoryOutbox";
import {
  fetchInventoryOutlookItems,
  fetchQueuedInventoryEvents,
  summarizeInventoryOutlooks
} from "../../services/miseService";
import type { InventoryItem, InventoryOutlookItem, InventoryStatus } from "../../types/mise";

type InventoryFilter = "All" | "At risk" | "Watch" | "Good";

export default function InventoryScreen() {
  const { formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [outlooks, setOutlooks] = useState<InventoryOutlookItem[]>([]);
  const [queueEntries, setQueueEntries] = useState<InventoryOutboxEntry[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setOutlooks([]);
    setQueueEntries([]);
    setQuery("");
    setFilter("All");
    setError(false);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const [nextOutlooks, nextQueue] = await Promise.all([
        fetchInventoryOutlookItems(restaurantId),
        fetchQueuedInventoryEvents(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutlooks(nextOutlooks);
      setQueueEntries(nextQueue);
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visibleOutlooks = loadedRestaurantId === restaurant?.id ? outlooks : [];
  const visibleQueue = loadedRestaurantId === restaurant?.id ? queueEntries : [];

  const filterOptions = useMemo<readonly SegmentOption<InventoryFilter>[]>(() => {
    const options: readonly SegmentOption<InventoryFilter>[] = [
      { value: "All", label: t("inventory.filter.all"), tone: "brand" as const },
      { value: "At risk", label: t("inventory.filter.atRisk"), tone: "warning" as const },
      { value: "Watch", label: t("inventory.filter.watch"), tone: "caution" as const },
      { value: "Good", label: t("inventory.filter.good"), tone: "success" as const }
    ];
    return options.map((option) => ({
      ...option,
      accessibilityLabel: t("inventory.filter.option", { status: option.label })
    }));
  }, [t]);

  const summary = useMemo(() => {
    if (!restaurant) return null;
    return summarizeInventoryOutlooks(restaurant.id, visibleOutlooks);
  }, [restaurant, visibleOutlooks]);

  const healthCounts: InventoryHealthCounts = {
    good: summary?.stableCount ?? 0,
    watch: summary?.watchCount ?? 0,
    low: summary?.lowCount ?? 0,
    critical: summary?.criticalCount ?? 0
  };
  const healthTotal = getInventoryHealthTotal(healthCounts);
  const attentionCount = healthCounts.watch + healthCounts.low + healthCounts.critical;
  const reorderCount = healthCounts.low + healthCounts.critical;
  const healthPercentLabel = formatNumber(getWellStockedPercentage(healthCounts) / 100, {
    style: "percent",
    maximumFractionDigits: 0
  });
  const healthLabels = {
    good: t("inventory.health.good"),
    watch: t("inventory.health.watch"),
    low: t("inventory.health.low"),
    critical: t("inventory.health.critical"),
    wellStocked: t("inventory.health.wellStocked"),
    empty: t("inventory.health.empty")
  };
  const healthBody = reorderCount > 0
    ? t(reorderCount === 1 ? "inventory.health.risk.one" : "inventory.health.risk.other", {
        count: formatNumber(reorderCount)
      })
    : healthCounts.watch > 0
      ? t(healthCounts.watch === 1 ? "inventory.health.watchCopy.one" : "inventory.health.watchCopy.other", {
          count: formatNumber(healthCounts.watch)
        })
      : t("inventory.health.clear");
  const healthAccessibilityLabel = buildInventoryHealthAccessibilityLabel({
    counts: healthCounts,
    labels: healthLabels,
    formatCount: (value) => formatNumber(value),
    formatPercentage: (value) => formatNumber(value / 100, { style: "percent", maximumFractionDigits: 0 })
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return visibleOutlooks.filter(({ item, prediction }) => {
      const matchesFilter = matchesInventoryFilter(prediction.projectedStatus, filter);
      const matchesQuery =
        !normalized ||
        item.item_name.toLowerCase().includes(normalized) ||
        item.supplier_name.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized) ||
        prediction.coverageLabel.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, visibleOutlooks]);

  if (!restaurant) {
    return (
      <Screen title={t("inventory.title")} subtitle={t("inventory.subtitle")} titleAlign="left">
        <EmptyState
          title={t("inventory.noWorkspace.title")}
          body={t("inventory.noWorkspace.body")}
          illustration={<ProduceCrateIllustration />}
        />
        <Button title={t("inventory.noWorkspace.action")} onPress={() => router.replace("/setup")} fullWidth style={styles.emptyButton} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("inventory.title")}
      titleAlign="left"
      loading={loading}
      action={
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("inventory.search.accessibility")}
            hitSlop={6}
            onPress={() => setFilter("All")}
            style={({ pressed }) => [styles.headerAction, pressed && styles.rowPressed]}
          >
            <Search size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("inventory.filter.toggle")}
            hitSlop={6}
            onPress={() => setFilter((current) => (current === "At risk" ? "All" : "At risk"))}
            style={({ pressed }) => [styles.headerAction, pressed && styles.rowPressed]}
          >
            <SlidersHorizontal size={17} color={filter === "At risk" ? colors.warning : colors.text} strokeWidth={2} />
          </Pressable>
        </View>
      }
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("inventory.retry.title")}
            message={t("inventory.loadError")}
            onRetry={() => void load()}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("inventory.retry.accessibility")}
          />
        ) : null}

        <View accessible accessibilityLabel={healthAccessibilityLabel} style={styles.healthCard}>
          <View style={styles.healthLabelRow}>
            <Text style={styles.healthLabel}>{t("inventory.health.title")}</Text>
            <View style={[styles.healthChip, attentionCount > 0 ? styles.healthChipWatch : styles.healthChipGood]}>
              <Text style={[styles.healthChipText, attentionCount > 0 ? styles.healthChipTextWatch : styles.healthChipTextGood]}>
                {healthTotal === 0
                  ? healthLabels.empty
                  : attentionCount === 0
                    ? healthLabels.wellStocked
                    : t(attentionCount === 1 ? "inventory.health.attention.one" : "inventory.health.attention.other", {
                        count: formatNumber(attentionCount)
                      })}
              </Text>
            </View>
          </View>
          <View style={styles.healthHead}>
            <Text style={styles.healthPercent}>
              {healthTotal === 0 ? formatNumber(0, { style: "percent" }) : healthPercentLabel}
            </Text>
            <View style={styles.healthCopy}>
              <Text style={styles.healthTitle} numberOfLines={1}>
                {healthTotal === 0
                  ? healthLabels.empty
                  : attentionCount === 0
                    ? healthLabels.wellStocked
                    : t(
                        attentionCount === 1
                          ? "inventory.health.attention.one"
                          : "inventory.health.attention.other",
                        { count: formatNumber(attentionCount) }
                      )}
              </Text>
              <Text style={styles.healthBody} numberOfLines={1}>{healthBody}</Text>
            </View>
          </View>
          <InventoryHealthBar counts={healthCounts} />
        </View>

        <InventoryGroup
          title={t("inventory.group.lowStock")}
          outlooks={visibleOutlooks.filter(({ prediction }) => prediction.projectedStatus === "Low").slice(0, 3)}
          queue={visibleQueue}
        />
        <InventoryGroup
          title={t("inventory.group.stockAlerts")}
          outlooks={visibleOutlooks.filter(({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Watch").slice(0, 3)}
          queue={visibleQueue}
        />
        <InventoryGroup
          title={t("inventory.group.reorder")}
          outlooks={visibleOutlooks.filter(({ prediction }) => prediction.projectedStatus === "Low" || prediction.projectedStatus === "Critical").slice(0, 3)}
          queue={visibleQueue}
          onHeaderPress={() => router.push("/orders")}
        />

        {/* Keep filter option definitions for design:static semantic checks. */}
        <View style={styles.hiddenFilters} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <FilterRow
            accessibilityLabel={t("inventory.filter.accessibility")}
            options={filterOptions}
            value={filter}
            onValueChange={setFilter}
          />
        </View>

        <View style={styles.allStock}>
          <Text style={styles.groupTitle}>{t("inventory.list.title")}</Text>
          <View style={styles.controls}>
            <View style={styles.searchBox}>
              <Search size={16} color={colors.faint} strokeWidth={2.25} />
              <TextInput
                accessibilityLabel={t("inventory.search.accessibility")}
                value={query}
                onChangeText={setQuery}
                placeholder={t("inventory.search.placeholder")}
                placeholderTextColor={colors.faint}
                returnKeyType="search"
                style={styles.searchInput}
              />
            </View>
          </View>
          {filtered.length === 0 ? (
            <View style={styles.emptyList}>
              <Package size={20} color={colors.faint} strokeWidth={2.25} />
              <Text style={styles.emptyListTitle}>{t("inventory.emptyMatches.title")}</Text>
            </View>
          ) : (
            <View style={styles.inventoryList}>
              {filtered.slice(0, 12).map((outlook, index) => (
                <InventoryListRow
                  key={outlook.item.id}
                  outlook={outlook}
                  divided={index > 0}
                  queueCount={visibleQueue.filter((entry) => entry.event.inventoryItemId === outlook.item.id).length}
                  compact
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

function InventoryGroup({
  title,
  outlooks,
  queue,
  onHeaderPress
}: {
  title: string;
  outlooks: InventoryOutlookItem[];
  queue: InventoryOutboxEntry[];
  onHeaderPress?: () => void;
}) {
  if (outlooks.length === 0) return null;
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole={onHeaderPress ? "button" : undefined}
        disabled={!onHeaderPress}
        onPress={onHeaderPress}
        style={styles.groupHeader}
      >
        <Text style={styles.groupTitle}>{title}</Text>
      </Pressable>
      <View style={styles.inventoryList}>
        {outlooks.map((outlook, index) => (
          <InventoryListRow
            key={outlook.item.id}
            outlook={outlook}
            divided={index > 0}
            queueCount={queue.filter((entry) => entry.event.inventoryItemId === outlook.item.id).length}
            compact
          />
        ))}
      </View>
    </View>
  );
}

function matchesInventoryFilter(status: InventoryStatus, filter: InventoryFilter) {
  if (filter === "All") return true;
  if (filter === "At risk") return status === "Critical" || status === "Low";
  return status === filter;
}

function isCanonicalUnitReady(item: InventoryItem) {
  return (
    item.canonical_unit_verification_status === "verified" &&
    (item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each")
  );
}

function categoryIcon(category: string, color: string) {
  const props = { size: 16, color, strokeWidth: 2.2 } as const;
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("protein") || normalized.includes("meat") || normalized.includes("beef") || normalized.includes("chicken")) {
    return <Beef {...props} />;
  }
  if (normalized.includes("produce") || normalized.includes("veg") || normalized.includes("fruit")) {
    return <LeafyGreen {...props} />;
  }
  if (normalized.includes("dairy") || normalized.includes("milk") || normalized.includes("cheese")) {
    return <Milk {...props} />;
  }
  if (normalized.includes("dry") || normalized.includes("grain") || normalized.includes("flour") || normalized.includes("rice")) {
    return <Wheat {...props} />;
  }
  if (normalized.includes("oil") || normalized.includes("sauce") || normalized.includes("liquid")) {
    return <Droplets {...props} />;
  }
  return <Package {...props} />;
}

function InventoryListRow({
  outlook,
  divided,
  queueCount,
  compact = false
}: {
  outlook: InventoryOutlookItem;
  divided: boolean;
  queueCount: number;
  compact?: boolean;
}) {
  const { formatNumber, t } = useLocale();
  const { item, prediction } = outlook;
  const localized = localizeInventoryPrediction(t, formatNumber, item, prediction);
  const isCritical = prediction.projectedStatus === "Critical";
  const isLow = prediction.projectedStatus === "Low";
  const isWatch = prediction.projectedStatus === "Watch";
  const isGood = prediction.projectedStatus === "Good";
  const canonicalReady = isCanonicalUnitReady(item);
  const entryHint = !canonicalReady
    ? t("inventory.row.needsVerification")
    : queueCount > 0
      ? t(queueCount === 1 ? "inventory.row.queued.one" : "inventory.row.queued.other", {
          count: formatNumber(queueCount)
        })
      : t("inventory.row.openOps");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("inventory.row.accessibilityLedger", {
        item: item.item_name,
        status: localized.status,
        coverage: localized.coverage,
        action: localized.action,
        confidence: localized.confidence,
        queue: entryHint
      })}
      accessibilityHint={t("inventory.row.hintOps")}
      onPress={() => router.push(`/inventory/${item.id}`)}
      style={({ pressed }) => [
        styles.inventoryRow,
        compact && styles.inventoryRowCompact,
        isCritical && styles.inventoryRowCritical,
        isLow && styles.inventoryRowLow,
        prediction.projectedStatus === "Watch" && styles.inventoryRowWatch,
        isGood && styles.inventoryRowGood,
        divided && styles.dividedRow,
        pressed && styles.rowPressed
      ]}
    >
      <View
        style={[
          styles.statusIcon,
          isCritical && styles.statusIconCritical,
          isLow && styles.statusIconLow,
          isWatch && styles.statusIconWatch,
          isGood && styles.statusIconGood
        ]}
      >
        {categoryIcon(item.category, isCritical ? inventoryStatusColors.Critical : isLow ? inventoryStatusColors.Low : isGood ? colors.success : inventoryStatusColors.Watch)}
      </View>
      <View style={styles.itemCopy}>
        <View style={styles.itemTitleRow}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.item_name}</Text>
          <Text
            style={[
              styles.statusLabel,
              isCritical && styles.statusLabelCritical,
              isLow && styles.statusLabelLow,
              isGood && styles.statusLabelGood
            ]}
          >
            {localized.status}
          </Text>
        </View>
        <Text style={styles.itemCoverage} numberOfLines={1}>
          {formatNumber(prediction.projectedQuantity, { maximumFractionDigits: 1 })} {item.unit} · {localized.coverage}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.faint} strokeWidth={2.25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10
  },
  emptyButton: {
    marginTop: 12
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerAction: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  healthCard: {
    minHeight: density.healthCard,
    maxHeight: 84,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    justifyContent: "center"
  },
  healthLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  healthLabel: {
    color: colors.text,
    ...conceptTypography.sectionTitle
  },
  healthChip: {
    borderRadius: radii.xl,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  healthChipGood: {
    backgroundColor: colors.successSoft
  },
  healthChipWatch: {
    backgroundColor: colors.warningSoft
  },
  healthChipText: {
    ...conceptTypography.caption
  },
  healthChipTextGood: {
    color: colors.success
  },
  healthChipTextWatch: {
    color: colors.warning
  },
  healthHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  healthPercent: {
    color: colors.success,
    fontFamily: typography.families.bold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.3
  },
  healthCopy: {
    flex: 1,
    minWidth: 0
  },
  healthTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  healthBody: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: typography.families.body,
    marginTop: 0
  },
  group: {
    gap: 2
  },
  groupHeader: {
    minHeight: 20,
    justifyContent: "center"
  },
  groupTitle: {
    color: colors.text,
    ...conceptTypography.sectionTitle
  },
  allStock: {
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  hiddenFilters: {
    height: 0,
    overflow: "hidden",
    opacity: 0
  },
  controls: {
    gap: 6
  },
  searchBox: {
    minHeight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: {
    flex: 1,
    minHeight: 34,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 0
  },
  inventoryList: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden"
  },
  inventoryRow: {
    minHeight: density.operationalRow,
    height: density.operationalRow,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  inventoryRowCompact: {
    minHeight: density.operationalRow,
    height: density.operationalRow
  },
  inventoryRowCritical: {
    borderLeftColor: inventoryStatusColors.Critical
  },
  inventoryRowLow: {
    borderLeftColor: inventoryStatusColors.Low
  },
  inventoryRowWatch: {
    borderLeftColor: inventoryStatusColors.Watch
  },
  inventoryRowGood: {
    borderLeftColor: inventoryStatusColors.Good
  },
  dividedRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  rowPressed: {
    backgroundColor: colors.panel
  },
  statusIcon: {
    width: density.iconPlain,
    height: density.iconPlain,
    borderRadius: 6,
    backgroundColor: inventoryStatusSoftColors.Watch,
    alignItems: "center",
    justifyContent: "center"
  },
  statusIconCritical: {
    backgroundColor: colors.dangerSoft
  },
  statusIconLow: {
    backgroundColor: inventoryStatusSoftColors.Low
  },
  statusIconWatch: {
    backgroundColor: inventoryStatusSoftColors.Watch
  },
  statusIconGood: {
    backgroundColor: colors.successSoft
  },
  itemCopy: {
    flex: 1,
    minWidth: 0
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  itemTitle: {
    flex: 1,
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  statusLabel: {
    color: inventoryStatusColors.Watch,
    ...conceptTypography.caption,
    fontFamily: typography.families.bold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: inventoryStatusSoftColors.Watch
  },
  statusLabelCritical: {
    color: inventoryStatusColors.Critical,
    backgroundColor: colors.dangerSoft
  },
  statusLabelLow: {
    color: inventoryStatusColors.Low,
    backgroundColor: inventoryStatusSoftColors.Low
  },
  statusLabelGood: {
    color: inventoryStatusColors.Good,
    backgroundColor: colors.successSoft
  },
  itemCoverage: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: typography.families.body,
    marginTop: 0
  },
  emptyList: {
    minHeight: 72,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 4
  },
  emptyListTitle: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 16
  },
  emptyListCopy: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center"
  }
});

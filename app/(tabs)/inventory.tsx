import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, Package, Search } from "lucide-react-native";
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
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { FilterRow, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, inventoryStatusColors, inventoryStatusSoftColors, radii, shadows, typography } from "../../constants/theme";
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
  const queueSummary = useMemo(() => summarizeQueue(visibleQueue), [visibleQueue]);
  const unverifiedCount = useMemo(
    () => visibleOutlooks.filter(({ item }) => !isCanonicalUnitReady(item)).length,
    [visibleOutlooks]
  );

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
      <Screen title={t("inventory.title")} subtitle={t("inventory.subtitle")}>
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
      subtitle={t("inventory.subtitleRestaurant", { restaurant: restaurant.name })}
      loading={loading}
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

        <MotionView distance={3} duration={240}>
          <SectionSurface
            title={t("inventory.health.title")}
            separatedHeader={false}
          >
            <View accessible accessibilityLabel={healthAccessibilityLabel}>
              <View style={styles.healthHead}>
                <Text style={styles.healthPercent}>
                  {healthTotal === 0 ? formatNumber(0, { style: "percent" }) : healthPercentLabel}
                </Text>
                <View style={styles.healthCopy}>
                  <Text style={styles.healthTitle}>
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
                  <Text style={styles.healthBody}>{healthBody}</Text>
                </View>
              </View>
              <InventoryHealthBar counts={healthCounts} />
              <View style={styles.healthLegend}>
                {(
                  [
                    { label: healthLabels.good, value: healthCounts.good, color: inventoryStatusColors.Good },
                    { label: healthLabels.watch, value: healthCounts.watch, color: inventoryStatusColors.Watch },
                    { label: healthLabels.low, value: healthCounts.low, color: inventoryStatusColors.Low },
                    { label: healthLabels.critical, value: healthCounts.critical, color: inventoryStatusColors.Critical }
                  ] as const
                ).map(({ label, value, color }) => (
                  <View key={label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={styles.legendText}>{label} {formatNumber(value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </SectionSurface>
        </MotionView>

        {reorderCount > 0 ? (
          <StatusNotice
            title={t("inventory.reorder.title")}
            message={t(reorderCount === 1 ? "inventory.reorder.body.one" : "inventory.reorder.body.other", {
              count: formatNumber(reorderCount)
            })}
            tone="warning"
            actionLabel={t("inventory.reorder.action")}
            onAction={() => router.push("/orders")}
          />
        ) : null}

        {queueSummary.open > 0 ? (
          <StatusNotice
            title={t("inventory.queueSummary.title")}
            message={t("inventory.queueSummary.body", {
              pending: formatNumber(queueSummary.pending),
              conflicts: formatNumber(queueSummary.conflicts),
              rejected: formatNumber(queueSummary.rejected)
            })}
            tone={queueSummary.conflicts + queueSummary.rejected > 0 ? "danger" : "caution"}
          />
        ) : null}

        {unverifiedCount > 0 ? (
          <StatusNotice
            title={t("inventory.unverifiedSummary.title")}
            message={t(
              unverifiedCount === 1
                ? "inventory.unverifiedSummary.body.one"
                : "inventory.unverifiedSummary.body.other",
              { count: formatNumber(unverifiedCount) }
            )}
            tone="warning"
          />
        ) : null}

        <MotionView delay={40} distance={3} duration={240}>
          <SectionSurface
            title={t("inventory.list.title")}
            subtitle={t("inventory.list.subtitleLedger")}
            action={t(filtered.length === 1 ? "inventory.itemCount.one" : "inventory.itemCount.other", {
              count: formatNumber(filtered.length)
            })}
            padding="none"
          >
            <View style={styles.controls}>
              <View style={styles.searchBox}>
                <Search size={20} color={colors.faint} strokeWidth={2.25} />
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
              <FilterRow
                accessibilityLabel={t("inventory.filter.accessibility")}
                options={filterOptions}
                value={filter}
                onValueChange={setFilter}
              />
            </View>

            {filtered.length === 0 ? (
              <View style={styles.emptyList}>
                <Package size={24} color={colors.faint} strokeWidth={2.25} />
                <Text style={styles.emptyListTitle}>{t("inventory.emptyMatches.title")}</Text>
                <Text style={styles.emptyListCopy}>{t("inventory.emptyMatches.body")}</Text>
              </View>
            ) : (
              <View style={styles.inventoryList}>
                {filtered.map((outlook, index) => (
                  <InventoryListRow
                    key={outlook.item.id}
                    outlook={outlook}
                    divided={index > 0}
                    queueCount={visibleQueue.filter((entry) => entry.event.inventoryItemId === outlook.item.id).length}
                  />
                ))}
              </View>
            )}
          </SectionSurface>
        </MotionView>
      </View>
    </Screen>
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

function summarizeQueue(entries: readonly InventoryOutboxEntry[]) {
  let pending = 0;
  let conflicts = 0;
  let rejected = 0;
  for (const entry of entries) {
    if (entry.status === "conflict") conflicts += 1;
    else if (entry.status === "rejected") rejected += 1;
    else if (entry.status === "pending" || entry.status === "submitting") pending += 1;
  }
  return { pending, conflicts, rejected, open: pending + conflicts + rejected };
}

function InventoryListRow({
  outlook,
  divided,
  queueCount
}: {
  outlook: InventoryOutlookItem;
  divided: boolean;
  queueCount: number;
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
        {isCritical || isLow ? (
          <AlertTriangle
            size={20}
            color={isCritical ? inventoryStatusColors.Critical : inventoryStatusColors.Low}
            strokeWidth={2.25}
          />
        ) : isGood ? (
          <CheckCircle2 size={20} color={colors.success} strokeWidth={2.25} />
        ) : (
          <Clock3 size={20} color={inventoryStatusColors.Watch} strokeWidth={2.25} />
        )}
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
        <Text style={styles.itemSupplier} numberOfLines={1}>{item.supplier_name} · {item.category}</Text>
        <Text style={styles.itemCoverage} numberOfLines={2}>
          {t("inventory.row.projected", {
            quantity: formatNumber(prediction.projectedQuantity, { maximumFractionDigits: 1 }),
            unit: item.unit,
            coverage: localized.coverage
          })}
        </Text>
        <View style={styles.signalRow}>
          <Text
            style={[
              styles.itemAction,
              isCritical && styles.itemActionCritical,
              isLow && styles.itemActionLow,
              prediction.projectedStatus === "Watch" && styles.itemActionWatch,
              isGood && styles.itemActionGood
            ]}
            numberOfLines={1}
          >
            {localized.action}
          </Text>
          <Text style={styles.signalSeparator}>·</Text>
          <Text style={styles.itemTrend} numberOfLines={1}>{localized.trend}</Text>
        </View>
        <Text style={styles.itemEvidence} numberOfLines={2}>
          {t("inventory.row.confidence", { confidence: localized.confidence })}
        </Text>
        <Text
          style={[styles.itemOpsHint, !canonicalReady && styles.itemOpsHintWarn, queueCount > 0 && styles.itemOpsHintQueue]}
          numberOfLines={1}
        >
          {entryHint}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.faint} strokeWidth={2.25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  emptyButton: {
    marginTop: 12
  },
  healthHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  },
  healthPercent: {
    color: colors.success,
    fontFamily: typography.families.bold,
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.8
  },
  healthCopy: {
    flex: 1,
    minWidth: 0
  },
  healthTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  healthBody: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  healthLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  legendText: {
    color: colors.muted,
    fontFamily: typography.families.medium,
    fontSize: 11,
    lineHeight: 14
  },
  controls: {
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  searchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0
  },
  inventoryList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.card
  },
  inventoryRow: {
    minHeight: 112,
    borderLeftWidth: 4,
    borderLeftColor: colors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
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
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  rowPressed: {
    backgroundColor: colors.surfaceWarm
  },
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    gap: 8
  },
  itemTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 15,
    lineHeight: 20
  },
  statusLabel: {
    color: inventoryStatusColors.Watch,
    fontFamily: typography.families.bold,
    fontSize: 11,
    lineHeight: 15
  },
  statusLabelCritical: {
    color: inventoryStatusColors.Critical
  },
  statusLabelLow: {
    color: inventoryStatusColors.Low
  },
  statusLabelGood: {
    color: inventoryStatusColors.Good
  },
  itemSupplier: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  itemCoverage: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4
  },
  signalRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5
  },
  itemAction: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 11,
    lineHeight: 15
  },
  itemActionCritical: {
    color: inventoryStatusColors.Critical
  },
  itemActionLow: {
    color: inventoryStatusColors.Low
  },
  itemActionWatch: {
    color: inventoryStatusColors.Watch
  },
  itemActionGood: {
    color: inventoryStatusColors.Good
  },
  signalSeparator: {
    flexShrink: 0,
    color: colors.faint,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 15
  },
  itemTrend: {
    flexShrink: 1,
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 15
  },
  itemEvidence: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3
  },
  itemOpsHint: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4
  },
  itemOpsHintWarn: {
    color: colors.warning
  },
  itemOpsHintQueue: {
    color: colors.caution
  },
  emptyList: {
    minHeight: 150,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  emptyListTitle: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 8
  },
  emptyListCopy: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    textAlign: "center"
  }
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Beef,
  ClipboardList,
  Droplets,
  Filter,
  LeafyGreen,
  Milk,
  Package,
  Search,
  ShoppingCart,
  Wheat
} from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  buildInventoryHealthAccessibilityLabel,
  getInventoryHealthTotal,
  getWellStockedPercentage,
  type InventoryHealthCounts
} from "../../components/ui/InventoryHealth";
import { InventoryHealthSummaryCard } from "../../components/ui/InventoryHealthSummaryCard";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { RowGroup } from "../../components/ui/RowGroup";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { FilterRow, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, inventoryStatusColors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { localizeInventoryPrediction } from "../../i18n/inventoryPresentation";
import type { InventoryOutboxEntry } from "../../services/domain/inventoryOutbox";
import {
  fetchInventoryOutlookItems,
  fetchOpenInventoryCountSession,
  fetchQueuedInventoryEvents,
  summarizeInventoryOutlooks
} from "../../services/miseService";
import { resolveRestaurantScopedHubLoadState } from "../../services/presentation/hubLoadState";
import { canDraftInventoryCount } from "../../services/tenantAccess";
import type { InventoryItem, InventoryOutlookItem, InventoryStatus } from "../../types/mise";

type InventoryFilter = "All" | "At risk" | "Watch" | "Good";

export default function InventoryScreen() {
  const { formatNumber, t } = useLocale();
  const { restaurant, memberships } = useMiseSession();
  const canDraftCount = canDraftInventoryCount(memberships, restaurant?.id ?? "");
  const [outlooks, setOutlooks] = useState<InventoryOutlookItem[]>([]);
  const [queueEntries, setQueueEntries] = useState<InventoryOutboxEntry[]>([]);
  const [openCountSessionId, setOpenCountSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("All");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  const searchInputRef = useRef<TextInput>(null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setOutlooks([]);
    setQueueEntries([]);
    setOpenCountSessionId(null);
    setQuery("");
    setFilter("All");
    setSearchExpanded(false);
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
      const [nextOutlooks, nextQueue, openSession] = await Promise.all([
        fetchInventoryOutlookItems(restaurantId),
        fetchQueuedInventoryEvents(restaurantId),
        fetchOpenInventoryCountSession(restaurantId).catch(() => null)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutlooks(nextOutlooks);
      setQueueEntries(nextQueue);
      setOpenCountSessionId(openSession?.session.id ?? null);
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

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: error
  });
  const hubReady = hubLoadState === "ready";
  // Soft-refresh errors must not claim "no inventory matches" from a cleared
  // outlook list while RetryNotice is already showing.
  const hubUnavailable = hubLoadState === "error";
  const visibleOutlooks = hubReady ? outlooks : [];
  const visibleQueue = hubReady ? queueEntries : [];

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
  const showStockBrowser = searchExpanded || filter !== "All";

  if (!restaurant) {
    return (
      <Screen title={t("inventory.title")} subtitle={t("inventory.subtitle")} titleAlign="left">
        <EmptyState
          title={t("inventory.noWorkspace.title")}
          body={t("inventory.noWorkspace.body")}
          illustration={<Package size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
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
          <ActionIcon
            accessibilityLabel={t("inventory.search.accessibility")}
            onPress={() => {
              setSearchExpanded(true);
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
          >
            <Search size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
          </ActionIcon>
          <ActionIcon
            accessibilityLabel={t("inventory.filter.toggle")}
            onPress={() => setFilter((current) => (current === "At risk" ? "All" : "At risk"))}
          >
            <Filter size={icon.emphasis} color={filter === "At risk" ? colors.warning : colors.text} strokeWidth={iconStroke} />
          </ActionIcon>
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

        {/* Only render once counts are real: mounting the card mid-load showed
            a dead grey bar under a live percentage. */}
        {healthTotal > 0 ? (
        <InventoryHealthSummaryCard
          counts={healthCounts}
          title={t("inventory.health.title")}
          percentLabel={healthTotal === 0 ? formatNumber(0, { style: "percent" }) : healthPercentLabel}
          chipLabel={
            healthTotal === 0
              ? healthLabels.empty
              : attentionCount === 0
                ? healthLabels.wellStocked
                : t(attentionCount === 1 ? "inventory.health.attention.one" : "inventory.health.attention.other", {
                    count: formatNumber(attentionCount)
                  })
          }
          chipTone={attentionCount > 0 ? "warning" : "success"}
          body={healthBody}
          accessibilityLabel={healthAccessibilityLabel}
        />
        ) : null}

        <InventoryGroup
          title={t("inventory.group.lowStock")}
          outlooks={visibleOutlooks.filter(({ prediction }) => prediction.projectedStatus === "Low").slice(0, 3)}
          queue={visibleQueue}
          onHeaderPress={() => setFilter("At risk")}
        />
        <InventoryGroup
          title={t("inventory.group.stockAlerts")}
          outlooks={visibleOutlooks.filter(({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Watch").slice(0, 3)}
          queue={visibleQueue}
          onHeaderPress={() => setFilter("Watch")}
        />
        {/* The concept shows reorder as one summary row, not a repeat of the
            same items already listed under Low stock and Stock alerts. */}
        {reorderCount > 0 ? (
          <View style={styles.group}>
            <SectionHeader title={t("inventory.group.reorder")} />
            <RowGroup>
              <OperationalRow
                density="operational"
                title={t(
                  reorderCount === 1
                    ? "inventory.reorder.summary.one"
                    : "inventory.reorder.summary.other",
                  { count: formatNumber(reorderCount) }
                )}
                subtitle={t("inventory.reorder.basis")}
                icon={<ShoppingCart size={icon.row} color={colors.accentDark} strokeWidth={iconStroke} />}
                iconTone="brand"
                onPress={() => router.push("/orders")}
              />
            </RowGroup>
          </View>
        ) : null}

        {showStockBrowser ? <View style={styles.allStock}>
          <FilterRow
            accessibilityLabel={t("inventory.filter.accessibility")}
            options={filterOptions}
            value={filter}
            onValueChange={setFilter}
          />
          <SectionHeader title={t("inventory.list.title")} />
          <View style={styles.controls}>
            <View style={styles.searchBox}>
              <Search size={icon.row} color={colors.faint} strokeWidth={iconStroke} />
              <TextInput
                ref={searchInputRef}
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
            hubUnavailable ? (
              <View style={styles.emptyList}>
                <Package size={icon.emphasis} color={colors.faint} strokeWidth={iconStroke} />
                <Text style={styles.emptyListTitle}>{t("inventory.emptyMatches.unavailable.title")}</Text>
                <Text style={styles.emptyListBody}>{t("inventory.emptyMatches.unavailable.body")}</Text>
              </View>
            ) : hubReady ? (
              <View style={styles.emptyList}>
                <Package size={icon.emphasis} color={colors.faint} strokeWidth={iconStroke} />
                <Text style={styles.emptyListTitle}>{t("inventory.emptyMatches.title")}</Text>
                <Text style={styles.emptyListBody}>{t("inventory.emptyMatches.body")}</Text>
              </View>
            ) : null
          ) : hubReady ? (
            <RowGroup>
              {filtered.map((outlook) => (
                <InventoryListRow
                  key={outlook.item.id}
                  outlook={outlook}
                  queueCount={visibleQueue.filter((entry) => entry.event.inventoryItemId === outlook.item.id).length}
                />
              ))}
            </RowGroup>
          ) : null}
        </View> : null}

        {showStockBrowser && hubReady && (canDraftCount || openCountSessionId) ? (
          <View style={styles.countSection}>
            <SectionHeader
              title={t("inventory.count.cardTitle")}
              subtitle={
                openCountSessionId
                  ? t("inventory.count.cardOpenSubtitle")
                  : t("inventory.count.cardSubtitle")
              }
            />
            <Button
              title={
                openCountSessionId
                  ? t("inventory.count.resumeAction")
                  : t("inventory.count.startAction")
              }
              onPress={() => router.push("/inventory/count")}
              variant="secondary"
              size="compact"
              accessibilityLabel={
                openCountSessionId
                  ? t("inventory.count.resumeAccessibility")
                  : t("inventory.count.startAccessibility")
              }
              icon={<ClipboardList size={16} color={colors.text} strokeWidth={iconStroke} />}
            />
          </View>
        ) : null}
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
  const { t } = useLocale();
  if (outlooks.length === 0) return null;
  return (
    <View style={styles.group}>
      <SectionHeader
        title={title}
        action={onHeaderPress ? t("common.viewAll") : undefined}
        onAction={onHeaderPress}
      />
      <RowGroup>
        {outlooks.map((outlook) => (
          <InventoryListRow
            key={outlook.item.id}
            outlook={outlook}
            queueCount={queue.filter((entry) => entry.event.inventoryItemId === outlook.item.id).length}
          />
        ))}
      </RowGroup>
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
  const props = { size: 18, color, strokeWidth: 2.2 } as const;
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
  queueCount
}: {
  outlook: InventoryOutlookItem;
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
  const statusColor = isCritical
    ? inventoryStatusColors.Critical
    : isLow
      ? inventoryStatusColors.Low
      : isGood
        ? colors.success
        : inventoryStatusColors.Watch;
  const iconTone = isCritical ? "danger" : isLow ? "warning" : isWatch ? "caution" : "leaf";
  const badgeTone = isCritical ? "danger" : isLow ? "warning" : isWatch ? "caution" : "success";

  return (
    <OperationalRow
      density="operational"
      title={item.item_name}
      subtitle={`${formatNumber(prediction.projectedQuantity, { maximumFractionDigits: 1 })} ${item.unit} · ${localized.coverage}`}
      icon={categoryIcon(item.category, statusColor)}
      iconTone={iconTone}
      badgeLabel={localized.status}
      badgeTone={badgeTone}
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
    />
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  emptyButton: {
    marginTop: 16
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center"
  },
  group: {
    gap: 4
  },
  allStock: {
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  countSection: {
    gap: 6,
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  controls: {
    gap: 10
  },
  searchBox: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 0
  },
  inventoryList: {
    backgroundColor: colors.surface,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    overflow: "hidden"
  },
  emptyList: {
    minHeight: 120,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8
  },
  emptyListTitle: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 15,
    lineHeight: 20
  },
  emptyListBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center"
  }
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Clock3, Package, PackagePlus, Search, Trash2 } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  InventoryHealth,
  InventoryHealthBar,
  type InventoryHealthCounts
} from "../../components/ui/InventoryHealth";
import { ProduceCrateIllustration } from "../../components/ui/MiseIllustrations";
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { FilterRow, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, inventoryStatusColors, inventoryStatusSoftColors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { localizeInventoryPrediction } from "../../i18n/inventoryPresentation";
import {
  fetchInventoryLocationHealthBreakdown,
  fetchInventoryOutlookItems,
  fetchOpenInventoryCountSession,
  summarizeInventoryOutlooks
} from "../../services/miseService";
import type { InventoryLocationHealthBreakdown } from "../../services/presentation/inventoryHealthPresentation";
import { canDraftInventoryCount, canManageRestaurantData, canRecordInventoryWaste } from "../../services/tenantAccess";
import type { InventoryOutlookItem, InventoryStatus } from "../../types/mise";

type InventoryFilter = "All" | "At risk" | "Watch" | "Good";

export default function InventoryScreen() {
  const { formatNumber, t } = useLocale();
  const { restaurant, memberships } = useMiseSession();
  const canDraftCount = canDraftInventoryCount(memberships, restaurant?.id ?? "");
  const canManageInventory = canManageRestaurantData(memberships, restaurant?.id ?? "");
  const canRecordWaste = canRecordInventoryWaste(memberships, restaurant?.id ?? "");
  const [outlooks, setOutlooks] = useState<InventoryOutlookItem[]>([]);
  const [locationHealth, setLocationHealth] = useState<InventoryLocationHealthBreakdown | null>(null);
  const [openCountSessionId, setOpenCountSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const searchInputRef = useRef<TextInput>(null);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setOutlooks([]);
    setLocationHealth(null);
    setOpenCountSessionId(null);
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
      const [nextOutlooks, openSession, nextLocationHealth] = await Promise.all([
        fetchInventoryOutlookItems(restaurantId),
        fetchOpenInventoryCountSession(restaurantId),
        fetchInventoryLocationHealthBreakdown(restaurantId).catch(() => null)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutlooks(nextOutlooks);
      setLocationHealth(nextLocationHealth);
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

  const visibleOutlooks = loadedRestaurantId === restaurant?.id ? outlooks : [];
  const visibleLocationHealth =
    loadedRestaurantId === restaurant?.id ? locationHealth : null;

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
            <InventoryHealth
              counts={healthCounts}
              labels={{
                good: t("inventory.health.good"),
                watch: t("inventory.health.watch"),
                low: t("inventory.health.low"),
                critical: t("inventory.health.critical"),
                wellStocked: t("inventory.health.wellStocked"),
                empty: t("inventory.health.empty")
              }}
            />
            {visibleLocationHealth && visibleLocationHealth.stationCount > 1 ? (
              <View
                accessible
                accessibilityLabel={t("inventory.health.stationsAccessibility")}
                style={styles.stationBlock}
              >
                <Text style={styles.stationTitle}>{t("inventory.health.stationsTitle")}</Text>
                <View style={styles.stationList}>
                  {visibleLocationHealth.locations.map((station) => (
                    <View key={station.locationId} style={styles.stationRow}>
                      <View style={styles.stationCopy}>
                        <Text numberOfLines={1} style={styles.stationName}>
                          {station.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.stationMeta}>
                          {station.itemCount === 0
                            ? t("inventory.health.stationEmpty")
                            : [
                                t(
                                  station.itemCount === 1
                                    ? "inventory.health.stationItems.one"
                                    : "inventory.health.stationItems.other",
                                  { count: formatNumber(station.itemCount) }
                                ),
                                station.atRiskCount > 0
                                  ? t(
                                      station.atRiskCount === 1
                                        ? "inventory.health.stationAtRisk.one"
                                        : "inventory.health.stationAtRisk.other",
                                      { count: formatNumber(station.atRiskCount) }
                                    )
                                  : null
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                        </Text>
                      </View>
                      <View style={styles.stationBar}>
                        <InventoryHealthBar counts={station.counts} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </SectionSurface>
        </MotionView>

        {canManageInventory ? (
          <MotionView delay={10} distance={3} duration={240}>
            <SectionSurface
              title={t("inventory.create.cardTitle")}
              subtitle={t("inventory.create.listSubtitle")}
            >
              <Button
                title={t("inventory.create.listAction")}
                onPress={() => router.push("/inventory/new")}
                fullWidth
                accessibilityLabel={t("inventory.create.listAccessibility")}
                icon={<PackagePlus size={18} color={colors.cream} strokeWidth={2.25} />}
              />
            </SectionSurface>
          </MotionView>
        ) : null}

        {canDraftCount || openCountSessionId ? (
          <MotionView delay={20} distance={3} duration={240}>
            <SectionSurface
              title={t("inventory.count.cardTitle")}
              subtitle={
                openCountSessionId
                  ? t("inventory.count.cardOpenSubtitle")
                  : t("inventory.count.cardSubtitle")
              }
            >
              <Button
                title={
                  openCountSessionId
                    ? t("inventory.count.resumeAction")
                    : t("inventory.count.startAction")
                }
                onPress={() => router.push("/inventory/count")}
                fullWidth
                accessibilityLabel={
                  openCountSessionId
                    ? t("inventory.count.resumeAccessibility")
                    : t("inventory.count.startAccessibility")
                }
                icon={<ClipboardList size={18} color={colors.cream} strokeWidth={2.25} />}
              />
            </SectionSurface>
          </MotionView>
        ) : null}

        {canRecordWaste ? (
          <MotionView delay={30} distance={3} duration={240}>
            <SectionSurface
              title={t("inventory.waste.cardTitle")}
              subtitle={t("inventory.waste.cardSubtitle")}
            >
              <Button
                title={t("inventory.waste.findItemAction")}
                onPress={() => searchInputRef.current?.focus()}
                fullWidth
                variant="secondary"
                accessibilityLabel={t("inventory.waste.findItemAccessibility")}
                icon={<Trash2 size={18} color={colors.text} strokeWidth={2.25} />}
              />
            </SectionSurface>
          </MotionView>
        ) : null}

        <MotionView delay={40} distance={3} duration={240}>
          <SectionSurface
            title={t("inventory.list.title")}
            subtitle={t("inventory.list.subtitle")}
            action={t(filtered.length === 1 ? "inventory.itemCount.one" : "inventory.itemCount.other", {
              count: formatNumber(filtered.length)
            })}
            padding="none"
          >
            <View style={styles.controls}>
              <View style={styles.searchBox}>
                <Search size={20} color={colors.faint} strokeWidth={2.25} />
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
                  <InventoryListRow key={outlook.item.id} outlook={outlook} divided={index > 0} />
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

function InventoryListRow({ outlook, divided }: { outlook: InventoryOutlookItem; divided: boolean }) {
  const { formatNumber, t } = useLocale();
  const { item, prediction } = outlook;
  const localized = localizeInventoryPrediction(t, formatNumber, item, prediction);
  const isCritical = prediction.projectedStatus === "Critical";
  const isLow = prediction.projectedStatus === "Low";
  const isWatch = prediction.projectedStatus === "Watch";
  const isGood = prediction.projectedStatus === "Good";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("inventory.row.accessibility", {
        item: item.item_name,
        status: localized.status,
        coverage: localized.coverage,
        action: localized.action,
        confidence: localized.confidence
      })}
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
  stationBlock: {
    marginTop: 14,
    gap: 8
  },
  stationTitle: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.2,
    textTransform: "uppercase"
  },
  stationList: {
    gap: 8
  },
  stationRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  stationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1
  },
  stationName: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 17
  },
  stationMeta: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11.5,
    lineHeight: 15
  },
  stationBar: {
    width: 72,
    flexShrink: 0
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
    backgroundColor: colors.surface
  },
  inventoryRow: {
    minHeight: 120,
    borderLeftWidth: 3,
    borderLeftColor: colors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
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
    width: 36,
    height: 36,
    borderRadius: radii.md,
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

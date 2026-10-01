import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, Check, CheckCircle, ChevronDown, MapPin, Search, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  filterPosMappingMenuItemsBySearch,
  POS_MAPPING_MENU_ITEM_SEARCH_THRESHOLD
} from "../../services/domain/posMappingMenuItemSearch";
import {
  fetchPosMappingReviewQueue,
  reviewPosCatalogMapping,
  type PosMappingReviewQueue
} from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";

export default function PosMappingsScreen() {
  const navigation = useNavigation();
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const [queue, setQueue] = useState<PosMappingReviewQueue | null>(null);
  const [selectedMenuItemIds, setSelectedMenuItemIds] = useState<Record<string, string>>({});
  const [expandedMappingId, setExpandedMappingId] = useState<string | null>(null);
  const [menuItemQuery, setMenuItemQuery] = useState("");
  const [busyMappingId, setBusyMappingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(restaurant && canManage));
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "neutral" | "danger"; message: string } | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setQueue(null);
    setSelectedMenuItemIds({});
    setExpandedMappingId(null);
    setMenuItemQuery("");
    setBusyMappingId(null);
    setNotice(null);
    setLoadError(false);
    setLoading(Boolean(restaurant && canManage));
  }, [canManage, restaurant?.id]);

  useEffect(() => {
    setMenuItemQuery("");
  }, [expandedMappingId]);

  const loadQueue = useCallback(async () => {
    if (!restaurant || !canManage) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const next = await fetchPosMappingReviewQueue(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      const activeMenuIds = new Set(next.menuItems.map((item) => item.id));
      setQueue(next);
      setSelectedMenuItemIds((current) => Object.fromEntries(
        next.mappings.flatMap((mapping) => {
          const currentSelection = current[mapping.id];
          const selection = currentSelection && activeMenuIds.has(currentSelection)
            ? currentSelection
            : mapping.suggestedMenuItemId && activeMenuIds.has(mapping.suggestedMenuItemId)
              ? mapping.suggestedMenuItemId
              : null;
          return selection ? [[mapping.id, selection]] : [];
        })
      ));
    } catch {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setQueue(null);
        setLoadError(true);
      }
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [canManage, restaurant?.id]);

  useFocusEffect(useCallback(() => {
    void loadQueue();
  }, [loadQueue]));

  const menuById = useMemo(
    () => new Map(queue?.menuItems.map((item) => [item.id, item]) ?? []),
    [queue?.menuItems]
  );

  const showMenuItemSearch = (queue?.menuItems.length ?? 0) > POS_MAPPING_MENU_ITEM_SEARCH_THRESHOLD;
  const filteredMenuItems = useMemo(
    () =>
      filterPosMappingMenuItemsBySearch(
        queue?.menuItems ?? [],
        showMenuItemSearch ? menuItemQuery : ""
      ),
    [menuItemQuery, queue?.menuItems, showMenuItemSearch]
  );
  const menuItemSearchNoMatches =
    showMenuItemSearch &&
    menuItemQuery.trim().length > 0 &&
    filteredMenuItems.length === 0;

  async function decide(mappingId: string, decision: "verify" | "reject") {
    if (!restaurant || !canManage || busyMappingId) return;
    const restaurantId = restaurant.id;
    const menuItemId = decision === "verify" ? selectedMenuItemIds[mappingId] ?? null : null;
    if (decision === "verify" && !menuItemId) {
      setNotice({ tone: "danger", message: t("pos.mappings.selectRequired") });
      return;
    }

    setBusyMappingId(mappingId);
    setNotice(null);
    try {
      const result = await reviewPosCatalogMapping(
        restaurantId,
        mappingId,
        menuItemId,
        decision
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setQueue((current) => current && current.restaurantId === restaurantId
        ? { ...current, mappings: current.mappings.filter((mapping) => mapping.id !== mappingId) }
        : current);
      setExpandedMappingId((current) => current === mappingId ? null : current);
      setNotice({
        tone: decision === "verify" ? "success" : "neutral",
        message: result.outcome === "already_verified" || result.outcome === "already_rejected"
          ? t("pos.mappings.notice.alreadyReviewed")
          : decision === "verify"
            ? t("pos.mappings.notice.verified")
            : t("pos.mappings.notice.rejected")
      });
      await loadQueue();
    } catch {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({ tone: "danger", message: t("pos.mappings.notice.failed") });
      await loadQueue();
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyMappingId(null);
    }
  }

  function goBack() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings/pos");
  }

  return (
    <Screen
      title={t("pos.mappings.screenTitle")}
      subtitle={t("pos.mappings.screenSubtitle")}
      action={
        <ActionIcon accessibilityLabel={t("pos.mappings.back")} onPress={goBack}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        {!canManage ? (
          <StatusNotice
            tone="warning"
            title={t("pos.mappings.roleTitle")}
            message={t("pos.mappings.roleBody")}
          />
        ) : loadError ? (
          <StatusNotice
            tone="danger"
            title={t("pos.mappings.loadErrorTitle")}
            message={t("pos.mappings.loadErrorBody")}
            actionLabel={t("common.retry")}
            onAction={() => void loadQueue()}
          />
        ) : loading || !queue ? (
          <Text style={styles.loading}>{t("common.loading")}</Text>
        ) : queue.pendingCount === 0 ? (
          <Card>
            <View style={styles.emptyState}>
              <CheckCircle size={icon.emphasis} color={colors.success} strokeWidth={iconStroke} />
              <Text style={styles.emptyTitle}>{t("pos.mappings.emptyTitle")}</Text>
              <Text style={styles.emptyBody}>{t("pos.mappings.emptyBody")}</Text>
            </View>
          </Card>
        ) : (
          <>
            <SectionHeader
              eyebrow={t("pos.mappings.eyebrow")}
              title={t("pos.mappings.queueTitle")}
              action={String(queue.pendingCount)}
            />
            {queue.mappings.map((mapping) => {
              const selectedMenuItemId = selectedMenuItemIds[mapping.id] ?? null;
              const selectedMenuItem = selectedMenuItemId ? menuById.get(selectedMenuItemId) : null;
              const expanded = expandedMappingId === mapping.id;
              const busy = busyMappingId === mapping.id;
              return (
                <Card key={mapping.id}>
                  <View style={styles.mappingHeader}>
                    <View style={styles.locationIcon}>
                      <MapPin size={icon.row} color={colors.accentDark} strokeWidth={iconStroke} />
                    </View>
                    <View style={styles.mappingCopy}>
                      <Text style={styles.location}>{mapping.locationName}</Text>
                      <Text style={styles.mappingName}>{mapping.externalName}</Text>
                      <Text style={styles.mappingMeta} numberOfLines={1}>
                        {t("pos.mappings.variation", { value: mapping.externalVariationId })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.suggestion}>
                    <Text style={styles.suggestionLabel}>{t("pos.mappings.suggestionLabel")}</Text>
                    <Text style={styles.suggestionValue}>
                      {mapping.suggestedMenuItemName ?? t("common.none")}
                    </Text>
                    <Text style={styles.suggestionBody}>{t("pos.mappings.suggestionBody")}</Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded, disabled: busy }}
                    accessibilityHint={t("pos.mappings.chooseHint")}
                    disabled={busy}
                    onPress={() => setExpandedMappingId((current) => current === mapping.id ? null : mapping.id)}
                    style={({ pressed }) => [
                      styles.choiceControl,
                      pressed && !busy && styles.pressed,
                      busy && styles.disabled
                    ]}
                  >
                    <View style={styles.mappingCopy}>
                      <Text style={styles.choiceLabel}>{t("pos.mappings.selectedLabel")}</Text>
                      <Text style={styles.choiceValue}>{selectedMenuItem?.name ?? t("pos.mappings.chooseItem")}</Text>
                    </View>
                    <ChevronDown size={icon.row} color={colors.muted} strokeWidth={iconStroke} />
                  </Pressable>

                  {expanded ? (
                    <View style={styles.choiceList} accessibilityRole="radiogroup">
                      {showMenuItemSearch ? (
                        <View style={styles.menuSearchBox}>
                          <Search size={icon.row} color={colors.faint} strokeWidth={iconStroke} />
                          <TextInput
                            accessibilityLabel={t("pos.mappings.search.accessibility")}
                            accessibilityHint={t("pos.mappings.search.hint")}
                            accessibilityState={{ disabled: busy }}
                            value={menuItemQuery}
                            onChangeText={setMenuItemQuery}
                            editable={!busy}
                            placeholder={t("pos.mappings.search.placeholder")}
                            placeholderTextColor={colors.faint}
                            returnKeyType="search"
                            autoCorrect={false}
                            autoCapitalize="none"
                            style={styles.menuSearchInput}
                          />
                        </View>
                      ) : null}
                      {showMenuItemSearch ? (
                        <Text style={styles.menuSearchMeta} accessibilityLiveRegion="polite">
                          {t("pos.mappings.search.showing", {
                            shown: formatNumber(filteredMenuItems.length),
                            total: formatNumber(queue.menuItems.length)
                          })}
                        </Text>
                      ) : null}
                      {menuItemSearchNoMatches ? (
                        <Text style={styles.menuSearchEmpty} accessibilityLiveRegion="polite">
                          {t("pos.mappings.search.empty")}
                        </Text>
                      ) : (
                        filteredMenuItems.map((menuItem) => {
                          const selected = selectedMenuItemId === menuItem.id;
                          return (
                            <Pressable
                              key={menuItem.id}
                              accessibilityRole="radio"
                              accessibilityState={{ selected, disabled: busy }}
                              disabled={busy}
                              onPress={() => {
                                setSelectedMenuItemIds((current) => ({ ...current, [mapping.id]: menuItem.id }));
                                setExpandedMappingId(null);
                              }}
                              style={({ pressed }) => [
                                styles.choiceRow,
                                selected && styles.choiceRowSelected,
                                pressed && !busy && styles.pressed
                              ]}
                            >
                              <View style={[styles.choiceDot, selected && styles.choiceDotSelected]}>
                                {selected ? <Check size={12} color={colors.surface} strokeWidth={3} /> : null}
                              </View>
                              <View style={styles.mappingCopy}>
                                <Text style={styles.choiceValue}>{menuItem.name}</Text>
                                {menuItem.category ? <Text style={styles.mappingMeta}>{menuItem.category}</Text> : null}
                              </View>
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    <Button
                      title={busy ? t("pos.mappings.reviewing") : t("pos.mappings.verify")}
                      icon={<Check size={icon.inline} color={colors.surface} strokeWidth={iconStroke} />}
                      onPress={() => void decide(mapping.id, "verify")}
                      disabled={busy || !selectedMenuItemId}
                      style={styles.action}
                    />
                    <Button
                      title={t("pos.mappings.reject")}
                      icon={<X size={icon.inline} color={colors.surface} strokeWidth={iconStroke} />}
                      variant="danger"
                      onPress={() => void decide(mapping.id, "reject")}
                      disabled={busy}
                      style={styles.action}
                    />
                  </View>
                </Card>
              );
            })}
          </>
        )}

        {notice ? (
          <StatusNotice
            tone={notice.tone}
            title={t("pos.mappings.notice.title")}
            message={notice.message}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  loading: { ...typography.body, color: colors.muted },
  emptyState: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  emptyTitle: { ...typography.cardTitle, color: colors.text, textAlign: "center" },
  emptyBody: { ...typography.body, color: colors.muted, textAlign: "center" },
  mappingHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  mappingCopy: { flex: 1, minWidth: 0, gap: 2 },
  location: { ...typography.caption, color: colors.accentDark, fontWeight: "700" },
  mappingName: { ...typography.cardTitle, color: colors.text },
  mappingMeta: { ...typography.caption, color: colors.muted },
  suggestion: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: spacing.sm,
    gap: 3
  },
  suggestionLabel: { ...typography.caption, color: colors.muted, fontWeight: "700" },
  suggestionValue: { ...typography.body, color: colors.text, fontWeight: "700" },
  suggestionBody: { ...typography.caption, color: colors.muted },
  choiceControl: {
    minHeight: 48,
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  choiceLabel: { ...typography.caption, color: colors.muted },
  choiceValue: { ...typography.body, color: colors.text, fontWeight: "700" },
  choiceList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    overflow: "hidden"
  },
  menuSearchBox: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  menuSearchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  menuSearchMeta: {
    ...typography.caption,
    color: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: 4
  },
  menuSearchEmpty: {
    ...typography.body,
    color: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  choiceRow: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  choiceRowSelected: { backgroundColor: colors.accentSoft },
  choiceDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  choiceDotSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 }
});

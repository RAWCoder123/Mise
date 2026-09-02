import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, PackageCheck } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  fetchSupplierDeliveryOutcomes,
  type DeliveryOutcomeStatusFilter,
  type SupplierDeliveryOutcomeView
} from "../../services/miseService";
import { filterSupplierDeliveryOutcomeViews } from "../../services/domain/actionOutcomes";
import { resolveRestaurantScopedHubLoadState } from "../../services/presentation/hubLoadState";
import { captureMiseError } from "../../services/telemetry";

const FILTERS: DeliveryOutcomeStatusFilter[] = ["attention", "all"];

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function DeliveryOutcomesScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [outcomes, setOutcomes] = useState<SupplierDeliveryOutcomeView[]>([]);
  const [filter, setFilter] = useState<DeliveryOutcomeStatusFilter>("attention");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setOutcomes([]);
    setLoadedRestaurantId(null);
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
      const next = await fetchSupplierDeliveryOutcomes(restaurantId, { limit: 80 });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutcomes(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, {
        flow: "delivery_outcomes",
        operation: "load",
        restaurant_id: restaurantId
      });
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
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
  const visibleOutcomes = hubReady
    ? filterSupplierDeliveryOutcomeViews(outcomes, filter)
    : [];

  const emptyCopy = useMemo(() => {
    if (filter === "attention") {
      return {
        title: t("deliveryOutcomes.empty.attention.title"),
        body: t("deliveryOutcomes.empty.attention.body")
      };
    }
    return {
      title: t("deliveryOutcomes.empty.all.title"),
      body: t("deliveryOutcomes.empty.all.body")
    };
  }, [filter, t]);

  if (!restaurant) {
    return (
      <Screen title={t("deliveryOutcomes.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState
          title={t("tasks.noRestaurant.title")}
          body={t("deliveryOutcomes.empty.all.body")}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("deliveryOutcomes.title")}
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading && hubLoadState === "loading"}
    >
      <View style={styles.stack}>
        <Text style={styles.intro}>{t("deliveryOutcomes.intro")}</Text>

        {hubLoadState === "error" ? (
          <StatusNotice
            tone="danger"
            title={t("deliveryOutcomes.loadFailed.title")}
            message={t("deliveryOutcomes.loadFailed.body")}
            actionLabel={t("common.retry")}
            onAction={() => void load()}
          />
        ) : null}

        {hubReady ? (
          <View style={styles.filters}>
            {FILTERS.map((entry) => {
              const selected = filter === entry;
              return (
                <Pressable
                  key={entry}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(entry)}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                >
                  <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
                    {t(`deliveryOutcomes.filter.${entry}` as MessageKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {hubReady && visibleOutcomes.length === 0 ? (
          <EmptyState
            illustration={
              <PackageCheck size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
            }
            title={emptyCopy.title}
            body={emptyCopy.body}
          />
        ) : null}

        {hubReady
          ? visibleOutcomes.map((outcome) => (
              <Pressable
                key={outcome.id}
                accessibilityRole="button"
                accessibilityLabel={t("deliveryOutcomes.row.accessibility", {
                  supplier: outcome.supplierName ?? t("deliveryOutcomes.row.unknownSupplier")
                })}
                disabled={!outcome.supplierOrderId}
                onPress={() => {
                  if (!outcome.supplierOrderId) return;
                  router.push(`/orders/${outcome.supplierOrderId}` as never);
                }}
                style={({ pressed }) => [styles.card, pressed && outcome.supplierOrderId && styles.pressed]}
              >
                <View style={styles.cardHeader}>
                  <Badge
                    label={t(`deliveryOutcomes.kind.${outcome.kind}` as MessageKey)}
                    tone={kindTone(outcome.kind)}
                  />
                  <Text style={styles.cardMeta}>
                    {formatDate(outcome.measuredAt, {
                      dateStyle: "medium",
                      timeZone: restaurant.timezone
                    })}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>
                  {outcome.supplierName ?? t("deliveryOutcomes.row.unknownSupplier")}
                </Text>
                <Text style={styles.cardBody}>
                  {outcome.lessonCode === "custom" && outcome.lessonText
                    ? outcome.lessonText
                    : t(`deliveryOutcomes.lesson.${outcome.lessonCode}` as MessageKey)}
                </Text>
                {outcome.lineCount != null ? (
                  <Text style={styles.cardMeta}>
                    {t(
                      outcome.lineCount === 1
                        ? "deliveryOutcomes.row.lines.one"
                        : "deliveryOutcomes.row.lines.other",
                      { count: formatNumber(outcome.lineCount) }
                    )}
                  </Text>
                ) : null}
              </Pressable>
            ))
          : null}
      </View>
    </Screen>
  );
}

function kindTone(kind: SupplierDeliveryOutcomeView["kind"]): BadgeTone {
  if (kind === "matched") return "success";
  if (kind === "discrepancy" || kind === "failed") return "danger";
  if (kind === "partial" || kind === "unverified") return "warning";
  return "neutral";
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  intro: {
    ...conceptTypography.body,
    color: colors.muted
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  filterChipSelected: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  filterLabel: {
    ...conceptTypography.caption,
    color: colors.text
  },
  filterLabelSelected: {
    color: colors.surface
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6
  },
  pressed: {
    opacity: 0.88
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  cardTitle: {
    ...conceptTypography.subtitle,
    color: colors.text
  },
  cardBody: {
    ...conceptTypography.body,
    color: colors.text
  },
  cardMeta: {
    ...conceptTypography.caption,
    color: colors.muted
  }
});

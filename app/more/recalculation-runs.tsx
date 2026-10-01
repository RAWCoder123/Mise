import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, RefreshCw } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  filterRecalculationHistory,
  RECALCULATION_HISTORY_FILTERS,
  type RecalculationHistoryFilter
} from "../../services/domain/recalculationHistory";
import { fetchRecalculationRuns } from "../../services/miseService";
import { resolveRestaurantScopedHubLoadState } from "../../services/presentation/hubLoadState";
import {
  presentRecalculationHistoryRow,
  recalculationHistoryFilterMessageKey
} from "../../services/presentation/recalculationPresentation";
import type { PersistedRecalculationRun } from "../../services/repositories/repositoryContracts";
import { captureMiseError } from "../../services/telemetry";

export default function RecalculationRunsScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [filter, setFilter] = useState<RecalculationHistoryFilter>("attention");
  const [runs, setRuns] = useState<PersistedRecalculationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const filterOptions = useMemo<readonly SegmentOption<RecalculationHistoryFilter>[]>(
    () =>
      RECALCULATION_HISTORY_FILTERS.map((value) => ({
        value,
        label: t(recalculationHistoryFilterMessageKey(value)),
        tone: value === "attention" ? "brand" : "neutral"
      })),
    [t]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setRuns([]);
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
      const next = await fetchRecalculationRuns(restaurantId, { limit: 80 });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setRuns(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, {
        flow: "recalculation_history",
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
  const visible = hubReady ? filterRecalculationHistory(runs, filter) : [];

  return (
    <Screen
      title={t("recalculationHistory.title")}
      subtitle={
        restaurant
          ? t("recalculationHistory.subtitle", { restaurant: restaurant.name })
          : t("recalculationHistory.subtitle.none")
      }
      loading={loading}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <Text style={styles.intro}>{t("recalculationHistory.intro")}</Text>

        <SegmentedControl
          accessibilityLabel={t("recalculationHistory.filter.accessibility")}
          options={filterOptions}
          value={filter}
          onValueChange={setFilter}
          scrollable
          variant="pills"
        />

        {error ? (
          <RetryNotice
            title={t("recalculationHistory.error.title")}
            message={t("recalculationHistory.error.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("recalculationHistory.error.retry")}
            onRetry={() => void load()}
          />
        ) : null}

        {!error && visible.length === 0 ? (
          <EmptyState
            title={
              filter === "attention"
                ? t("recalculationHistory.empty.attention.title")
                : t("recalculationHistory.empty.all.title")
            }
            body={
              filter === "attention"
                ? t("recalculationHistory.empty.attention.body")
                : t("recalculationHistory.empty.all.body")
            }
            illustration={
              <RefreshCw size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />
            }
          />
        ) : null}

        {visible.map((run) => {
          const row = presentRecalculationHistoryRow(run);
          return (
            <View key={run.id} style={styles.card}>
              <View style={styles.badges}>
                <Badge label={t(row.statusKey)} tone={row.statusTone} uppercase />
                <Badge label={t(row.cycleKey)} tone="neutral" />
                {row.timedOut ? (
                  <Badge
                    label={t("recalculationHistory.badge.timedOut")}
                    tone="warning"
                    uppercase
                  />
                ) : null}
              </View>
              <Text style={styles.title}>{t(row.cycleKey)}</Text>
              <Text style={styles.meta}>
                {t(row.attemptLabelKey, {
                  attempt: formatNumber(row.attempt),
                  max: formatNumber(row.maxAttempts)
                })}
                {" · "}
                {t("recalculationHistory.owner", { role: t(row.monitoringOwnerKey) })}
              </Text>
              <Text style={styles.meta}>
                {t("recalculationHistory.completed", {
                  date: formatDate(row.completedAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: restaurant?.timezone
                  })
                })}
                {" · "}
                {t("recalculationHistory.duration", {
                  ms: formatNumber(row.durationMs)
                })}
              </Text>
              <Text style={styles.meta}>
                {t("recalculationHistory.operatingDate", { date: row.operatingDate })}
              </Text>
              {row.failureReason ? (
                <Text style={styles.failure}>{row.failureReason}</Text>
              ) : null}
              <Text style={styles.job}>{row.jobName}</Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  intro: {
    color: colors.muted,
    ...conceptTypography.body
  },
  card: {
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  title: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  meta: {
    color: colors.faint,
    ...conceptTypography.caption
  },
  failure: {
    color: colors.muted,
    ...conceptTypography.body
  },
  job: {
    color: colors.faint,
    ...conceptTypography.caption
  }
});

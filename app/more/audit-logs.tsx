import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Shield } from "lucide-react-native";
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
  AUDIT_LOG_HISTORY_FILTERS,
  filterAuditLogHistory,
  type AuditLogHistoryFilter
} from "../../services/domain/auditLogHistory";
import { fetchAuditLogs } from "../../services/miseService";
import { resolveRestaurantScopedHubLoadState } from "../../services/presentation/hubLoadState";
import {
  auditLogHistoryFilterMessageKey,
  presentAuditLogHistoryRow
} from "../../services/presentation/auditLogPresentation";
import { canBrowseAuditLogs } from "../../services/tenantAccess";
import type { AuditLog } from "../../types/mise";
import { captureMiseError } from "../../services/telemetry";

export default function AuditLogsScreen() {
  const { formatDate, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canBrowse = canBrowseAuditLogs(memberships, restaurant?.id);
  const [filter, setFilter] = useState<AuditLogHistoryFilter>("all");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const filterOptions = useMemo<readonly SegmentOption<AuditLogHistoryFilter>[]>(
    () =>
      AUDIT_LOG_HISTORY_FILTERS.map((value) => ({
        value,
        label: t(auditLogHistoryFilterMessageKey(value)),
        tone: value === "purchasing" ? "brand" : "neutral"
      })),
    [t]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setLogs([]);
    setLoadedRestaurantId(null);
    setError(false);
    setLoading(Boolean(restaurant) && canBrowse);
  }, [restaurant?.id, canBrowse]);

  const load = useCallback(async () => {
    if (!restaurant || !canBrowse) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchAuditLogs(restaurantId, { limit: 100 });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setLogs(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, {
        flow: "audit_logs",
        operation: "load",
        restaurant_id: restaurantId
      });
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [canBrowse, restaurant?.id]);

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
  const visible = hubReady ? filterAuditLogHistory(logs, filter) : [];

  return (
    <Screen
      title={t("auditLogs.title")}
      subtitle={
        restaurant
          ? t("auditLogs.subtitle", { restaurant: restaurant.name })
          : t("auditLogs.subtitle.none")
      }
      loading={loading && canBrowse}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <Text style={styles.intro}>{t("auditLogs.intro")}</Text>

        {!canBrowse ? (
          <EmptyState
            title={t("auditLogs.denied.title")}
            body={t("auditLogs.denied.body")}
            illustration={
              <Shield size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />
            }
          />
        ) : null}

        {canBrowse ? (
          <SegmentedControl
            accessibilityLabel={t("auditLogs.filter.accessibility")}
            options={filterOptions}
            value={filter}
            onValueChange={setFilter}
            scrollable
            variant="pills"
          />
        ) : null}

        {canBrowse && error ? (
          <RetryNotice
            title={t("auditLogs.error.title")}
            message={t("auditLogs.error.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("auditLogs.error.retry")}
            onRetry={() => void load()}
          />
        ) : null}

        {canBrowse && !error && visible.length === 0 ? (
          <EmptyState
            title={
              filter === "all"
                ? t("auditLogs.empty.all.title")
                : t("auditLogs.empty.filtered.title")
            }
            body={
              filter === "all"
                ? t("auditLogs.empty.all.body")
                : t("auditLogs.empty.filtered.body")
            }
            illustration={
              <Shield size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />
            }
          />
        ) : null}

        {visible.map((entry) => {
          const row = presentAuditLogHistoryRow(entry);
          return (
            <View key={entry.id} style={styles.card}>
              <View style={styles.badges}>
                <Badge label={t(row.categoryKey)} tone={row.categoryTone} uppercase />
                <Badge label={row.entityTable} tone="neutral" />
              </View>
              <Text style={styles.title}>
                {row.actionKey ? t(row.actionKey) : row.actionFallback}
              </Text>
              <Text style={styles.meta}>
                {t("auditLogs.recorded", {
                  date: formatDate(row.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: restaurant?.timezone
                  })
                })}
              </Text>
              {row.entityId ? (
                <Text style={styles.meta}>
                  {t("auditLogs.entity", { id: shortenId(row.entityId) })}
                </Text>
              ) : null}
              {row.actorUserId ? (
                <Text style={styles.meta}>
                  {t("auditLogs.actor", { id: shortenId(row.actorUserId) })}
                </Text>
              ) : (
                <Text style={styles.meta}>{t("auditLogs.actor.system")}</Text>
              )}
              {row.metadataEntries.length > 0 ? (
                <View style={styles.metadata}>
                  {row.metadataEntries.map((item) => (
                    <Text key={`${row.id}:${item.key}`} style={styles.meta}>
                      {t("auditLogs.metadata.entry", { key: item.key, value: item.value })}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function shortenId(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}…`;
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
    ...conceptTypography.subtitle
  },
  meta: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  metadata: {
    gap: 2,
    paddingTop: 2
  }
});

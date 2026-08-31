import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ClipboardList, Diff } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../../components/ui/ActionIcon";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Screen } from "../../../components/ui/Screen";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { SectionSurface } from "../../../components/ui/SectionSurface";
import { RetryNotice } from "../../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../../constants/theme";
import { useLocale } from "../../../contexts/LocaleContext";
import { useMiseSession } from "../../../contexts/MiseSessionContext";
import {
  isOpenCountSessionStatus,
  summarizeCountSessionProgress
} from "../../../services/domain/inventoryCountSessions";
import { fetchInventoryCountSession } from "../../../services/miseService";
import {
  presentCountSessionHistoryAt,
  presentCountSessionStatusBadgeTone,
  presentCountSessionStatusMessageKey
} from "../../../services/presentation/inventoryCountSessionPresentation";
import { resolveRestaurantScopedHubLoadState } from "../../../services/presentation/hubLoadState";
import { captureMiseError } from "../../../services/telemetry";
import type { InventoryCountSessionDetail } from "../../../types/mise";

export default function InventoryCountSessionDetailScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [detail, setDetail] = useState<InventoryCountSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setDetail(null);
    setLoadedRestaurantId(null);
    setError(false);
    setLoading(Boolean(restaurant && sessionId));
  }, [restaurant?.id, sessionId]);

  const load = useCallback(async () => {
    if (!restaurant || !sessionId) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchInventoryCountSession(restaurantId, sessionId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setDetail(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, {
        flow: "inventory_count_session_detail",
        operation: "load",
        restaurant_id: restaurantId
      });
      setError(true);
      setDetail(null);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id, sessionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visibleDetail = loadedRestaurantId === restaurant?.id ? detail : null;
  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: error
  });
  const hubReady = hubLoadState === "ready";
  const progress = useMemo(
    () => summarizeCountSessionProgress(visibleDetail?.lines ?? []),
    [visibleDetail?.lines]
  );
  const historyAt = visibleDetail ? presentCountSessionHistoryAt(visibleDetail.session) : null;
  const isOpen = visibleDetail ? isOpenCountSessionStatus(visibleDetail.session.status) : false;

  return (
    <Screen
      title={t("inventory.count.history.detailTitle")}
      subtitle={
        restaurant
          ? t("inventory.count.history.detailSubtitleRestaurant", { restaurant: restaurant.name })
          : t("inventory.count.history.detailSubtitle")
      }
      loading={loading && !hubReady}
      leadingAction={
        <ActionIcon
          accessibilityLabel={t("inventory.count.history.backToHistory")}
          onPress={() => router.back()}
        >
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.body}>
        {hubLoadState === "error" ? (
          <RetryNotice
            title={t("inventory.count.history.detailRetryTitle")}
            message={t("inventory.count.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void load()}
            accessibilityLabel={t("inventory.count.history.detailRetryAccessibility")}
          />
        ) : null}

        {!sessionId ? (
          <EmptyState
            illustration={<ClipboardList size={28} color={colors.faint} strokeWidth={iconStroke} />}
            title={t("inventory.count.history.missingTitle")}
            body={t("inventory.count.history.missingBody")}
          />
        ) : null}

        {sessionId && restaurant && hubReady && !visibleDetail ? (
          <EmptyState
            illustration={<ClipboardList size={28} color={colors.faint} strokeWidth={iconStroke} />}
            title={t("inventory.count.history.notFoundTitle")}
            body={t("inventory.count.history.notFoundBody")}
          />
        ) : null}

        {visibleDetail && hubReady ? (
          <>
            <SectionSurface>
              <View style={styles.summaryHeader}>
                <Badge
                  label={t(presentCountSessionStatusMessageKey(visibleDetail.session.status))}
                  tone={presentCountSessionStatusBadgeTone(visibleDetail.session.status)}
                />
                {historyAt ? (
                  <Text style={styles.summaryWhen}>
                    {formatDate(historyAt, { dateStyle: "medium", timeStyle: "short" })}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.summaryBody}>
                {t("inventory.count.progressBody", {
                  counted: formatNumber(progress.countedLines),
                  total: formatNumber(progress.totalLines),
                  variance: formatNumber(progress.varianceLines)
                })}
              </Text>
              {visibleDetail.session.note ? (
                <Text style={styles.note}>{visibleDetail.session.note}</Text>
              ) : null}
              {isOpen ? (
                <Button
                  title={t("inventory.count.resumeAction")}
                  onPress={() => router.push("/inventory/count")}
                  variant="secondary"
                  size="compact"
                  accessibilityLabel={t("inventory.count.resumeAccessibility")}
                  icon={<ClipboardList size={16} color={colors.text} strokeWidth={iconStroke} />}
                />
              ) : null}
            </SectionSurface>

            <View style={styles.linesSection}>
              <SectionHeader
                title={t("inventory.count.history.linesTitle")}
                subtitle={t("inventory.count.history.linesSubtitle")}
              />
              <View style={styles.lines}>
                {visibleDetail.lines.map((line) => {
                  const variance =
                    line.counted_quantity == null
                      ? null
                      : Number(line.counted_quantity) - Number(line.system_quantity_at_start);
                  return (
                    <View key={line.id} style={styles.lineCard}>
                      <View style={styles.lineHeader}>
                        <Text style={styles.lineName}>{line.item_name}</Text>
                        {variance != null && variance !== 0 ? (
                          <View style={styles.varianceBadge}>
                            <Diff size={12} color={colors.accent} strokeWidth={iconStroke} />
                            <Text style={styles.varianceText}>
                              {t("inventory.count.variance", {
                                quantity: formatNumber(variance),
                                unit: line.unit
                              })}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.lineMeta}>
                        {t("inventory.count.systemQty", {
                          quantity: formatNumber(line.system_quantity_at_start),
                          unit: line.unit
                        })}
                        {" · "}
                        {line.counted_quantity == null
                          ? t("inventory.count.history.uncounted")
                          : t("inventory.count.history.countedQty", {
                              quantity: formatNumber(line.counted_quantity),
                              unit: line.unit
                            })}
                      </Text>
                      {line.note ? <Text style={styles.lineNote}>{line.note}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    paddingBottom: 28
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8
  },
  summaryWhen: {
    ...typography.caption,
    color: colors.muted,
    flexShrink: 1,
    textAlign: "right"
  },
  summaryBody: {
    ...typography.body,
    color: colors.text,
    marginBottom: 8
  },
  note: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: 12
  },
  linesSection: {
    gap: 10
  },
  lines: {
    gap: 10
  },
  lineCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6
  },
  lineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  lineName: {
    ...typography.cardTitle,
    color: colors.text,
    flexShrink: 1
  },
  varianceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  varianceText: {
    ...typography.caption,
    color: colors.accent
  },
  lineMeta: {
    ...typography.caption,
    color: colors.muted
  },
  lineNote: {
    ...typography.caption,
    color: colors.text
  }
});

import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, ClipboardList } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { EmptyState } from "../../components/ui/EmptyState";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { RowGroup } from "../../components/ui/RowGroup";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, spacing } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { listInventoryCountSessionHistory } from "../../services/miseService";
import {
  presentCountSessionHistoryAt,
  presentCountSessionStatusBadgeTone,
  presentCountSessionStatusMessageKey
} from "../../services/presentation/inventoryCountSessionPresentation";
import { resolveRestaurantScopedHubLoadState } from "../../services/presentation/hubLoadState";
import { captureMiseError } from "../../services/telemetry";
import type { InventoryCountSession } from "../../types/mise";

export default function InventoryCountSessionHistoryScreen() {
  const { formatDate, formatRelativeTime, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [sessions, setSessions] = useState<InventoryCountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setSessions([]);
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
      const next = await listInventoryCountSessionHistory(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSessions(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, {
        flow: "inventory_count_history",
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
  const visibleSessions = loadedRestaurantId === restaurant?.id ? sessions : [];

  return (
    <Screen
      title={t("inventory.count.history.title")}
      subtitle={
        restaurant
          ? t("inventory.count.history.subtitleRestaurant", { restaurant: restaurant.name })
          : t("inventory.count.history.subtitle")
      }
      loading={loading && !hubReady}
      leadingAction={
        <ActionIcon accessibilityLabel={t("inventory.count.history.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.body}>
        {hubLoadState === "error" ? (
          <RetryNotice
            title={t("inventory.count.history.retryTitle")}
            message={t("inventory.count.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void load()}
            accessibilityLabel={t("inventory.count.history.retryAccessibility")}
          />
        ) : null}

        {!restaurant ? (
          <EmptyState
            illustration={<ClipboardList size={28} color={colors.faint} strokeWidth={iconStroke} />}
            title={t("inventory.count.history.noWorkspaceTitle")}
            body={t("inventory.count.history.noWorkspaceBody")}
          />
        ) : null}

        {restaurant && hubReady && visibleSessions.length === 0 ? (
          <EmptyState
            illustration={<ClipboardList size={28} color={colors.faint} strokeWidth={iconStroke} />}
            title={t("inventory.count.history.emptyTitle")}
            body={t("inventory.count.history.emptyBody")}
          />
        ) : null}

        {restaurant && hubReady && visibleSessions.length > 0 ? (
          <RowGroup>
            {visibleSessions.map((session) => {
              const closedAt = presentCountSessionHistoryAt(session);
              return (
                <OperationalRow
                  key={session.id}
                  density="operational"
                  title={formatDate(closedAt, { dateStyle: "medium", timeStyle: "short" })}
                  subtitle={formatRelativeTime(closedAt)}
                  icon={<ClipboardList size={16} color={colors.text} strokeWidth={iconStroke} />}
                  badgeLabel={t(presentCountSessionStatusMessageKey(session.status))}
                  badgeTone={presentCountSessionStatusBadgeTone(session.status)}
                  onPress={() => router.push(`/inventory/count-session/${session.id}`)}
                  accessibilityLabel={t("inventory.count.history.rowAccessibility", {
                    status: t(presentCountSessionStatusMessageKey(session.status)),
                    when: formatDate(closedAt, { dateStyle: "medium", timeStyle: "short" })
                  })}
                />
              );
            })}
          </RowGroup>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    paddingBottom: 28
  }
});

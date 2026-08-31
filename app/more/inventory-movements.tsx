import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, ArrowLeftRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import type { InventoryEvent } from "../../services/domain/inventoryLedger";
import {
  fetchRestaurantInventoryMovements,
  INVENTORY_MOVEMENT_FEED_FILTERS,
  type InventoryMovementFeedFilter,
  type RestaurantInventoryMovementRow
} from "../../services/miseService";
import {
  inventoryLedgerEventMessageKey,
  inventoryLedgerQuantityKind,
  inventoryLedgerSignedQuantity
} from "../../services/presentation/inventoryLedgerPresentation";
import { captureMiseError } from "../../services/telemetry";

export default function InventoryMovementsScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [filter, setFilter] = useState<InventoryMovementFeedFilter>("all");
  const [movements, setMovements] = useState<RestaurantInventoryMovementRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const filterOptions = useMemo<readonly SegmentOption<InventoryMovementFeedFilter>[]>(
    () =>
      INVENTORY_MOVEMENT_FEED_FILTERS.map((value) => ({
        value,
        label: t(`movements.filter.${value}` as MessageKey),
        tone: value === "waste" || value === "stockout" ? "warning" : "neutral"
      })),
    [t]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setMovements([]);
    setTruncated(false);
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
      const next = await fetchRestaurantInventoryMovements(restaurantId, { filter });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setMovements(next.movements);
      setTruncated(next.truncated);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      captureMiseError(loadError, {
        flow: "inventory_movements",
        operation: "load",
        restaurant_id: restaurantId
      });
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [filter, restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visible = loadedRestaurantId === restaurant?.id ? movements : [];
  const visibleTruncated = loadedRestaurantId === restaurant?.id ? truncated : false;

  if (!restaurant) {
    return (
      <Screen
        title={t("movements.title")}
        titleAlign="center"
        leadingAction={
          <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
            <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
          </ActionIcon>
        }
      >
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("movements.subtitle.none")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("movements.title")}
      subtitle={t("movements.subtitle", { restaurant: restaurant.name })}
      titleAlign="center"
      loading={loading}
      leadingAction={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <SegmentedControl
          accessibilityLabel={t("movements.filter.accessibility")}
          options={filterOptions}
          value={filter}
          onValueChange={setFilter}
          variant="pills"
          scrollable
        />

        {error ? (
          <RetryNotice
            title={t("movements.retry.title")}
            message={t("movements.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("movements.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {!error && !loading && visible.length === 0 ? (
          <EmptyState title={t("movements.empty.title")} body={t("movements.empty.body")} />
        ) : null}

        {visible.map((row) => (
          <MovementRow
            key={row.event.id}
            row={row}
            formatDate={formatDate}
            formatNumber={formatNumber}
            t={t}
          />
        ))}

        {visibleTruncated ? (
          <Text style={styles.truncated}>{t("movements.truncated")}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

function MovementRow({
  row,
  formatDate,
  formatNumber,
  t
}: {
  row: RestaurantInventoryMovementRow;
  formatDate: ReturnType<typeof useLocale>["formatDate"];
  formatNumber: ReturnType<typeof useLocale>["formatNumber"];
  t: ReturnType<typeof useLocale>["t"];
}) {
  const { event, itemName } = row;
  const actionLabel = t(inventoryLedgerEventMessageKey(event.eventType) as MessageKey);
  const title = itemName?.trim() || t("movements.item.unknown");
  const detail = movementDetailCopy({ event, formatDate, formatNumber, t });
  const notApplied = event.projectionApplied === false;
  const canOpenItem = Boolean(itemName);

  return (
    <Pressable
      accessibilityRole={canOpenItem ? "button" : undefined}
      accessibilityLabel={t("movements.rowAccessibility", {
        item: title,
        action: actionLabel,
        detail
      })}
      disabled={!canOpenItem}
      onPress={
        canOpenItem
          ? () => router.push(`/inventory/${event.inventoryItemId}` as never)
          : undefined
      }
      style={({ pressed }) => [styles.row, pressed && canOpenItem && styles.pressed]}
    >
      <View style={styles.rowIcon}>
        <ArrowLeftRight size={icon.inline} color={colors.text} strokeWidth={iconStroke} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>
          {actionLabel} · {detail}
        </Text>
      </View>
      {notApplied ? <Badge label={t("movements.notApplied")} tone="neutral" /> : null}
    </Pressable>
  );
}

function movementDetailCopy({
  event,
  formatDate,
  formatNumber,
  t
}: {
  event: InventoryEvent;
  formatDate: ReturnType<typeof useLocale>["formatDate"];
  formatNumber: ReturnType<typeof useLocale>["formatNumber"];
  t: ReturnType<typeof useLocale>["t"];
}) {
  const unitLabel = t(`inventory.ops.unit.${event.canonicalUnit}` as MessageKey);
  const dateLabel = formatDate(event.effectiveAt, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  const quantityKind = inventoryLedgerQuantityKind(event.eventType);
  if (quantityKind === "stockout") {
    return t("movements.meta.stockout", { date: dateLabel });
  }
  if (quantityKind === "set") {
    return t("movements.meta.set", {
      quantity: formatNumber(event.quantity, { maximumFractionDigits: 2 }),
      unit: unitLabel,
      date: dateLabel
    });
  }
  return t("movements.meta.delta", {
    quantity: formatNumber(inventoryLedgerSignedQuantity(event), {
      maximumFractionDigits: 2,
      signDisplay: "exceptZero"
    }),
    unit: unitLabel,
    date: dateLabel
  });
}

const styles = StyleSheet.create({
  stack: {
    gap: 10
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  rowTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  rowMeta: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: conceptTypography.body.fontFamily
  },
  truncated: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: conceptTypography.body.fontFamily,
    paddingHorizontal: 4,
    paddingBottom: 8
  },
  pressed: {
    opacity: 0.72
  }
});

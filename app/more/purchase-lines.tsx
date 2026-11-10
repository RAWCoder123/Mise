import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Receipt } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  fetchPurchaseLineHistory,
  fetchPurchaseLineNetByItem,
  fetchSuppliers
} from "../../services/miseService";
import {
  countUnmatchedPurchaseLineCredits,
  presentPurchaseLineHistory,
  presentPurchaseLineNets,
  type PresentedPurchaseLineHistoryRow,
  type PresentedPurchaseLineNet
} from "../../services/presentation/purchaseLinesPresentation";
import {
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { captureMiseError } from "../../services/telemetry";
import type { Supplier } from "../../types/mise";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function PurchaseLinesScreen() {
  const { formatCompactCurrency, formatDate, formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [nets, setNets] = useState<PresentedPurchaseLineNet[]>([]);
  const [history, setHistory] = useState<PresentedPurchaseLineHistoryRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setNets([]);
    setHistory([]);
    setSuppliers([]);
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
      const [nextNets, nextHistory, nextSuppliers] = await Promise.all([
        fetchPurchaseLineNetByItem(restaurantId),
        fetchPurchaseLineHistory(restaurantId, 40),
        fetchSuppliers(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setNets(presentPurchaseLineNets(nextNets));
      setHistory(presentPurchaseLineHistory(nextHistory));
      setSuppliers(nextSuppliers);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "purchase_lines",
        operation: "load",
        restaurant_id: restaurantId
      });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
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
  const visibleNets = hubReady ? nets : [];
  const visibleHistory = hubReady ? history : [];
  const unmatchedCount = countUnmatchedPurchaseLineCredits(visibleNets);

  const supplierNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const supplier of suppliers) {
      map.set(supplier.id, supplier.display_name);
    }
    return map;
  }, [suppliers]);

  function supplierLabel(supplierId: string | null) {
    if (!supplierId) return t("purchaseLines.supplier.unknown");
    return supplierNames.get(supplierId) ?? t("purchaseLines.supplier.unknown");
  }

  if (!restaurant) {
    return (
      <Screen title={t("purchaseLines.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("purchaseLines.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("purchaseLines.title")}
      subtitle={t("purchaseLines.subtitle", { restaurant: restaurant.name })}
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("purchaseLines.retry.title")}
            message={t("purchaseLines.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("purchaseLines.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {hubReady ? (
          <>
            <Card>
              <Text style={styles.summaryTitle}>{t("purchaseLines.summary.title")}</Text>
              <Text style={styles.summaryBody}>{t("purchaseLines.summary.body")}</Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={t("purchaseLines.summary.groups", {
                    count: formatNumber(visibleNets.length)
                  })}
                  tone="neutral"
                />
                <Badge
                  label={t("purchaseLines.summary.unmatched", {
                    count: formatNumber(unmatchedCount)
                  })}
                  tone={unmatchedCount > 0 ? "warning" : "neutral"}
                />
                <Badge
                  label={t("purchaseLines.summary.recent", {
                    count: formatNumber(visibleHistory.length)
                  })}
                  tone="neutral"
                />
              </View>
            </Card>

            <SectionHeader title={t("purchaseLines.section.net")} />
            {visibleNets.length === 0 ? (
              <EmptyState
                title={t("purchaseLines.empty.net.title")}
                body={t("purchaseLines.empty.net.body")}
                illustration={
                  <Receipt size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />
                }
              />
            ) : (
              <Card style={styles.listCard}>
                {visibleNets.map((net) => (
                  <OperationalRow
                    key={net.key}
                    density="operational"
                    title={net.itemLabel ?? t("purchaseLines.item.none")}
                    subtitle={netSubtitle(net, supplierLabel(net.supplierId), formatNumber, t)}
                    meta={netMeta(net, formatCompactCurrency, formatNumber, t)}
                    icon={
                      <Receipt
                        size={icon.row}
                        color={colors.text}
                        strokeWidth={iconStroke}
                      />
                    }
                    iconTone={net.unmatchedCredit ? "warning" : "neutral"}
                    badgeLabel={
                      net.unmatchedCredit
                        ? t("purchaseLines.badge.unmatched")
                        : t("purchaseLines.badge.lines", {
                            purchases: formatNumber(net.purchaseLineCount),
                            credits: formatNumber(net.creditLineCount)
                          })
                    }
                    badgeTone={net.unmatchedCredit ? "warning" : "neutral"}
                  />
                ))}
              </Card>
            )}

            <SectionHeader title={t("purchaseLines.section.recent")} />
            {visibleHistory.length === 0 ? (
              <EmptyState
                title={t("purchaseLines.empty.recent.title")}
                body={t("purchaseLines.empty.recent.body")}
              />
            ) : (
              <Card style={styles.listCard}>
                {visibleHistory.map((line) => (
                  <OperationalRow
                    key={line.id}
                    density="operational"
                    title={line.itemLabel ?? t("purchaseLines.item.none")}
                    subtitle={historySubtitle(line, supplierLabel(line.supplierId), formatDate, t)}
                    meta={historyMeta(line, formatCompactCurrency, formatNumber, t)}
                    icon={
                      <Receipt
                        size={icon.row}
                        color={colors.text}
                        strokeWidth={iconStroke}
                      />
                    }
                    iconTone={
                      line.parseConfidence === "could_not_verify"
                        ? "warning"
                        : line.current
                          ? "neutral"
                          : "caution"
                    }
                    badgeLabel={t(confidenceKey(line.parseConfidence))}
                    badgeTone={
                      line.parseConfidence === "could_not_verify"
                        ? "warning"
                        : line.current
                          ? "neutral"
                          : "danger"
                    }
                  />
                ))}
              </Card>
            )}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function netSubtitle(
  net: PresentedPurchaseLineNet,
  supplier: string,
  formatNumber: ReturnType<typeof useLocale>["formatNumber"],
  t: ReturnType<typeof useLocale>["t"]
) {
  const unit = net.unitOfMeasure ?? t("common.notSet");
  const quantity =
    net.netQuantity === null
      ? t("common.notSet")
      : formatNumber(net.netQuantity, { maximumFractionDigits: 2 });
  return t("purchaseLines.net.subtitle", {
    supplier,
    quantity,
    unit
  });
}

function netMeta(
  net: PresentedPurchaseLineNet,
  formatCompactCurrency: ReturnType<typeof useLocale>["formatCompactCurrency"],
  formatNumber: ReturnType<typeof useLocale>["formatNumber"],
  t: ReturnType<typeof useLocale>["t"]
) {
  if (net.netExtendedPrice === null || !net.currency) {
    return t("purchaseLines.net.spendUnavailable");
  }
  return t("purchaseLines.net.spend", {
    amount: formatCompactCurrency(net.netExtendedPrice, net.currency),
    purchases: formatNumber(net.purchaseLineCount),
    credits: formatNumber(net.creditLineCount)
  });
}

function historySubtitle(
  line: PresentedPurchaseLineHistoryRow,
  supplier: string,
  formatDate: ReturnType<typeof useLocale>["formatDate"],
  t: ReturnType<typeof useLocale>["t"]
) {
  return t("purchaseLines.history.subtitle", {
    supplier,
    date: formatDate(line.transactionDate),
    document: line.sourceDocumentReference,
    type: t(lineTypeKey(line.lineType))
  });
}

function historyMeta(
  line: PresentedPurchaseLineHistoryRow,
  formatCompactCurrency: ReturnType<typeof useLocale>["formatCompactCurrency"],
  formatNumber: ReturnType<typeof useLocale>["formatNumber"],
  t: ReturnType<typeof useLocale>["t"]
) {
  const quantity =
    line.quantity === null
      ? t("common.notSet")
      : formatNumber(line.quantity, { maximumFractionDigits: 2 });
  const unit = line.unitOfMeasure ?? t("common.notSet");
  const amount =
    line.extendedPrice === null || !line.currency
      ? t("common.notSet")
      : formatCompactCurrency(line.extendedPrice, line.currency);
  const status = line.current
    ? t("purchaseLines.history.current")
    : t("purchaseLines.history.superseded");
  return t("purchaseLines.history.meta", {
    quantity,
    unit,
    amount,
    status
  });
}

function lineTypeKey(lineType: PresentedPurchaseLineHistoryRow["lineType"]): MessageKey {
  return lineType === "credit"
    ? "purchaseLines.lineType.credit"
    : "purchaseLines.lineType.purchase";
}

function confidenceKey(
  confidence: PresentedPurchaseLineHistoryRow["parseConfidence"]
): MessageKey {
  if (confidence === "estimated") return "purchaseLines.confidence.estimated";
  if (confidence === "could_not_verify") return "purchaseLines.confidence.couldNotVerify";
  return "purchaseLines.confidence.confirmed";
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  summaryTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  summaryBody: {
    marginTop: 4,
    color: colors.muted,
    ...conceptTypography.body
  },
  badgeRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  listCard: {
    paddingVertical: 2,
    paddingHorizontal: 0,
    overflow: "hidden"
  }
});

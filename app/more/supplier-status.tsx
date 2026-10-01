import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import type {
  SupplierReliabilityEntry,
  SupplierReliabilityReason,
  SupplierReliabilityStatus,
  SupplierReliabilitySummary
} from "../../services/domain/supplierReliability";
import {
  fetchSupplierReliabilitySummary
} from "../../services/miseService";
import {
  partitionSupplierStatusSections,
  primarySupplierFollowUpOrderId,
  supplierStatusTone
} from "../../services/presentation/supplierStatusPresentation";
import { captureMiseError } from "../../services/telemetry";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function SupplierStatusScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [summary, setSummary] = useState<SupplierReliabilitySummary | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setSummary(null);
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
      const nextSummary = await fetchSupplierReliabilitySummary(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setSummary(nextSummary);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "supplier_status",
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

  const visibleSummary = loadedRestaurantId === restaurant?.id ? summary : null;
  const sections = visibleSummary ? partitionSupplierStatusSections(visibleSummary) : [];

  if (!restaurant) {
    return (
      <Screen title={t("supplierStatus.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState
          title={t("tasks.noRestaurant.title")}
          body={t("supplierStatus.noRestaurant.body")}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("supplierStatus.title")}
      subtitle={
        visibleSummary
          ? t("supplierStatus.subtitleCounted", {
              suppliers: formatNumber(visibleSummary.supplierCount),
              deliveries: formatNumber(visibleSummary.totalDeliveries)
            })
          : t("supplierStatus.subtitle")
      }
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("supplierStatus.retry.title")}
            message={t("supplierStatus.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("supplierStatus.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {visibleSummary ? (
          <>
            <Card>
              <Text style={styles.summaryBody}>
                {visibleSummary.attentionSupplierCount > 0
                  ? t(
                      visibleSummary.attentionSupplierCount === 1
                        ? "dailyReport.supplierReliability.attention.one"
                        : "dailyReport.supplierReliability.attention.other",
                      {
                        count: formatNumber(visibleSummary.attentionSupplierCount)
                      }
                    )
                  : visibleSummary.supplierCount === 0
                    ? t("dailyReport.supplierReliability.empty")
                    : t("dailyReport.supplierReliability.clear")}
              </Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={t("dailyReport.supplierReliability.metric.deliveries", {
                    count: formatNumber(visibleSummary.totalDeliveries)
                  })}
                  tone="neutral"
                />
                {visibleSummary.overallOnTimeRate != null ? (
                  <Badge
                    label={t("dailyReport.supplierReliability.metric.onTime", {
                      percent: formatNumber(visibleSummary.overallOnTimeRate * 100, {
                        maximumFractionDigits: 0
                      })
                    })}
                    tone={visibleSummary.overallOnTimeRate >= 0.9 ? "success" : "warning"}
                  />
                ) : null}
                {visibleSummary.overallMatchedDeliveryRate != null ? (
                  <Badge
                    label={t("dailyReport.supplierReliability.metric.matched", {
                      percent: formatNumber(visibleSummary.overallMatchedDeliveryRate * 100, {
                        maximumFractionDigits: 0
                      })
                    })}
                    tone={
                      visibleSummary.overallMatchedDeliveryRate >= 0.9 ? "success" : "warning"
                    }
                  />
                ) : null}
              </View>
              <Button
                title={t("supplierStatus.action.openOrders")}
                variant="secondary"
                size="compact"
                onPress={() => router.push("/orders")}
                style={styles.inlineAction}
              />
            </Card>

            {sections.length === 0 ? (
              <EmptyState
                title={t("supplierStatus.empty.title")}
                body={t("supplierStatus.empty.body")}
              />
            ) : (
              sections.map((section) => (
                <View key={section.id} style={styles.sectionBlock}>
                  <SectionHeader
                    title={t(`supplierStatus.section.${section.id}` as MessageKey)}
                  />
                  <View style={styles.supplierList}>
                    {section.suppliers.map((supplier) => (
                      <SupplierStatusCard
                        key={supplier.supplierId}
                        supplier={supplier}
                        formatDate={formatDate}
                        formatNumber={formatNumber}
                        t={t}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function SupplierStatusCard({
  supplier,
  formatDate,
  formatNumber,
  t
}: {
  supplier: SupplierReliabilityEntry;
  formatDate: ReturnType<typeof useLocale>["formatDate"];
  formatNumber: ReturnType<typeof useLocale>["formatNumber"];
  t: ReturnType<typeof useLocale>["t"];
}) {
  const followUpOrderId = primarySupplierFollowUpOrderId(supplier);
  return (
    <Card>
      <View style={styles.supplierHeader}>
        <View style={styles.supplierCopy}>
          <Text style={styles.supplierName}>{supplier.supplierName}</Text>
          <Text style={styles.supplierMeta}>
            {t("supplierStatus.lastDelivery", {
              date: formatDate(supplier.lastDeliveryAt, {
                month: "short",
                day: "numeric"
              })
            })}
          </Text>
        </View>
        <Badge
          label={t(reliabilityStatusKey(supplier.status))}
          tone={supplierStatusTone(supplier.status) as BadgeTone}
        />
      </View>
      <Text style={styles.rowLine}>
        {t("dailyReport.supplierReliability.row", {
          deliveries: formatNumber(supplier.deliveryCount),
          onTime:
            supplier.onTimeRate == null
              ? t("common.notSet")
              : `${formatNumber(supplier.onTimeRate * 100, { maximumFractionDigits: 0 })}%`,
          matched: `${formatNumber(supplier.matchedDeliveryRate * 100, {
            maximumFractionDigits: 0
          })}%`
        })}
      </Text>
      {supplier.fulfillmentRate != null ? (
        <Text style={styles.rowLine}>
          {t("supplierStatus.fulfillment", {
            percent: formatNumber(supplier.fulfillmentRate * 100, { maximumFractionDigits: 0 })
          })}
        </Text>
      ) : null}
      <View style={styles.reasonList}>
        {supplier.reasons.map((reason) => (
          <Text key={reason} style={styles.reasonLine}>
            {t(reliabilityReasonKey(reason))}
          </Text>
        ))}
      </View>
      {followUpOrderId ? (
        <Button
          title={t("dailyReport.supplierReliability.reviewOrder")}
          variant="secondary"
          size="compact"
          icon={<ArrowRight size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
          onPress={() => router.push(`/orders/${followUpOrderId}` as never)}
          style={styles.inlineAction}
        />
      ) : null}
    </Card>
  );
}

function reliabilityStatusKey(status: SupplierReliabilityStatus): MessageKey {
  return `dailyReport.supplierReliability.status.${status}` as MessageKey;
}

function reliabilityReasonKey(reason: SupplierReliabilityReason): MessageKey {
  return `dailyReport.supplierReliability.reason.${reason}` as MessageKey;
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  summaryBody: {
    color: colors.text,
    ...conceptTypography.body,
    marginBottom: 10
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  inlineAction: {
    marginTop: 12,
    alignSelf: "flex-start"
  },
  sectionBlock: {
    gap: 10
  },
  supplierList: {
    gap: 10
  },
  supplierHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  supplierCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  supplierName: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  supplierMeta: {
    color: colors.muted,
    ...typography.caption
  },
  rowLine: {
    color: colors.text,
    ...conceptTypography.body,
    marginTop: 8
  },
  reasonList: {
    marginTop: 8,
    gap: 4
  },
  reasonLine: {
    color: colors.muted,
    ...typography.caption
  }
});

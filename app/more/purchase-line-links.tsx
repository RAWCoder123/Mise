import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { PurchaseLineLinkCandidate } from "../../services/domain/purchaseLineItemLinks";
import {
  applyPurchaseLineLinkedUnitCost,
  fetchInventoryItems,
  fetchPurchaseLineLinkCandidates,
  fetchSuppliers,
  linkPurchaseLineItem,
  revokePurchaseLineItemLink,
  suggestInventoryMatchesForPurchaseLineKey
} from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import type { InventoryItem, Supplier } from "../../types/mise";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function PurchaseLineLinksScreen() {
  const { formatCompactCurrency, formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const [candidates, setCandidates] = useState<PurchaseLineLinkCandidate[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setCandidates([]);
    setInventoryItems([]);
    setSuppliers([]);
    setLoadedRestaurantId(null);
    setError(false);
    setNotice(null);
    setActionError(null);
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
      const [nextCandidates, nextItems, nextSuppliers] = await Promise.all([
        fetchPurchaseLineLinkCandidates(restaurantId),
        fetchInventoryItems(restaurantId),
        fetchSuppliers(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setCandidates(nextCandidates);
      setInventoryItems(nextItems);
      setSuppliers(nextSuppliers);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "purchase_line_item_links",
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

  const inventoryById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of inventoryItems) map.set(item.id, item);
    return map;
  }, [inventoryItems]);

  const supplierNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const supplier of suppliers) map.set(supplier.id, supplier.display_name);
    return map;
  }, [suppliers]);

  const visibleCandidates = loadedRestaurantId === restaurant?.id ? candidates : [];
  const unlinked = visibleCandidates.filter((candidate) => !candidate.linkId);
  const linked = visibleCandidates.filter((candidate) => candidate.linkId);

  async function runAction(
    key: string,
    action: () => Promise<void>,
    successNotice: string,
    failureKey:
      | "purchaseLineLinks.error.link"
      | "purchaseLineLinks.error.revoke"
      | "purchaseLineLinks.error.applyCost"
  ) {
    if (!restaurant || !canManage) return;
    setBusyKey(key);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successNotice);
      await load();
    } catch (actionFailure) {
      captureMiseError(actionFailure, {
        flow: "purchase_line_item_links",
        operation: key,
        restaurant_id: restaurant.id
      });
      setActionError(t(failureKey));
    } finally {
      setBusyKey(null);
    }
  }

  function renderCandidate(candidate: PurchaseLineLinkCandidate) {
    const rowKey = `${candidate.supplierId ?? "none"}:${candidate.normalizedItemKey}`;
    const suggestions = suggestInventoryMatchesForPurchaseLineKey(
      candidate.normalizedItemKey,
      inventoryItems
    );
    const linkedItem = candidate.linkedInventoryItemId
      ? inventoryById.get(candidate.linkedInventoryItemId) ?? null
      : null;
    const supplierLabel = candidate.supplierId
      ? supplierNameById.get(candidate.supplierId) ?? candidate.supplierId
      : t("purchaseLineLinks.meta.supplierUnknown");
    const exactMatch = suggestions[0] ?? null;
    const busy =
      busyKey === rowKey || busyKey === `${rowKey}:cost` || busyKey === `${rowKey}:revoke`;

    return (
      <Card key={rowKey} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemKey}>{candidate.normalizedItemKey}</Text>
          <Badge
            label={
              candidate.linkId
                ? t("purchaseLineLinks.section.linked")
                : t("purchaseLineLinks.section.unlinked")
            }
            tone={candidate.linkId ? "success" : "warning"}
          />
        </View>
        <Text style={styles.description}>{candidate.sampleRawDescription}</Text>
        <Text style={styles.meta}>
          {supplierLabel}
          {" · "}
          {t("purchaseLineLinks.meta.lines", { count: formatNumber(candidate.lineCount) })}
        </Text>
        {linkedItem ? (
          <Text style={styles.meta}>
            {t("purchaseLineLinks.meta.linkedTo", { item: linkedItem.item_name })}
          </Text>
        ) : exactMatch ? (
          <Text style={styles.meta}>
            {t("purchaseLineLinks.meta.exactMatch", { item: exactMatch.item_name })}
          </Text>
        ) : (
          <Text style={styles.meta}>{t("purchaseLineLinks.meta.noExactMatch")}</Text>
        )}
        {candidate.latestConfirmedUnitPrice !== null ? (
          <Text style={styles.meta}>
            {formatCompactCurrency(
              candidate.latestConfirmedUnitPrice,
              candidate.latestConfirmedCurrency ?? restaurant?.currency
            )}
          </Text>
        ) : null}

        {canManage ? (
          <View style={styles.actions}>
            {!candidate.linkId && exactMatch ? (
              <Button
                title={
                  busyKey === rowKey
                    ? t("purchaseLineLinks.action.linking")
                    : t("purchaseLineLinks.action.link")
                }
                onPress={() =>
                  void runAction(
                    rowKey,
                    async () => {
                      await linkPurchaseLineItem({
                        restaurantId: restaurant!.id,
                        normalizedItemKey: candidate.normalizedItemKey,
                        inventoryItemId: exactMatch.id,
                        supplierId: candidate.supplierId
                      });
                    },
                    t("purchaseLineLinks.notice.linked"),
                    "purchaseLineLinks.error.link"
                  )
                }
                disabled={busy}
              />
            ) : null}
            {candidate.linkId ? (
              <>
                {candidate.latestConfirmedUnitPrice !== null ? (
                  <Button
                    title={
                      busyKey === `${rowKey}:cost`
                        ? t("purchaseLineLinks.action.applying")
                        : t("purchaseLineLinks.action.applyCost")
                    }
                    onPress={() =>
                      void runAction(
                        `${rowKey}:cost`,
                        async () => {
                          await applyPurchaseLineLinkedUnitCost(restaurant!.id, candidate.linkId!);
                        },
                        t("purchaseLineLinks.notice.costApplied"),
                        "purchaseLineLinks.error.applyCost"
                      )
                    }
                    disabled={busy}
                  />
                ) : null}
                <Button
                  title={t("purchaseLineLinks.action.revoke")}
                  variant="secondary"
                  onPress={() =>
                    void runAction(
                      `${rowKey}:revoke`,
                      async () => {
                        await revokePurchaseLineItemLink(restaurant!.id, candidate.linkId!);
                      },
                      t("purchaseLineLinks.notice.revoked"),
                      "purchaseLineLinks.error.revoke"
                    )
                  }
                  disabled={busy}
                />
              </>
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  }

  if (!restaurant) {
    return (
      <Screen title={t("purchaseLineLinks.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState
          title={t("tasks.noRestaurant.title")}
          body={t("purchaseLineLinks.noRestaurant.body")}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t("purchaseLineLinks.title")} titleAlign="center" leadingAction={<BackAction />}>
      <View style={styles.stack}>
        <Text style={styles.subtitle}>{t("purchaseLineLinks.subtitle")}</Text>
        {!canManage ? (
          <StatusNotice
            title={t("purchaseLineLinks.notice.staffReadonly")}
            tone="neutral"
          />
        ) : null}
        {notice ? <StatusNotice title={notice} tone="success" /> : null}
        {actionError ? <StatusNotice title={actionError} tone="danger" /> : null}
        {error ? (
          <RetryNotice
            title={t("common.error")}
            message={t("common.retry")}
            retryLabel={t("common.retry")}
            onRetry={() => void load()}
          />
        ) : null}

        {loading && visibleCandidates.length === 0 ? (
          <Text style={styles.meta}>{t("common.loading")}</Text>
        ) : null}

        {!loading && !error && visibleCandidates.length === 0 ? (
          <EmptyState
            title={t("purchaseLineLinks.empty.title")}
            body={t("purchaseLineLinks.empty.body")}
          />
        ) : null}

        {unlinked.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t("purchaseLineLinks.section.unlinked")} />
            {unlinked.map(renderCandidate)}
          </View>
        ) : null}

        {linked.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t("purchaseLineLinks.section.linked")} />
            {linked.map(renderCandidate)}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
    paddingBottom: 28
  },
  subtitle: {
    ...conceptTypography.body,
    color: colors.muted
  },
  section: {
    gap: 10
  },
  card: {
    gap: 8
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  itemKey: {
    ...conceptTypography.rowTitle,
    color: colors.text,
    flex: 1
  },
  description: {
    ...conceptTypography.body,
    color: colors.text
  },
  meta: {
    ...conceptTypography.caption,
    color: colors.muted
  },
  actions: {
    gap: 8,
    marginTop: 4
  }
});

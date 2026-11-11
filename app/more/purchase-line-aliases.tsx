import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import type { PurchaseLineAliasCandidate } from "../../services/domain/purchaseLineItemKeyAliases";
import {
  aliasPurchaseLineItemKey,
  fetchPurchaseLineAliasCandidates,
  fetchSuppliers,
  revokePurchaseLineItemKeyAlias
} from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";
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

export default function PurchaseLineAliasesScreen() {
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const [candidates, setCandidates] = useState<PurchaseLineAliasCandidate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
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
    setSuppliers([]);
    setSelectedTargets({});
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
      const [nextCandidates, nextSuppliers] = await Promise.all([
        fetchPurchaseLineAliasCandidates(restaurantId),
        fetchSuppliers(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setCandidates(nextCandidates);
      setSuppliers(nextSuppliers);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "purchase_line_aliases",
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

  const supplierNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const supplier of suppliers) {
      map.set(supplier.id, supplier.display_name);
    }
    return map;
  }, [suppliers]);

  const visibleCandidates = loadedRestaurantId === restaurant?.id ? candidates : [];
  const unaliased = visibleCandidates.filter((candidate) => !candidate.aliasId);
  const aliased = visibleCandidates.filter((candidate) => candidate.aliasId);

  async function runAction(
    rowKey: string,
    action: () => Promise<void>,
    successNotice: string,
    errorKey: MessageKey
  ) {
    setBusyKey(rowKey);
    setNotice(null);
    setActionError(null);
    try {
      await action();
      setNotice(successNotice);
      await load();
    } catch (actionFailure) {
      captureMiseError(actionFailure, {
        flow: "purchase_line_aliases",
        operation: rowKey,
        restaurant_id: restaurant?.id
      });
      setActionError(t(errorKey));
    } finally {
      setBusyKey(null);
    }
  }

  function candidateRowKey(candidate: PurchaseLineAliasCandidate) {
    return `${candidate.supplierId ?? "none"}:${candidate.aliasItemKey}`;
  }

  function renderCandidate(candidate: PurchaseLineAliasCandidate) {
    const rowKey = candidateRowKey(candidate);
    const busy = busyKey !== null;
    const supplierLabel = candidate.supplierId
      ? supplierNames.get(candidate.supplierId) ?? t("purchaseLineAliases.meta.supplierUnknown")
      : t("purchaseLineAliases.meta.supplierUnknown");
    const selectedTarget =
      selectedTargets[rowKey] ??
      candidate.canonicalItemKey ??
      candidate.canonicalTargets[0] ??
      null;

    return (
      <Card key={rowKey} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemKey}>{candidate.aliasItemKey}</Text>
          <Badge
            label={
              candidate.aliasId
                ? t("purchaseLineAliases.section.aliased")
                : t("purchaseLineAliases.section.unaliased")
            }
            tone={candidate.aliasId ? "success" : "warning"}
          />
        </View>
        <Text style={styles.description}>{candidate.sampleRawDescription}</Text>
        <Text style={styles.meta}>
          {supplierLabel}
          {" · "}
          {t("purchaseLineAliases.meta.credits", {
            count: formatNumber(candidate.creditLineCount)
          })}
        </Text>
        {candidate.canonicalItemKey ? (
          <Text style={styles.meta}>
            {t("purchaseLineAliases.meta.aliasedTo", { key: candidate.canonicalItemKey })}
          </Text>
        ) : null}

        {canManage && !candidate.aliasId ? (
          <View style={styles.targets}>
            <Text style={styles.meta}>{t("purchaseLineAliases.meta.pickCanonical")}</Text>
            {candidate.canonicalTargets.length === 0 ? (
              <Text style={styles.meta}>{t("purchaseLineAliases.meta.noTargets")}</Text>
            ) : (
              candidate.canonicalTargets.map((target) => {
                const selected = selectedTarget === target;
                return (
                  <Pressable
                    key={target}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setSelectedTargets((current) => ({ ...current, [rowKey]: target }))
                    }
                    style={[styles.targetChip, selected ? styles.targetChipSelected : null]}
                  >
                    <Text style={[styles.targetText, selected ? styles.targetTextSelected : null]}>
                      {target}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        {canManage ? (
          <View style={styles.actions}>
            {!candidate.aliasId && selectedTarget ? (
              <Button
                title={
                  busyKey === rowKey
                    ? t("purchaseLineAliases.action.aliasing")
                    : t("purchaseLineAliases.action.alias")
                }
                onPress={() =>
                  void runAction(
                    rowKey,
                    async () => {
                      await aliasPurchaseLineItemKey({
                        restaurantId: restaurant!.id,
                        aliasItemKey: candidate.aliasItemKey,
                        canonicalItemKey: selectedTarget,
                        supplierId: candidate.supplierId
                      });
                    },
                    t("purchaseLineAliases.notice.aliased"),
                    "purchaseLineAliases.error.alias"
                  )
                }
                disabled={busy || candidate.canonicalTargets.length === 0}
              />
            ) : null}
            {candidate.aliasId ? (
              <Button
                title={t("purchaseLineAliases.action.revoke")}
                variant="secondary"
                onPress={() =>
                  void runAction(
                    `${rowKey}:revoke`,
                    async () => {
                      await revokePurchaseLineItemKeyAlias(restaurant!.id, candidate.aliasId!);
                    },
                    t("purchaseLineAliases.notice.revoked"),
                    "purchaseLineAliases.error.revoke"
                  )
                }
                disabled={busy}
              />
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  }

  if (!restaurant) {
    return (
      <Screen title={t("purchaseLineAliases.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState
          title={t("tasks.noRestaurant.title")}
          body={t("purchaseLineAliases.noRestaurant.body")}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t("purchaseLineAliases.title")} titleAlign="center" leadingAction={<BackAction />}>
      <View style={styles.stack}>
        <Text style={styles.subtitle}>{t("purchaseLineAliases.subtitle")}</Text>
        {!canManage ? (
          <StatusNotice title={t("purchaseLineAliases.notice.staffReadonly")} tone="neutral" />
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
            title={t("purchaseLineAliases.empty.title")}
            body={t("purchaseLineAliases.empty.body")}
          />
        ) : null}

        {unaliased.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t("purchaseLineAliases.section.unaliased")} />
            {unaliased.map(renderCandidate)}
          </View>
        ) : null}

        {aliased.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t("purchaseLineAliases.section.aliased")} />
            {aliased.map(renderCandidate)}
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
  targets: {
    gap: 8,
    marginTop: 4
  },
  targetChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  targetChipSelected: {
    borderColor: colors.text,
    backgroundColor: colors.panel
  },
  targetText: {
    ...conceptTypography.caption,
    color: colors.muted
  },
  targetTextSelected: {
    color: colors.text
  },
  actions: {
    gap: 8,
    marginTop: 4
  }
});

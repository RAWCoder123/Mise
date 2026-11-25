import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Link2 } from "lucide-react-native";
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
import type { PurchaseLineCreditAttachmentCandidate } from "../../services/domain/purchaseLineCreditAttachments";
import type { PurchaseLine } from "../../services/domain/purchaseLines";
import {
  attachPurchaseLineCredit,
  fetchPurchaseLineCreditAttachmentCandidates,
  fetchPurchaseLineHistory,
  revokePurchaseLineCreditAttachment,
  suggestPurchaseMatchesForCredit
} from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function PurchaseLineCreditAttachmentsScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const [candidates, setCandidates] = useState<PurchaseLineCreditAttachmentCandidate[]>([]);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
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
    setLines([]);
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
      const [nextCandidates, nextHistory] = await Promise.all([
        fetchPurchaseLineCreditAttachmentCandidates(restaurantId),
        fetchPurchaseLineHistory(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setCandidates(nextCandidates);
      setLines(nextHistory);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "purchase_line_credit_attachments",
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

  const lineById = useMemo(() => {
    const map = new Map<string, PurchaseLine>();
    for (const line of lines) map.set(line.id, line);
    return map;
  }, [lines]);

  const needsAttachment = candidates.filter((candidate) => candidate.needsManagerAttachment);
  const resolved = candidates.filter((candidate) => !candidate.needsManagerAttachment);
  const ready = Boolean(restaurant) && loadedRestaurantId === restaurant?.id && !loading && !error;

  async function runAction(
    key: string,
    action: () => Promise<void>,
    successNotice: string,
    errorKey: "purchaseLineCreditAttachments.error.attach" | "purchaseLineCreditAttachments.error.revoke"
  ) {
    if (!restaurant || !canManage) return;
    setBusyKey(key);
    setNotice(null);
    setActionError(null);
    try {
      await action();
      setNotice(successNotice);
      await load();
    } catch (actionFailure) {
      captureMiseError(actionFailure, {
        flow: "purchase_line_credit_attachments",
        operation: key,
        restaurant_id: restaurant.id
      });
      setActionError(t(errorKey));
    } finally {
      setBusyKey(null);
    }
  }

  if (!restaurant) {
    return (
      <Screen
        title={t("purchaseLineCreditAttachments.title")}
        titleAlign="center"
        leadingAction={<BackAction />}
      >
        <EmptyState
          title={t("tasks.noRestaurant.title")}
          body={t("purchaseLineCreditAttachments.noRestaurant.body")}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("purchaseLineCreditAttachments.title")}
      titleAlign="center"
      leadingAction={<BackAction />}
    >
      <View style={styles.stack}>
        <Text style={styles.subtitle}>{t("purchaseLineCreditAttachments.subtitle")}</Text>
        {!canManage ? (
          <StatusNotice
            title={t("purchaseLineCreditAttachments.notice.staffReadonly")}
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

        {loading && candidates.length === 0 ? (
          <Text style={styles.meta}>{t("common.loading")}</Text>
        ) : null}

        {ready && candidates.length === 0 ? (
          <EmptyState
            illustration={
              <Link2 size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
            }
            title={t("purchaseLineCreditAttachments.empty.title")}
            body={t("purchaseLineCreditAttachments.empty.body")}
          />
        ) : null}

        {ready && needsAttachment.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t("purchaseLineCreditAttachments.section.unlinked")} />
            {needsAttachment.map((candidate) => {
              const suggestions =
                candidate.exactKeyPurchaseMatches.length > 0
                  ? candidate.exactKeyPurchaseMatches
                  : suggestPurchaseMatchesForCredit(candidate.credit, lines).slice(0, 4);
              return (
                <Card key={candidate.credit.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{candidate.credit.rawItemDescription}</Text>
                  <Text style={styles.meta}>
                    {t("purchaseLineCreditAttachments.meta.creditDoc", {
                      document: candidate.credit.sourceDocumentReference,
                      date: formatDate(candidate.credit.transactionDate)
                    })}
                  </Text>
                  {candidate.credit.quantity !== null ? (
                    <Text style={styles.meta}>
                      {t("purchaseLineCreditAttachments.meta.quantity", {
                        quantity: formatNumber(candidate.credit.quantity),
                        unit: candidate.credit.unitOfMeasure ?? ""
                      })}
                    </Text>
                  ) : null}
                  {suggestions.length === 0 ? (
                    <Text style={styles.meta}>
                      {t("purchaseLineCreditAttachments.meta.noSameSupplierPurchase")}
                    </Text>
                  ) : (
                    suggestions.map((purchase) => {
                      const actionKey = `${candidate.credit.id}:${purchase.id}`;
                      const exact =
                        candidate.credit.normalizedItemKey !== null &&
                        purchase.normalizedItemKey === candidate.credit.normalizedItemKey;
                      const busy = busyKey === actionKey;
                      return (
                        <View key={purchase.id} style={styles.suggestionRow}>
                          <View style={styles.suggestionCopy}>
                            <Text style={styles.suggestionTitle}>{purchase.rawItemDescription}</Text>
                            <Text style={styles.meta}>
                              {t("purchaseLineCreditAttachments.meta.purchaseDoc", {
                                document: purchase.sourceDocumentReference,
                                date: formatDate(purchase.transactionDate)
                              })}
                            </Text>
                            {exact ? (
                              <Badge
                                label={t("purchaseLineCreditAttachments.badge.exactKey")}
                                tone="success"
                              />
                            ) : null}
                          </View>
                          {canManage ? (
                            <Button
                              title={
                                busy
                                  ? t("purchaseLineCreditAttachments.action.attaching")
                                  : t("purchaseLineCreditAttachments.action.attach")
                              }
                              size="compact"
                              disabled={busyKey !== null}
                              onPress={() =>
                                void runAction(
                                  actionKey,
                                  async () => {
                                    await attachPurchaseLineCredit({
                                      restaurantId: restaurant.id,
                                      creditLineId: candidate.credit.id,
                                      purchaseLineId: purchase.id
                                    });
                                  },
                                  t("purchaseLineCreditAttachments.notice.attached"),
                                  "purchaseLineCreditAttachments.error.attach"
                                )
                              }
                            />
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </Card>
              );
            })}
          </View>
        ) : null}

        {ready && resolved.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t("purchaseLineCreditAttachments.section.linked")} />
            {resolved.map((candidate) => {
              const attached = candidate.attachedPurchaseLineId
                ? lineById.get(candidate.attachedPurchaseLineId)
                : null;
              const revokeKey = candidate.attachmentId ?? candidate.credit.id;
              return (
                <Card key={candidate.credit.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{candidate.credit.rawItemDescription}</Text>
                  <Text style={styles.meta}>
                    {candidate.documentCreditsLineId
                      ? t("purchaseLineCreditAttachments.meta.documentLinked")
                      : t("purchaseLineCreditAttachments.meta.managerLinked")}
                  </Text>
                  {attached ? (
                    <Text style={styles.meta}>
                      {t("purchaseLineCreditAttachments.meta.linkedTo", {
                        item: attached.rawItemDescription
                      })}
                    </Text>
                  ) : null}
                  {canManage && candidate.attachmentId ? (
                    <Button
                      title={
                        busyKey === revokeKey
                          ? t("purchaseLineCreditAttachments.action.revoking")
                          : t("purchaseLineCreditAttachments.action.revoke")
                      }
                      variant="secondary"
                      size="compact"
                      disabled={busyKey !== null}
                      onPress={() =>
                        void runAction(
                          revokeKey,
                          async () => {
                            await revokePurchaseLineCreditAttachment(
                              restaurant.id,
                              candidate.attachmentId!
                            );
                          },
                          t("purchaseLineCreditAttachments.notice.revoked"),
                          "purchaseLineCreditAttachments.error.revoke"
                        )
                      }
                    />
                  ) : null}
                </Card>
              );
            })}
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
  cardTitle: {
    ...conceptTypography.cardTitle,
    color: colors.text
  },
  meta: {
    ...conceptTypography.subtitle,
    color: colors.muted
  },
  suggestionRow: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  suggestionCopy: {
    gap: 4
  },
  suggestionTitle: {
    ...conceptTypography.body,
    color: colors.text
  }
});

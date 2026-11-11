import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, FilePenLine } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import type { PurchaseLineConfidence } from "../../services/domain/purchaseLines";
import {
  correctPurchaseLine,
  fetchPurchaseLineHistory
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import {
  buildPurchaseLineCorrectionFromDraft,
  createPurchaseLineCorrectionDraft,
  listCorrectablePurchaseLines,
  type CurrentPurchaseLine,
  type PurchaseLineCorrectionBuildError,
  type PurchaseLineCorrectionDraft
} from "../../services/presentation/purchaseLineCorrection";
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

const BUILD_ERROR_KEYS: Record<PurchaseLineCorrectionBuildError, MessageKey> = {
  missing_line: "purchaseLineCorrection.error.missingLine",
  missing_description: "purchaseLineCorrection.error.missingDescription",
  missing_transaction_date: "purchaseLineCorrection.error.missingTransactionDate",
  invalid_transaction_date: "purchaseLineCorrection.error.invalidTransactionDate",
  invalid_received_date: "purchaseLineCorrection.error.invalidReceivedDate",
  received_before_transaction: "purchaseLineCorrection.error.receivedBeforeTransaction",
  invalid_currency: "purchaseLineCorrection.error.invalidCurrency",
  invalid_quantity: "purchaseLineCorrection.error.invalidQuantity",
  invalid_unit_price: "purchaseLineCorrection.error.invalidUnitPrice",
  invalid_extended_price: "purchaseLineCorrection.error.invalidExtendedPrice",
  priced_without_currency: "purchaseLineCorrection.error.pricedWithoutCurrency",
  credits_line_on_purchase: "purchaseLineCorrection.error.creditsOnPurchase",
  unchanged: "purchaseLineCorrection.error.unchanged"
};

function lineTypeLabel(lineType: CurrentPurchaseLine["lineType"], t: (key: MessageKey) => string) {
  return lineType === "credit"
    ? t("purchaseLineCorrection.lineType.credit")
    : t("purchaseLineCorrection.lineType.purchase");
}

function confidenceLabel(
  confidence: CurrentPurchaseLine["parseConfidence"],
  t: (key: MessageKey) => string
) {
  if (confidence === "confirmed") return t("purchaseLineCorrection.confidence.confirmed");
  if (confidence === "estimated") return t("purchaseLineCorrection.confidence.estimated");
  return t("purchaseLineCorrection.confidence.couldNotVerify");
}

export default function PurchaseLineCorrectionScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id);

  const [history, setHistory] = useState<CurrentPurchaseLine[]>([]);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PurchaseLineCorrectionDraft | null>(null);

  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setHistory([]);
    setLoadedRestaurantId(null);
    setError(false);
    setLoading(Boolean(restaurant));
    setSelectedLineId(null);
    setDraft(null);
    setNotice(null);
    setNoticeIsError(false);
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
      const nextHistory = (await fetchPurchaseLineHistory(restaurantId)) as CurrentPurchaseLine[];
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setHistory(nextHistory);
      setLoadedRestaurantId(restaurantId);
      setSelectedLineId((current) => {
        if (!current) return null;
        const stillCurrent = nextHistory.some((line) => line.id === current && line.current);
        if (!stillCurrent) {
          setDraft(null);
          return null;
        }
        return current;
      });
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "purchase_line_correction",
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

  const hubState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id ?? null,
    loadedRestaurantId,
    loadError: error
  });
  const hubReady = hubState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: submitting
  });
  const visibleHistory = hubReady ? history : [];
  const correctableLines = listCorrectablePurchaseLines(visibleHistory);
  const selectedLine =
    selectedLineId === null
      ? null
      : correctableLines.find((line) => line.id === selectedLineId) ?? null;

  const confidenceOptions = useMemo<readonly SegmentOption<PurchaseLineConfidence>[]>(
    () => [
      {
        value: "confirmed",
        label: t("purchaseLineCorrection.confidence.confirmed"),
        tone: "brand",
        disabled: !actionsEditable
      },
      {
        value: "estimated",
        label: t("purchaseLineCorrection.confidence.estimated"),
        tone: "neutral",
        disabled: !actionsEditable
      }
    ],
    [t, actionsEditable]
  );

  function selectLine(line: CurrentPurchaseLine) {
    setSelectedLineId(line.id);
    setDraft(createPurchaseLineCorrectionDraft(line));
    setNotice(null);
    setNoticeIsError(false);
  }

  function updateDraft(patch: Partial<PurchaseLineCorrectionDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function submit() {
    if (!restaurant || !actionsEditable || !selectedLine || !draft) return;
    setNotice(null);
    setNoticeIsError(false);

    const built = buildPurchaseLineCorrectionFromDraft({
      line: selectedLine,
      draft
    });
    if (!built.ok) {
      setNotice(t(BUILD_ERROR_KEYS[built.error]));
      setNoticeIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setSubmitting(true);
    try {
      const correction = await correctPurchaseLine(
        restaurantId,
        built.lineId,
        built.correction
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(
        t("purchaseLineCorrection.notice.corrected", {
          document: correction.sourceDocumentReference,
          index: formatNumber(correction.lineIndex + 1)
        })
      );
      setNoticeIsError(false);
      setSelectedLineId(null);
      setDraft(null);
      await load();
    } catch (submitError) {
      captureMiseError(submitError, {
        flow: "purchase_line_correction",
        operation: "supersede",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const message =
        submitError instanceof Error &&
        /already been corrected/i.test(submitError.message)
          ? t("purchaseLineCorrection.error.alreadyCorrected")
          : t("purchaseLineCorrection.error.submit");
      setNotice(message);
      setNoticeIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) {
        setSubmitting(false);
      }
    }
  }

  return (
    <Screen
      title={t("purchaseLineCorrection.title")}
      subtitle={
        restaurant
          ? t("purchaseLineCorrection.subtitle", { restaurant: restaurant.name })
          : t("purchaseLineCorrection.noRestaurant.body")
      }
      titleAlign="center"
      leadingAction={<BackAction />}
      keyboardAware
    >
      {!restaurant ? (
        <EmptyState
          title={t("purchaseLineCorrection.noRestaurant.title")}
          body={t("purchaseLineCorrection.noRestaurant.body")}
        />
      ) : loading && !hubReady && !error ? (
        <StatusNotice
          tone="neutral"
          title={t("common.loading")}
          message={t("purchaseLineCorrection.loading")}
        />
      ) : error ? (
        <RetryNotice
          title={t("purchaseLineCorrection.retry.title")}
          message={t("purchaseLineCorrection.retry.body")}
          retryLabel={t("common.retry")}
          accessibilityLabel={t("purchaseLineCorrection.retry.accessibility")}
          onRetry={() => void load()}
        />
      ) : (
        <View style={styles.stack}>
          <StatusNotice
            tone="neutral"
            title={t("purchaseLineCorrection.intro.title")}
            message={t("purchaseLineCorrection.intro.body")}
          />

          {!canManage ? (
            <StatusNotice
              tone="warning"
              title={t("purchaseLineCorrection.staff.title")}
              message={t("purchaseLineCorrection.staff.body")}
            />
          ) : null}

          {notice ? (
            <StatusNotice
              tone={noticeIsError ? "danger" : "success"}
              title={
                noticeIsError
                  ? t("common.error")
                  : t("purchaseLineCorrection.notice.title")
              }
              message={notice}
            />
          ) : null}

          <SectionHeader title={t("purchaseLineCorrection.section.current")} />
          {correctableLines.length === 0 ? (
            <EmptyState
              title={t("purchaseLineCorrection.empty.title")}
              body={t("purchaseLineCorrection.empty.body")}
            />
          ) : (
            correctableLines.map((line) => {
              const selected = line.id === selectedLineId;
              return (
                <Pressable
                  key={line.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t("purchaseLineCorrection.line.select", {
                    item: line.normalizedItemKey ?? line.rawItemDescription,
                    document: line.sourceDocumentReference
                  })}
                  onPress={() => {
                    if (!hubReady) return;
                    selectLine(line);
                  }}
                  style={({ pressed }) => [
                    styles.lineRow,
                    selected && styles.lineSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={styles.lineCopy}>
                    <Text style={styles.lineTitle}>
                      {line.normalizedItemKey ?? line.rawItemDescription}
                    </Text>
                    <Text style={styles.lineMeta}>
                      {t("purchaseLineCorrection.line.meta", {
                        type: lineTypeLabel(line.lineType, t),
                        document: line.sourceDocumentReference,
                        date: formatDate(line.transactionDate),
                        index: formatNumber(line.lineIndex + 1),
                        confidence: confidenceLabel(line.parseConfidence, t)
                      })}
                    </Text>
                  </View>
                  {selected ? <Badge label={t("common.selected")} tone="success" /> : null}
                </Pressable>
              );
            })
          )}

          {selectedLine && draft ? (
            <>
              <SectionHeader title={t("purchaseLineCorrection.section.edit")} />
              <StatusNotice
                tone="neutral"
                title={t("purchaseLineCorrection.lock.title")}
                message={t("purchaseLineCorrection.lock.body", {
                  document: selectedLine.sourceDocumentReference,
                  type: lineTypeLabel(selectedLine.lineType, t),
                  index: formatNumber(selectedLine.lineIndex + 1)
                })}
              />

              <Text style={styles.label}>{t("purchaseLineCorrection.field.description")}</Text>
              <TextInput
                accessibilityLabel={t("purchaseLineCorrection.field.description")}
                placeholder={t("purchaseLineCorrection.field.descriptionPlaceholder")}
                placeholderTextColor={colors.faint}
                value={draft.rawItemDescription}
                onChangeText={(value) => updateDraft({ rawItemDescription: value })}
                editable={actionsEditable}
                style={styles.input}
              />

              <Text style={styles.label}>{t("purchaseLineCorrection.field.transactionDate")}</Text>
              <TextInput
                accessibilityLabel={t("purchaseLineCorrection.field.transactionDate")}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.faint}
                value={draft.transactionDate}
                onChangeText={(value) => updateDraft({ transactionDate: value })}
                autoCapitalize="none"
                autoCorrect={false}
                editable={actionsEditable}
                style={styles.input}
              />

              <Text style={styles.label}>{t("purchaseLineCorrection.field.receivedDate")}</Text>
              <TextInput
                accessibilityLabel={t("purchaseLineCorrection.field.receivedDate")}
                placeholder={t("purchaseLineCorrection.field.receivedDatePlaceholder")}
                placeholderTextColor={colors.faint}
                value={draft.receivedDate}
                onChangeText={(value) => updateDraft({ receivedDate: value })}
                autoCapitalize="none"
                autoCorrect={false}
                editable={actionsEditable}
                style={styles.input}
              />

              <Text style={styles.label}>{t("purchaseLineCorrection.field.currency")}</Text>
              <TextInput
                accessibilityLabel={t("purchaseLineCorrection.field.currency")}
                placeholder="USD"
                placeholderTextColor={colors.faint}
                value={draft.currency}
                onChangeText={(value) => updateDraft({ currency: value.toUpperCase() })}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={3}
                editable={actionsEditable}
                style={styles.input}
              />

              <Text style={styles.label}>{t("purchaseLineCorrection.field.confidence")}</Text>
              <SegmentedControl
                accessibilityLabel={t("purchaseLineCorrection.field.confidence")}
                value={draft.parseConfidence}
                options={confidenceOptions}
                onValueChange={(value) => updateDraft({ parseConfidence: value })}
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>{t("purchaseLineCorrection.field.quantity")}</Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineCorrection.field.quantity")}
                    value={draft.quantityText}
                    onChangeText={(value) => updateDraft({ quantityText: value })}
                    keyboardType="decimal-pad"
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>{t("purchaseLineCorrection.field.unit")}</Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineCorrection.field.unit")}
                    value={draft.unitOfMeasure}
                    onChangeText={(value) => updateDraft({ unitOfMeasure: value })}
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.label}>{t("purchaseLineCorrection.field.pack")}</Text>
              <TextInput
                accessibilityLabel={t("purchaseLineCorrection.field.pack")}
                placeholder={t("purchaseLineCorrection.field.packPlaceholder")}
                placeholderTextColor={colors.faint}
                value={draft.packSize}
                onChangeText={(value) => updateDraft({ packSize: value })}
                editable={actionsEditable}
                style={styles.input}
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>{t("purchaseLineCorrection.field.unitPrice")}</Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineCorrection.field.unitPrice")}
                    value={draft.unitPriceText}
                    onChangeText={(value) => updateDraft({ unitPriceText: value })}
                    keyboardType="decimal-pad"
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>
                    {t("purchaseLineCorrection.field.extendedPrice")}
                  </Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineCorrection.field.extendedPrice")}
                    value={draft.extendedPriceText}
                    onChangeText={(value) => updateDraft({ extendedPriceText: value })}
                    keyboardType="decimal-pad"
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </View>
              </View>

              {selectedLine.lineType === "credit" ? (
                <>
                  <Text style={styles.label}>
                    {t("purchaseLineCorrection.field.creditsLineId")}
                  </Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineCorrection.field.creditsLineId")}
                    placeholder={t("purchaseLineCorrection.field.creditsLineIdPlaceholder")}
                    placeholderTextColor={colors.faint}
                    value={draft.creditsLineId}
                    onChangeText={(value) => updateDraft({ creditsLineId: value })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </>
              ) : null}

              <Button
                title={
                  submitting
                    ? t("common.saving")
                    : t("purchaseLineCorrection.action.submit")
                }
                icon={
                  <FilePenLine
                    size={icon.row}
                    color={colors.surface}
                    strokeWidth={iconStroke}
                  />
                }
                onPress={() => void submit()}
                disabled={!actionsEditable || submitting}
                fullWidth
              />
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10
  },
  label: {
    color: colors.muted,
    ...typography.caption,
    marginBottom: 4
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    ...typography.body,
    marginBottom: 8
  },
  lineRow: {
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  lineSelected: {
    borderColor: colors.accent
  },
  lineCopy: {
    flex: 1,
    gap: 2
  },
  lineTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  lineMeta: {
    color: colors.muted,
    ...typography.caption
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  half: {
    flex: 1
  },
  pressed: {
    opacity: 0.72
  }
});

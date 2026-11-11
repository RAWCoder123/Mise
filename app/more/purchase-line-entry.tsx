import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, FilePlus2, Plus } from "lucide-react-native";
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
import { fetchSuppliers, ingestPurchaseLines } from "../../services/miseService";
import type { PurchaseLineConfidence, PurchaseLineSource, PurchaseLineType } from "../../services/domain/purchaseLines";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import {
  buildPurchaseLineInputsFromDraft,
  createEmptyPurchaseLineEntryDraftLine,
  presentPurchaseLineIngestionSummary,
  type PurchaseLineEntryBuildError,
  type PurchaseLineEntryDraftLine
} from "../../services/presentation/purchaseLineEntry";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import type { Supplier } from "../../types/mise";
import { toDateKeyInTimeZone } from "../../utils/format";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

const BUILD_ERROR_KEYS: Record<PurchaseLineEntryBuildError, MessageKey> = {
  missing_document_reference: "purchaseLineEntry.error.missingDocument",
  missing_transaction_date: "purchaseLineEntry.error.missingTransactionDate",
  invalid_transaction_date: "purchaseLineEntry.error.invalidTransactionDate",
  invalid_received_date: "purchaseLineEntry.error.invalidReceivedDate",
  received_before_transaction: "purchaseLineEntry.error.receivedBeforeTransaction",
  invalid_currency: "purchaseLineEntry.error.invalidCurrency",
  no_lines: "purchaseLineEntry.error.noLines",
  incomplete_line: "purchaseLineEntry.error.incompleteLine",
  invalid_quantity: "purchaseLineEntry.error.invalidQuantity",
  invalid_unit_price: "purchaseLineEntry.error.invalidUnitPrice",
  invalid_extended_price: "purchaseLineEntry.error.invalidExtendedPrice",
  priced_without_currency: "purchaseLineEntry.error.pricedWithoutCurrency",
  credits_line_on_purchase: "purchaseLineEntry.error.creditsOnPurchase"
};

export default function PurchaseLineEntryScreen() {
  const { t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsError, setNoticeIsError] = useState(false);

  const [documentReference, setDocumentReference] = useState("");
  const [source, setSource] = useState<PurchaseLineSource>("invoice");
  const [lineType, setLineType] = useState<PurchaseLineType>("purchase");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [transactionDate, setTransactionDate] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [parseConfidence, setParseConfidence] = useState<PurchaseLineConfidence>("confirmed");
  const [lines, setLines] = useState<PurchaseLineEntryDraftLine[]>([
    createEmptyPurchaseLineEntryDraftLine()
  ]);

  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setSuppliers([]);
    setLoadedRestaurantId(null);
    setError(false);
    setNotice(null);
    setNoticeIsError(false);
    setDocumentReference("");
    setSource("invoice");
    setLineType("purchase");
    setSupplierId(null);
    setReceivedDate("");
    setParseConfidence("confirmed");
    setLines([createEmptyPurchaseLineEntryDraftLine()]);
    setCurrency((restaurant?.currency || "USD").toUpperCase());
    setTransactionDate(
      restaurant?.timezone
        ? toDateKeyInTimeZone(new Date(), restaurant.timezone)
        : new Date().toISOString().slice(0, 10)
    );
    setLoading(Boolean(restaurant));
  }, [restaurant?.id, restaurant?.currency, restaurant?.timezone]);

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
      const nextSuppliers = await fetchSuppliers(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setSuppliers(nextSuppliers);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "purchase_line_entry",
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
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: submitting
  });
  const visibleSuppliers = hubReady ? suppliers : [];

  const sourceOptions = useMemo<readonly SegmentOption<PurchaseLineSource>[]>(
    () => [
      {
        value: "invoice",
        label: t("purchaseLineEntry.source.invoice"),
        tone: "brand",
        disabled: !actionsEditable
      },
      {
        value: "credit_memo",
        label: t("purchaseLineEntry.source.creditMemo"),
        tone: "warning",
        disabled: !actionsEditable
      },
      {
        value: "manual_entry",
        label: t("purchaseLineEntry.source.manualEntry"),
        tone: "neutral",
        disabled: !actionsEditable
      },
      {
        value: "order_confirmation",
        label: t("purchaseLineEntry.source.orderConfirmation"),
        tone: "neutral",
        disabled: !actionsEditable
      }
    ],
    [t, actionsEditable]
  );

  const lineTypeOptions = useMemo<readonly SegmentOption<PurchaseLineType>[]>(
    () => [
      {
        value: "purchase",
        label: t("purchaseLineEntry.lineType.purchase"),
        tone: "brand",
        disabled: !actionsEditable
      },
      {
        value: "credit",
        label: t("purchaseLineEntry.lineType.credit"),
        tone: "warning",
        disabled: !actionsEditable
      }
    ],
    [t, actionsEditable]
  );

  const confidenceOptions = useMemo<readonly SegmentOption<PurchaseLineConfidence>[]>(
    () => [
      {
        value: "confirmed",
        label: t("purchaseLineEntry.confidence.confirmed"),
        tone: "brand",
        disabled: !actionsEditable
      },
      {
        value: "estimated",
        label: t("purchaseLineEntry.confidence.estimated"),
        tone: "neutral",
        disabled: !actionsEditable
      }
    ],
    [t, actionsEditable]
  );

  function updateLine(index: number, patch: Partial<PurchaseLineEntryDraftLine>) {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
    );
  }

  async function submit() {
    if (!restaurant || !actionsEditable) return;
    setNotice(null);
    setNoticeIsError(false);

    const built = buildPurchaseLineInputsFromDraft({
      sourceDocumentReference: documentReference,
      source,
      lineType,
      supplierId,
      transactionDate,
      receivedDate,
      currency,
      parseConfidence,
      lines
    });
    if (!built.ok) {
      setNotice(t(BUILD_ERROR_KEYS[built.error]));
      setNoticeIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setSubmitting(true);
    try {
      const result = await ingestPurchaseLines({
        restaurantId,
        source,
        sourceDocumentReference: built.sourceDocumentReference,
        supplierId: built.supplierId,
        lines: built.lines
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const summary = presentPurchaseLineIngestionSummary(result);
      if (summary.recorded === 0 && summary.duplicates > 0) {
        setNotice(
          t("purchaseLineEntry.notice.duplicate", {
            count: String(summary.duplicates)
          })
        );
      } else {
        setNotice(
          t("purchaseLineEntry.notice.recorded", {
            recorded: String(summary.recorded),
            unverified: String(summary.couldNotVerify),
            duplicates: String(summary.duplicates)
          })
        );
      }
      setNoticeIsError(false);
      if (summary.recorded > 0) {
        setDocumentReference("");
        setLines([createEmptyPurchaseLineEntryDraftLine()]);
        setReceivedDate("");
      }
    } catch (submitError) {
      captureMiseError(submitError, {
        flow: "purchase_line_entry",
        operation: "ingest",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(t("purchaseLineEntry.error.submit"));
      setNoticeIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) {
        setSubmitting(false);
      }
    }
  }

  return (
    <Screen
      title={t("purchaseLineEntry.title")}
      subtitle={
        restaurant
          ? t("purchaseLineEntry.subtitle", { restaurant: restaurant.name })
          : t("purchaseLineEntry.noRestaurant.body")
      }
      titleAlign="center"
      leadingAction={<BackAction />}
      keyboardAware
    >
      {!restaurant ? (
        <EmptyState
          title={t("purchaseLineEntry.noRestaurant.title")}
          body={t("purchaseLineEntry.noRestaurant.body")}
        />
      ) : loading && !hubReady && !error ? (
        <StatusNotice tone="neutral" title={t("common.loading")} message={t("purchaseLineEntry.loading")} />
      ) : error ? (
        <RetryNotice
          title={t("purchaseLineEntry.retry.title")}
          message={t("purchaseLineEntry.retry.body")}
          retryLabel={t("common.retry")}
          accessibilityLabel={t("purchaseLineEntry.retry.accessibility")}
          onRetry={() => void load()}
        />
      ) : (
        <View style={styles.stack}>
          <StatusNotice
            tone="neutral"
            title={t("purchaseLineEntry.intro.title")}
            message={t("purchaseLineEntry.intro.body")}
          />

          {!canManage ? (
            <StatusNotice
              tone="warning"
              title={t("purchaseLineEntry.staff.title")}
              message={t("purchaseLineEntry.staff.body")}
            />
          ) : null}

          {notice ? (
            <StatusNotice
              tone={noticeIsError ? "danger" : "success"}
              title={noticeIsError ? t("common.error") : t("purchaseLineEntry.notice.title")}
              message={notice}
            />
          ) : null}

          <SectionHeader title={t("purchaseLineEntry.section.document")} />
          <Text style={styles.label}>{t("purchaseLineEntry.field.document")}</Text>
          <TextInput
            accessibilityLabel={t("purchaseLineEntry.field.document")}
            placeholder={t("purchaseLineEntry.field.documentPlaceholder")}
            placeholderTextColor={colors.faint}
            value={documentReference}
            onChangeText={setDocumentReference}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={actionsEditable}
            style={styles.input}
          />

          <Text style={styles.label}>{t("purchaseLineEntry.field.source")}</Text>
          <SegmentedControl
            accessibilityLabel={t("purchaseLineEntry.field.source")}
            value={source}
            options={sourceOptions}
            onValueChange={(next) => {
              setSource(next);
              if (next === "credit_memo") setLineType("credit");
              if (next === "invoice" || next === "order_confirmation") setLineType("purchase");
            }}
          />

          <Text style={styles.label}>{t("purchaseLineEntry.field.lineType")}</Text>
          <SegmentedControl
            accessibilityLabel={t("purchaseLineEntry.field.lineType")}
            value={lineType}
            options={lineTypeOptions}
            onValueChange={setLineType}
          />

          <Text style={styles.label}>{t("purchaseLineEntry.field.transactionDate")}</Text>
          <TextInput
            accessibilityLabel={t("purchaseLineEntry.field.transactionDate")}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.faint}
            value={transactionDate}
            onChangeText={setTransactionDate}
            autoCapitalize="none"
            autoCorrect={false}
            editable={actionsEditable}
            style={styles.input}
          />

          <Text style={styles.label}>{t("purchaseLineEntry.field.receivedDate")}</Text>
          <TextInput
            accessibilityLabel={t("purchaseLineEntry.field.receivedDate")}
            placeholder={t("purchaseLineEntry.field.receivedDatePlaceholder")}
            placeholderTextColor={colors.faint}
            value={receivedDate}
            onChangeText={setReceivedDate}
            autoCapitalize="none"
            autoCorrect={false}
            editable={actionsEditable}
            style={styles.input}
          />

          <Text style={styles.label}>{t("purchaseLineEntry.field.currency")}</Text>
          <TextInput
            accessibilityLabel={t("purchaseLineEntry.field.currency")}
            placeholder="USD"
            placeholderTextColor={colors.faint}
            value={currency}
            onChangeText={(value) => setCurrency(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            editable={actionsEditable}
            style={styles.input}
          />

          <Text style={styles.label}>{t("purchaseLineEntry.field.confidence")}</Text>
          <SegmentedControl
            accessibilityLabel={t("purchaseLineEntry.field.confidence")}
            value={parseConfidence}
            options={confidenceOptions}
            onValueChange={setParseConfidence}
          />

          <SectionHeader title={t("purchaseLineEntry.section.supplier")} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("purchaseLineEntry.supplier.none")}
            disabled={!actionsEditable}
            onPress={() => setSupplierId(null)}
            style={({ pressed }) => [
              styles.supplierRow,
              supplierId === null && styles.supplierSelected,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.supplierTitle}>{t("purchaseLineEntry.supplier.none")}</Text>
            {supplierId === null ? <Badge label={t("common.selected")} tone="success" /> : null}
          </Pressable>
          {visibleSuppliers.length === 0 ? (
            <EmptyState
              title={t("purchaseLineEntry.supplier.emptyTitle")}
              body={t("purchaseLineEntry.supplier.emptyBody")}
            />
          ) : (
            visibleSuppliers.map((supplier) => (
              <Pressable
                key={supplier.id}
                accessibilityRole="button"
                accessibilityLabel={t("purchaseLineEntry.supplier.select", {
                  supplier: supplier.display_name
                })}
                disabled={!actionsEditable}
                onPress={() => setSupplierId(supplier.id)}
                style={({ pressed }) => [
                  styles.supplierRow,
                  supplierId === supplier.id && styles.supplierSelected,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.supplierTitle}>{supplier.display_name}</Text>
                {supplierId === supplier.id ? (
                  <Badge label={t("common.selected")} tone="success" />
                ) : null}
              </Pressable>
            ))
          )}

          <SectionHeader title={t("purchaseLineEntry.section.lines")} />
          {lines.map((line, index) => (
            <View key={`line-${index}`} style={styles.lineCard}>
              <Text style={styles.lineTitle}>
                {t("purchaseLineEntry.line.label", { index: String(index + 1) })}
              </Text>
              <Text style={styles.label}>{t("purchaseLineEntry.field.description")}</Text>
              <TextInput
                accessibilityLabel={t("purchaseLineEntry.field.description")}
                placeholder={t("purchaseLineEntry.field.descriptionPlaceholder")}
                placeholderTextColor={colors.faint}
                value={line.rawItemDescription}
                onChangeText={(value) => updateLine(index, { rawItemDescription: value })}
                editable={actionsEditable}
                style={styles.input}
              />
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>{t("purchaseLineEntry.field.quantity")}</Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineEntry.field.quantity")}
                    placeholder="0"
                    placeholderTextColor={colors.faint}
                    value={line.quantityText}
                    onChangeText={(value) => updateLine(index, { quantityText: value })}
                    keyboardType="decimal-pad"
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>{t("purchaseLineEntry.field.unit")}</Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineEntry.field.unit")}
                    placeholder="case"
                    placeholderTextColor={colors.faint}
                    value={line.unitOfMeasure}
                    onChangeText={(value) => updateLine(index, { unitOfMeasure: value })}
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </View>
              </View>
              <Text style={styles.label}>{t("purchaseLineEntry.field.pack")}</Text>
              <TextInput
                accessibilityLabel={t("purchaseLineEntry.field.pack")}
                placeholder={t("purchaseLineEntry.field.packPlaceholder")}
                placeholderTextColor={colors.faint}
                value={line.packSize}
                onChangeText={(value) => updateLine(index, { packSize: value })}
                editable={actionsEditable}
                style={styles.input}
              />
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>{t("purchaseLineEntry.field.unitPrice")}</Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineEntry.field.unitPrice")}
                    placeholder="0.00"
                    placeholderTextColor={colors.faint}
                    value={line.unitPriceText}
                    onChangeText={(value) => updateLine(index, { unitPriceText: value })}
                    keyboardType="decimal-pad"
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>{t("purchaseLineEntry.field.extendedPrice")}</Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineEntry.field.extendedPrice")}
                    placeholder="0.00"
                    placeholderTextColor={colors.faint}
                    value={line.extendedPriceText}
                    onChangeText={(value) => updateLine(index, { extendedPriceText: value })}
                    keyboardType="decimal-pad"
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </View>
              </View>
              {lineType === "credit" ? (
                <>
                  <Text style={styles.label}>{t("purchaseLineEntry.field.creditsLineId")}</Text>
                  <TextInput
                    accessibilityLabel={t("purchaseLineEntry.field.creditsLineId")}
                    placeholder={t("purchaseLineEntry.field.creditsLineIdPlaceholder")}
                    placeholderTextColor={colors.faint}
                    value={line.creditsLineId}
                    onChangeText={(value) => updateLine(index, { creditsLineId: value })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={actionsEditable}
                    style={styles.input}
                  />
                </>
              ) : null}
            </View>
          ))}

          <Button
            title={t("purchaseLineEntry.action.addLine")}
            icon={<Plus size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => setLines((current) => [...current, createEmptyPurchaseLineEntryDraftLine()])}
            disabled={!actionsEditable || lines.length >= 40}
            variant="secondary"
            fullWidth
          />

          <Button
            title={submitting ? t("common.saving") : t("purchaseLineEntry.action.submit")}
            icon={<FilePlus2 size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
            onPress={() => void submit()}
            disabled={!actionsEditable}
            fullWidth
          />
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
  supplierRow: {
    minHeight: 48,
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
  supplierSelected: {
    borderColor: colors.accent
  },
  supplierTitle: {
    color: colors.text,
    ...typography.body,
    flex: 1
  },
  lineCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 8,
    gap: 2
  },
  lineTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle,
    marginBottom: 6
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, SlidersHorizontal } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import type { ModifierRecipeAdjustmentListItem } from "../../services/domain/modifierRecipeAdjustments";
import {
  expireModifierRecipeAdjustment,
  fetchInventoryItems,
  fetchRecipeBaselineSummary,
  listModifierRecipeAdjustments,
  modifierEligibleInventoryItems,
  modifierEligibleMenuItems,
  presentModifierQuantityDelta,
  rejectModifierRecipeAdjustment,
  upsertModifierRecipeAdjustment,
  verifyModifierRecipeAdjustment
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canManageRestaurantData } from "../../services/tenantAccess";
import type { InventoryItem } from "../../types/mise";

export default function ModifierRecipeAdjustmentsScreen() {
  const { parseNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [entries, setEntries] = useState<ModifierRecipeAdjustmentListItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [menuChoices, setMenuChoices] = useState<Array<{ menuItemId: string; menuItemName: string }>>(
    []
  );
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [externalModifierId, setExternalModifierId] = useState("");
  const [modifierName, setModifierName] = useState("");
  const [quantityDeltaText, setQuantityDeltaText] = useState("1");
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [noticeTitle, setNoticeTitle] = useState<string | null>(null);
  const [noticeBody, setNoticeBody] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"neutral" | "success" | "warning" | "danger">("neutral");
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  const actionLocksRef = useRef(new Set<string>());
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canManage = canManageRestaurantData(memberships, restaurant?.id);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [nextEntries, nextInventory, baseline] = await Promise.all([
        listModifierRecipeAdjustments(restaurantId),
        fetchInventoryItems(restaurantId),
        fetchRecipeBaselineSummary(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEntries.some((entry) => entry.restaurantId !== restaurantId)) {
        throw new Error("Modifier adjustment list returned a foreign restaurant row.");
      }
      setEntries(nextEntries);
      setInventoryItems(nextInventory.filter((item) => item.restaurant_id === restaurantId));
      setMenuChoices(modifierEligibleMenuItems(baseline.items));
      setLoadedRestaurantId(restaurantId);
      setLoadError(false);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setEntries([]);
      setInventoryItems([]);
      setMenuChoices([]);
      setLoadedRestaurantId(null);
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant]);

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setLoadError(false);
    setEntries([]);
    setInventoryItems([]);
    setMenuChoices([]);
    setMenuItemId(null);
    setInventoryItemId(null);
    setExternalModifierId("");
    setModifierName("");
    setQuantityDeltaText("1");
    setBusyKey(null);
    setNoticeTitle(null);
    setNoticeBody(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: Boolean(busyKey)
  });

  const eligibleInventory = useMemo(
    () =>
      restaurant
        ? modifierEligibleInventoryItems(inventoryItems, restaurant.id)
        : [],
    [inventoryItems, restaurant]
  );

  const selectedInventory = eligibleInventory.find((item) => item.id === inventoryItemId) ?? null;

  function showNotice(
    tone: "neutral" | "success" | "warning" | "danger",
    title: string,
    message: string
  ) {
    setNoticeTone(tone);
    setNoticeTitle(title);
    setNoticeBody(message);
  }

  async function runLocked(key: string, work: () => Promise<void>) {
    if (actionLocksRef.current.has(key) || !actionsEditable || !restaurant) return;
    actionLocksRef.current.add(key);
    setBusyKey(key);
    try {
      await work();
    } finally {
      actionLocksRef.current.delete(key);
      if (activeRestaurantIdRef.current === restaurant.id) setBusyKey(null);
    }
  }

  async function handleCreate() {
    if (!restaurant || !menuItemId || !selectedInventory?.canonical_unit) {
      showNotice(
        "warning",
        t("modifiers.notice.incompleteTitle"),
        t("modifiers.notice.incompleteBody")
      );
      return;
    }
    const quantityDelta = parseNumber(quantityDeltaText);
    const canonicalUnit = selectedInventory.canonical_unit;
    if (
      quantityDelta == null ||
      !Number.isFinite(quantityDelta) ||
      quantityDelta === 0 ||
      (canonicalUnit !== "g" && canonicalUnit !== "ml" && canonicalUnit !== "each")
    ) {
      showNotice(
        "warning",
        t("modifiers.notice.incompleteTitle"),
        t("modifiers.notice.incompleteBody")
      );
      return;
    }
    await runLocked("create", async () => {
      try {
        await upsertModifierRecipeAdjustment({
          restaurantId: restaurant.id,
          menuItemId,
          externalModifierId,
          modifierName,
          inventoryItemId: selectedInventory.id,
          quantityDelta,
          canonicalUnit
        });
        setExternalModifierId("");
        setModifierName("");
        setQuantityDeltaText("1");
        showNotice("success", t("modifiers.notice.savedTitle"), t("modifiers.notice.savedBody"));
        await load();
      } catch {
        showNotice(
          "danger",
          t("modifiers.notice.saveErrorTitle"),
          t("modifiers.notice.saveErrorBody")
        );
      }
    });
  }

  async function handleVerify(entry: ModifierRecipeAdjustmentListItem) {
    if (!restaurant) return;
    await runLocked(`verify:${entry.id}`, async () => {
      try {
        await verifyModifierRecipeAdjustment(restaurant.id, entry.id);
        showNotice(
          "success",
          t("modifiers.notice.verifiedTitle"),
          t("modifiers.notice.verifiedBody", { name: entry.modifierName })
        );
        await load();
      } catch {
        showNotice(
          "danger",
          t("modifiers.notice.verifyErrorTitle"),
          t("modifiers.notice.verifyErrorBody")
        );
      }
    });
  }

  async function handleReject(entry: ModifierRecipeAdjustmentListItem) {
    if (!restaurant) return;
    await runLocked(`reject:${entry.id}`, async () => {
      try {
        await rejectModifierRecipeAdjustment(restaurant.id, entry.id);
        showNotice(
          "neutral",
          t("modifiers.notice.rejectedTitle"),
          t("modifiers.notice.rejectedBody", { name: entry.modifierName })
        );
        await load();
      } catch {
        showNotice(
          "danger",
          t("modifiers.notice.rejectErrorTitle"),
          t("modifiers.notice.rejectErrorBody")
        );
      }
    });
  }

  async function handleExpire(entry: ModifierRecipeAdjustmentListItem) {
    if (!restaurant) return;
    await runLocked(`expire:${entry.id}`, async () => {
      try {
        await expireModifierRecipeAdjustment(restaurant.id, entry.id);
        showNotice(
          "neutral",
          t("modifiers.notice.expiredTitle"),
          t("modifiers.notice.expiredBody", { name: entry.modifierName })
        );
        await load();
      } catch {
        showNotice(
          "danger",
          t("modifiers.notice.expireErrorTitle"),
          t("modifiers.notice.expireErrorBody")
        );
      }
    });
  }

  const statusLabel = (status: ModifierRecipeAdjustmentListItem["verificationStatus"]): MessageKey => {
    switch (status) {
      case "draft":
        return "modifiers.status.draft";
      case "verified":
        return "modifiers.status.verified";
      case "rejected":
        return "modifiers.status.rejected";
      case "expired":
        return "modifiers.status.expired";
      default:
        return "modifiers.status.draft";
    }
  };

  function goBackToSettings() {
    if (router.canGoBack()) router.back();
    else router.replace("/settings");
  }

  return (
    <Screen
      title={t("modifiers.title")}
      subtitle={t("modifiers.hero.body")}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.hero}>
        <IconBadge>
          <SlidersHorizontal size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </IconBadge>
        <Text style={styles.heroTitle}>{t("modifiers.hero.title")}</Text>
      </View>

      {noticeTitle && noticeBody ? (
        <StatusNotice tone={noticeTone} title={noticeTitle} message={noticeBody} />
      ) : null}

      {hubLoadState === "error" ? (
        <StatusNotice
          tone="danger"
          title={t("modifiers.loadError.title")}
          message={t("modifiers.loadError.body")}
          actionLabel={t("common.retry")}
          onAction={() => void load()}
        />
      ) : null}

      {hubReady && actionsEditable ? (
        <SectionSurface style={styles.section}>
          <Text style={styles.sectionTitle}>{t("modifiers.form.title")}</Text>
          <Text style={styles.sectionHint}>{t("modifiers.form.menuHint")}</Text>
          <View style={styles.chipRow}>
            {menuChoices.map((choice) => (
              <Pressable
                key={choice.menuItemId}
                accessibilityRole="button"
                onPress={() => setMenuItemId(choice.menuItemId)}
                style={[styles.chip, menuItemId === choice.menuItemId && styles.chipActive]}
              >
                <Text style={styles.chipText}>{choice.menuItemName}</Text>
              </Pressable>
            ))}
          </View>
          {menuChoices.length === 0 ? (
            <Text style={styles.sectionHint}>{t("modifiers.form.noMenu")}</Text>
          ) : null}

          <Text style={styles.fieldLabel}>{t("modifiers.form.modifierId")}</Text>
          <TextInput
            value={externalModifierId}
            onChangeText={setExternalModifierId}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("modifiers.form.modifierIdPlaceholder")}
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>{t("modifiers.form.modifierName")}</Text>
          <TextInput
            value={modifierName}
            onChangeText={setModifierName}
            placeholder={t("modifiers.form.modifierNamePlaceholder")}
            placeholderTextColor={colors.faint}
            style={styles.input}
          />

          <Text style={styles.sectionHint}>{t("modifiers.form.inventoryHint")}</Text>
          <View style={styles.chipRow}>
            {eligibleInventory.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => setInventoryItemId(item.id)}
                style={[styles.chip, inventoryItemId === item.id && styles.chipActive]}
              >
                <Text style={styles.chipText}>
                  {item.item_name}
                  {item.canonical_unit ? ` · ${item.canonical_unit}` : ""}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>{t("modifiers.form.quantityDelta")}</Text>
          <TextInput
            value={quantityDeltaText}
            onChangeText={setQuantityDeltaText}
            keyboardType="decimal-pad"
            placeholder={t("modifiers.form.quantityDeltaPlaceholder")}
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <Button
            title={
              busyKey === "create" ? t("modifiers.form.saving") : t("modifiers.form.save")
            }
            onPress={() => void handleCreate()}
            disabled={busyKey !== null}
            style={styles.saveButton}
          />
        </SectionSurface>
      ) : null}

      {hubReady && entries.length === 0 ? (
        <EmptyState title={t("modifiers.empty.title")} body={t("modifiers.empty.body")} />
      ) : null}

      {hubReady
        ? entries.map((entry) => (
            <SectionSurface key={entry.id} style={styles.section}>
              <View style={styles.rowHeader}>
                <Text style={styles.entryTitle}>{entry.modifierName}</Text>
                <Badge label={t(statusLabel(entry.verificationStatus))} />
              </View>
              <Text style={styles.entryMeta}>
                {t("modifiers.entry.meta", {
                  dish: entry.menuItemName,
                  item: entry.inventoryItemName,
                  delta: presentModifierQuantityDelta(entry),
                  modifierId: entry.externalModifierId
                })}
              </Text>
              {actionsEditable && entry.verificationStatus === "draft" ? (
                <View style={styles.actionRow}>
                  <Button
                    title={t("modifiers.action.verify")}
                    onPress={() => void handleVerify(entry)}
                    disabled={busyKey !== null}
                    style={styles.actionButton}
                  />
                  <Button
                    title={t("modifiers.action.reject")}
                    variant="secondary"
                    onPress={() => void handleReject(entry)}
                    disabled={busyKey !== null}
                    style={styles.actionButton}
                  />
                </View>
              ) : null}
              {actionsEditable && entry.verificationStatus === "verified" ? (
                <Button
                  title={t("modifiers.action.expire")}
                  variant="secondary"
                  onPress={() => void handleExpire(entry)}
                  disabled={busyKey !== null}
                  style={styles.saveButton}
                />
              ) : null}
            </SectionSurface>
          ))
        : null}

      {hubReady && !canManage ? (
        <StatusNotice
          tone="neutral"
          title={t("modifiers.viewOnly.title")}
          message={t("modifiers.viewOnly.body")}
        />
      ) : null}

      {(hubLoadState === "loading" || loading) && !hubReady ? (
        <Text style={styles.loading}>{t("modifiers.loading")}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs, marginBottom: spacing.md },
  heroTitle: { ...typography.cardTitle, color: colors.text },
  section: { marginBottom: spacing.md, gap: spacing.sm },
  sectionTitle: { ...typography.sectionTitle, color: colors.text },
  sectionHint: { ...typography.caption, color: colors.muted },
  fieldLabel: { ...typography.caption, color: colors.muted, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { ...typography.caption, color: colors.text },
  saveButton: { marginTop: spacing.sm },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  entryTitle: { ...typography.cardTitle, color: colors.text, flex: 1 },
  entryMeta: { ...typography.caption, color: colors.muted },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionButton: { flex: 1 },
  loading: { ...typography.body, color: colors.muted, textAlign: "center", marginTop: spacing.lg }
});

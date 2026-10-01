import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, ArrowRightLeft, ShieldCheck } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import type { IngredientSubstitutionListItem } from "../../services/domain/ingredientSubstitutions";
import {
  expireIngredientSubstitution,
  fetchInventoryItems,
  listIngredientSubstitutions,
  presentIngredientSubstitutionRatio,
  rejectIngredientSubstitution,
  substitutionEligibleInventoryItems,
  upsertIngredientSubstitution,
  verifyIngredientSubstitution
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canManageRestaurantData } from "../../services/tenantAccess";
import type { InventoryItem } from "../../types/mise";

interface SubstitutionsNotice {
  tone: StatusNoticeTone;
  title: string;
  message: string;
}

export default function IngredientSubstitutionsScreen() {
  const navigation = useNavigation();
  const { formatNumber, parseNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [entries, setEntries] = useState<IngredientSubstitutionListItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [sourceItemId, setSourceItemId] = useState<string | null>(null);
  const [substituteItemId, setSubstituteItemId] = useState<string | null>(null);
  const [sourceQuantityText, setSourceQuantityText] = useState("1");
  const [substituteQuantityText, setSubstituteQuantityText] = useState("1");
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<SubstitutionsNotice | null>(null);
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
      const [nextEntries, nextInventory] = await Promise.all([
        listIngredientSubstitutions(restaurantId),
        fetchInventoryItems(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (
        nextEntries.some((entry) => entry.restaurantId !== restaurantId) ||
        nextInventory.some((item) => item.restaurant_id !== restaurantId)
      ) {
        throw new Error("Substitution directory did not match the active restaurant.");
      }
      setEntries(nextEntries);
      setInventoryItems(nextInventory);
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    actionLocksRef.current.clear();
    setEntries([]);
    setInventoryItems([]);
    setSourceItemId(null);
    setSubstituteItemId(null);
    setSourceQuantityText("1");
    setSubstituteQuantityText("1");
    setLoadedRestaurantId(null);
    setLoadError(false);
    setBusyKey(null);
    setNotice(null);
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
  const visibleEntries = hubReady ? entries : [];

  const eligibleItems = useMemo(
    () =>
      restaurant
        ? substitutionEligibleInventoryItems(inventoryItems, restaurant.id)
        : [],
    [inventoryItems, restaurant?.id]
  );

  const selectedSource = eligibleItems.find((item) => item.id === sourceItemId) ?? null;
  const selectedSubstitute = eligibleItems.find((item) => item.id === substituteItemId) ?? null;
  const sharedCanonicalUnit =
    selectedSource?.canonical_unit &&
    selectedSubstitute?.canonical_unit &&
    selectedSource.canonical_unit === selectedSubstitute.canonical_unit
      ? selectedSource.canonical_unit
      : null;

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function runLocked(key: string, work: () => Promise<void>) {
    if (actionLocksRef.current.has(key) || !actionsEditable || !restaurant) return;
    actionLocksRef.current.add(key);
    setBusyKey(key);
    setNotice(null);
    try {
      await work();
    } catch {
      if (activeRestaurantIdRef.current === restaurant.id) {
        setNotice({
          tone: "danger",
          title: t("substitutions.notice.failedTitle"),
          message: t("substitutions.notice.failedBody")
        });
      }
    } finally {
      actionLocksRef.current.delete(key);
      if (activeRestaurantIdRef.current === restaurant.id) setBusyKey(null);
    }
  }

  async function createDraft() {
    if (!restaurant || !selectedSource || !selectedSubstitute || !sharedCanonicalUnit) {
      setNotice({
        tone: "danger",
        title: t("substitutions.notice.invalidTitle"),
        message: t("substitutions.notice.invalidBody")
      });
      return;
    }
    const sourceQuantity = parseNumber(sourceQuantityText);
    const substituteQuantity = parseNumber(substituteQuantityText);
    if (
      sourceQuantity == null ||
      substituteQuantity == null ||
      !Number.isFinite(sourceQuantity) ||
      !Number.isFinite(substituteQuantity)
    ) {
      setNotice({
        tone: "danger",
        title: t("substitutions.notice.invalidTitle"),
        message: t("substitutions.notice.quantityBody")
      });
      return;
    }
    await runLocked("create", async () => {
      await upsertIngredientSubstitution({
        restaurantId: restaurant.id,
        sourceInventoryItemId: selectedSource.id,
        substituteInventoryItemId: selectedSubstitute.id,
        sourceQuantity,
        substituteQuantity,
        canonicalUnit: sharedCanonicalUnit
      });
      await load();
      setNotice({
        tone: "success",
        title: t("substitutions.notice.createdTitle"),
        message: t("substitutions.notice.createdBody")
      });
    });
  }

  return (
    <Screen
      title={t("substitutions.title")}
      subtitle={t("substitutions.subtitle")}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        {notice ? (
          <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
        ) : null}

        {hubLoadState === "error" ? (
          <StatusNotice
            tone="danger"
            title={t("substitutions.error.loadTitle")}
            message={t("substitutions.error.loadBody")}
            actionLabel={t("common.retry")}
            onAction={() => void load()}
          />
        ) : null}

        {!canManage ? (
          <StatusNotice
            tone="warning"
            title={t("substitutions.readOnly.title")}
            message={t("substitutions.readOnly.body")}
          />
        ) : null}

        <SectionSurface>
          <View style={styles.heroRow}>
            <IconBadge>
              <ArrowRightLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
            </IconBadge>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t("substitutions.hero.title")}</Text>
              <Text style={styles.heroBody}>{t("substitutions.hero.body")}</Text>
            </View>
          </View>
        </SectionSurface>

        {canManage ? (
          <SectionSurface>
            <Text style={styles.sectionTitle}>{t("substitutions.create.title")}</Text>
            <Text style={styles.sectionBody}>{t("substitutions.create.body")}</Text>
            <Text style={styles.fieldLabel}>{t("substitutions.create.source")}</Text>
            <View style={styles.chipWrap}>
              {eligibleItems.map((item) => (
                <Chip
                  key={`source-${item.id}`}
                  label={item.item_name}
                  selected={sourceItemId === item.id}
                  disabled={!actionsEditable || busyKey != null}
                  onPress={() => setSourceItemId(item.id)}
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>{t("substitutions.create.substitute")}</Text>
            <View style={styles.chipWrap}>
              {eligibleItems
                .filter((item) => item.id !== sourceItemId)
                .map((item) => (
                  <Chip
                    key={`sub-${item.id}`}
                    label={item.item_name}
                    selected={substituteItemId === item.id}
                    disabled={!actionsEditable || busyKey != null}
                    onPress={() => setSubstituteItemId(item.id)}
                  />
                ))}
            </View>
            <View style={styles.qtyRow}>
              <View style={styles.qtyField}>
                <Text style={styles.fieldLabel}>{t("substitutions.create.sourceQty")}</Text>
                <TextInput
                  value={sourceQuantityText}
                  onChangeText={setSourceQuantityText}
                  keyboardType="decimal-pad"
                  editable={actionsEditable && busyKey == null}
                  style={styles.input}
                  accessibilityLabel={t("substitutions.create.sourceQty")}
                />
              </View>
              <View style={styles.qtyField}>
                <Text style={styles.fieldLabel}>{t("substitutions.create.substituteQty")}</Text>
                <TextInput
                  value={substituteQuantityText}
                  onChangeText={setSubstituteQuantityText}
                  keyboardType="decimal-pad"
                  editable={actionsEditable && busyKey == null}
                  style={styles.input}
                  accessibilityLabel={t("substitutions.create.substituteQty")}
                />
              </View>
            </View>
            {sharedCanonicalUnit ? (
              <Text style={styles.meta}>
                {t("substitutions.create.unit", { unit: sharedCanonicalUnit })}
              </Text>
            ) : (
              <Text style={styles.meta}>{t("substitutions.create.unitMismatch")}</Text>
            )}
            <Button
              title={t(busyKey === "create" ? "substitutions.create.saving" : "substitutions.create.save")}
              onPress={() => void createDraft()}
              disabled={!actionsEditable || busyKey != null || !sharedCanonicalUnit}
              fullWidth
            />
          </SectionSurface>
        ) : null}

        <SectionSurface>
          <Text style={styles.sectionTitle}>
            {t("substitutions.list.title", { count: formatNumber(visibleEntries.length) })}
          </Text>
          {loading && visibleEntries.length === 0 ? (
            <Text style={styles.meta}>{t("common.loading")}</Text>
          ) : null}
          {!loading && hubReady && visibleEntries.length === 0 ? (
            <EmptyState
              title={t("substitutions.empty.title")}
              body={t("substitutions.empty.body")}
            />
          ) : null}
          {visibleEntries.map((entry) => (
            <SubstitutionRow
              key={entry.id}
              entry={entry}
              actionsEditable={actionsEditable}
              busyKey={busyKey}
              t={t}
              onVerify={() =>
                void runLocked(`verify:${entry.id}`, async () => {
                  if (!restaurant) return;
                  await verifyIngredientSubstitution(restaurant.id, entry.id);
                  await load();
                  setNotice({
                    tone: "success",
                    title: t("substitutions.notice.verifiedTitle"),
                    message: t("substitutions.notice.verifiedBody")
                  });
                })
              }
              onReject={() =>
                void runLocked(`reject:${entry.id}`, async () => {
                  if (!restaurant) return;
                  await rejectIngredientSubstitution(restaurant.id, entry.id);
                  await load();
                  setNotice({
                    tone: "success",
                    title: t("substitutions.notice.rejectedTitle"),
                    message: t("substitutions.notice.rejectedBody")
                  });
                })
              }
              onExpire={() =>
                void runLocked(`expire:${entry.id}`, async () => {
                  if (!restaurant) return;
                  await expireIngredientSubstitution(restaurant.id, entry.id);
                  await load();
                  setNotice({
                    tone: "success",
                    title: t("substitutions.notice.expiredTitle"),
                    message: t("substitutions.notice.expiredBody")
                  });
                })
              }
            />
          ))}
        </SectionSurface>
      </View>
    </Screen>
  );
}

function SubstitutionRow({
  entry,
  actionsEditable,
  busyKey,
  t,
  onVerify,
  onReject,
  onExpire
}: {
  entry: IngredientSubstitutionListItem;
  actionsEditable: boolean;
  busyKey: string | null;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  onVerify: () => void;
  onReject: () => void;
  onExpire: () => void;
}) {
  const statusKey = statusMessageKey(entry.verificationStatus);
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>
          {entry.sourceItemName} → {entry.substituteItemName}
        </Text>
        <Badge label={t(statusKey)} tone={statusTone(entry.verificationStatus)} />
      </View>
      <Text style={styles.meta}>{presentIngredientSubstitutionRatio(entry)}</Text>
      {entry.verificationStatus === "draft" && actionsEditable ? (
        <View style={styles.rowActions}>
          <Button
            title={t("substitutions.action.verify")}
            onPress={onVerify}
            disabled={busyKey != null}
            icon={<ShieldCheck size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
          />
          <Button
            title={t("substitutions.action.reject")}
            variant="secondary"
            onPress={onReject}
            disabled={busyKey != null}
          />
        </View>
      ) : null}
      {entry.verificationStatus === "verified" && actionsEditable ? (
        <View style={styles.rowActions}>
          <Button
            title={t("substitutions.action.expire")}
            variant="secondary"
            onPress={onExpire}
            disabled={busyKey != null}
          />
        </View>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  disabled,
  onPress
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      title={label}
      variant={selected ? "primary" : "secondary"}
      onPress={onPress}
      disabled={disabled}
    />
  );
}

function statusMessageKey(
  status: IngredientSubstitutionListItem["verificationStatus"]
): MessageKey {
  switch (status) {
    case "draft":
      return "substitutions.status.draft";
    case "verified":
      return "substitutions.status.verified";
    case "rejected":
      return "substitutions.status.rejected";
    case "expired":
      return "substitutions.status.expired";
  }
}

function statusTone(
  status: IngredientSubstitutionListItem["verificationStatus"]
): "neutral" | "success" | "warning" | "danger" {
  switch (status) {
    case "verified":
      return "success";
    case "draft":
      return "warning";
    case "rejected":
      return "danger";
    case "expired":
      return "neutral";
  }
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  heroRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start"
  },
  heroCopy: {
    flex: 1,
    gap: 4
  },
  heroTitle: {
    ...typography.sectionTitle,
    color: colors.text
  },
  heroBody: {
    ...typography.body,
    color: colors.muted
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    marginBottom: 4
  },
  sectionBody: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.sm
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: 6
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  qtyRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  qtyField: {
    flex: 1
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.surface,
    ...typography.body
  },
  meta: {
    ...typography.caption,
    color: colors.muted,
    marginVertical: 8
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    gap: 6
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  rowTitle: {
    ...typography.body,
    fontFamily: typography.sectionTitle.fontFamily,
    color: colors.text,
    flex: 1
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  }
});

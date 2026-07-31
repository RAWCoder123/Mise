import { useRef, useState } from "react";
import { router } from "expo-router";
import { ArrowLeft, PackagePlus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { createInventoryItem } from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { operatingLimits } from "../../services/miseValidation";

const CATEGORY_PRESETS = ["Proteins", "Produce", "Dry Goods", "Dairy", "Other"] as const;

export default function InventoryCreateScreen() {
  const { formatNumber, parseNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id ?? "");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Produce");
  const [unit, setUnit] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState("0");
  const [parLevel, setParLevel] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [estimatedUnitCost, setEstimatedUnitCost] = useState("0");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  async function handleCreate() {
    if (!restaurant || !canManage) return;

    const quantity = parseNumber(currentQuantity);
    const par = parseNumber(parLevel);
    const reorder = parseNumber(reorderThreshold);
    const cost = parseNumber(estimatedUnitCost);
    if (
      !itemName.trim() ||
      !category.trim() ||
      !unit.trim() ||
      !supplierName.trim() ||
      quantity === null ||
      par === null ||
      reorder === null ||
      cost === null
    ) {
      setMessage(t("inventory.create.validationError"));
      setMessageIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setSaving(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      const created = await createInventoryItem(restaurantId, {
        item_name: itemName,
        category,
        unit,
        current_quantity: quantity,
        par_level: par,
        reorder_threshold: reorder,
        estimated_unit_cost: cost,
        supplier_name: supplierName
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      router.replace(`/inventory/${created.id}`);
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(error instanceof Error ? error.message : t("inventory.create.saveError"));
      setMessageIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  if (!restaurant) {
    return (
      <Screen title={t("inventory.create.title")} subtitle={t("inventory.create.subtitle")}>
        <StatusNotice
          title={t("inventory.detail.noWorkspace")}
          message={t("inventory.create.noWorkspaceBody")}
        />
        <Button
          title={t("inventory.count.backToList")}
          onPress={() => router.replace("/inventory")}
          fullWidth
          style={styles.topGap}
        />
      </Screen>
    );
  }

  if (!canManage) {
    return (
      <Screen title={t("inventory.create.title")} subtitle={t("inventory.create.subtitleRestaurant", { restaurant: restaurant.name })}>
        <StatusNotice
          title={t("inventory.create.staffReadonly")}
          message={t("inventory.create.staffReadonlyBody")}
        />
        <Button
          title={t("inventory.count.backToList")}
          onPress={() => router.replace("/inventory")}
          fullWidth
          style={styles.topGap}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("inventory.create.title")}
      subtitle={t("inventory.create.subtitleRestaurant", { restaurant: restaurant.name })}
      keyboardAware
      action={
        <ActionIcon accessibilityLabel={t("inventory.create.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <SectionSurface
          title={t("inventory.create.cardTitle")}
          subtitle={t("inventory.create.cardSubtitle")}
        >
          <View style={styles.form}>
            <Field
              label={t("inventory.create.itemName")}
              value={itemName}
              onChangeText={setItemName}
              accessibilityLabel={t("inventory.create.itemName")}
              autoCapitalize="words"
            />
            <Text style={styles.label}>{t("inventory.create.category")}</Text>
            <View style={styles.presetRow}>
              {CATEGORY_PRESETS.map((preset) => {
                const selected = category === preset;
                return (
                  <Pressable
                    key={preset}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t("inventory.create.categoryOption", { category: preset })}
                    onPress={() => setCategory(preset)}
                    style={[styles.presetChip, selected && styles.presetChipSelected]}
                  >
                    <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>
                      {categoryLabel(t, preset)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label={t("inventory.create.categoryCustom")}
              value={category}
              onChangeText={setCategory}
              accessibilityLabel={t("inventory.create.categoryCustom")}
            />
            <Field
              label={t("inventory.create.unit")}
              value={unit}
              onChangeText={setUnit}
              accessibilityLabel={t("inventory.create.unit")}
              autoCapitalize="none"
            />
            <Field
              label={t("inventory.create.supplier")}
              value={supplierName}
              onChangeText={setSupplierName}
              accessibilityLabel={t("inventory.create.supplier")}
              autoCapitalize="words"
            />
            <Field
              label={t("inventory.create.currentQuantity")}
              value={currentQuantity}
              onChangeText={setCurrentQuantity}
              accessibilityLabel={t("inventory.create.currentQuantity")}
              keyboardType="decimal-pad"
            />
            <Field
              label={t("inventory.create.parLevel")}
              value={parLevel}
              onChangeText={setParLevel}
              accessibilityLabel={t("inventory.create.parLevel")}
              keyboardType="decimal-pad"
            />
            <Field
              label={t("inventory.create.reorderThreshold")}
              value={reorderThreshold}
              onChangeText={setReorderThreshold}
              accessibilityLabel={t("inventory.create.reorderThreshold")}
              keyboardType="decimal-pad"
            />
            <Field
              label={t("inventory.create.estimatedUnitCost")}
              value={estimatedUnitCost}
              onChangeText={setEstimatedUnitCost}
              accessibilityLabel={t("inventory.create.estimatedUnitCost")}
              keyboardType="decimal-pad"
            />
            <Text style={styles.hint}>
              {t("inventory.create.boundsHint", {
                maximum: formatNumber(operatingLimits.inventoryQuantity)
              })}
            </Text>
          </View>
        </SectionSurface>

        {message ? (
          <Text style={[styles.message, messageIsError && styles.error]} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}

        <Button
          title={saving ? t("common.saving") : t("inventory.create.saveAction")}
          onPress={() => void handleCreate()}
          disabled={saving}
          fullWidth
          accessibilityLabel={t("inventory.create.saveAccessibility")}
          icon={<PackagePlus size={18} color={colors.cream} strokeWidth={2.25} />}
        />
      </View>
    </Screen>
  );
}

function categoryLabel(
  t: ReturnType<typeof useLocale>["t"],
  preset: (typeof CATEGORY_PRESETS)[number]
) {
  switch (preset) {
    case "Proteins":
      return t("inventory.create.category.proteins");
    case "Produce":
      return t("inventory.create.category.produce");
    case "Dry Goods":
      return t("inventory.create.category.dryGoods");
    case "Dairy":
      return t("inventory.create.category.dairy");
    default:
      return t("inventory.create.category.other");
  }
}

function Field({
  label,
  value,
  onChangeText,
  accessibilityLabel,
  keyboardType,
  autoCapitalize
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  keyboardType?: "decimal-pad" | "default";
  autoCapitalize?: "none" | "words";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.faint}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  topGap: {
    marginTop: 12
  },
  form: {
    gap: 10
  },
  field: {
    gap: 6
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    paddingHorizontal: 12
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  presetChip: {
    minHeight: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    justifyContent: "center"
  },
  presetChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  presetChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  presetChipTextSelected: {
    color: colors.accentDark
  },
  hint: {
    color: colors.faint,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600"
  },
  message: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "700"
  },
  error: {
    color: colors.danger
  }
});

import { useRef, useState } from "react";
import { router } from "expo-router";
import { ArrowLeft, PackagePlus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import { createInventoryItem } from "../../services/miseService";
import {
  presentInventoryCreateFailureCopy,
  presentInventoryCreateFormEditable,
  resolveInventoryCreateAccessState,
  resolveInventoryCreateFailureReason,
  type InventoryCreateFailureReason
} from "../../services/presentation/inventoryCreatePresentation";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import { operatingLimits } from "../../services/miseValidation";

const CATEGORY_PRESETS = ["Proteins", "Produce", "Dry Goods", "Dairy", "Other"] as const;

type CreateNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const FAILURE_COPY_KEYS: Record<
  InventoryCreateFailureReason,
  { title: MessageKey; message: MessageKey }
> = {
  validation: {
    title: "inventory.create.notice.validationTitle",
    message: "inventory.create.validationError"
  },
  duplicate: {
    title: "inventory.create.notice.duplicateTitle",
    message: "inventory.create.notice.duplicateBody"
  },
  capacity: {
    title: "inventory.create.notice.capacityTitle",
    message: "inventory.create.notice.capacityBody"
  },
  itemName: {
    title: "inventory.create.notice.itemNameTitle",
    message: "inventory.create.notice.itemNameBody"
  },
  category: {
    title: "inventory.create.notice.categoryTitle",
    message: "inventory.create.notice.categoryBody"
  },
  unit: {
    title: "inventory.create.notice.unitTitle",
    message: "inventory.create.notice.unitBody"
  },
  supplier: {
    title: "inventory.create.notice.supplierTitle",
    message: "inventory.create.notice.supplierBody"
  },
  quantity: {
    title: "inventory.create.notice.quantityTitle",
    message: "inventory.create.notice.quantityBody"
  },
  unknown: {
    title: "inventory.create.notice.saveTitle",
    message: "inventory.create.saveError"
  }
};

export default function InventoryCreateScreen() {
  const { formatNumber, parseNumber, t } = useLocale();
  const { memberships, ready: sessionReady, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id ?? "");
  const accessState = resolveInventoryCreateAccessState({
    sessionReady,
    restaurantId: restaurant?.id,
    canManage
  });
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Produce");
  const [unit, setUnit] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState("0");
  const [parLevel, setParLevel] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [estimatedUnitCost, setEstimatedUnitCost] = useState("0");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<CreateNotice | null>(null);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  const formEditable = presentInventoryCreateFormEditable(accessState, saving);

  function clearNotice() {
    if (notice) setNotice(null);
  }

  function failureNotice(reason: InventoryCreateFailureReason): CreateNotice {
    const localized = (
      Object.keys(FAILURE_COPY_KEYS) as InventoryCreateFailureReason[]
    ).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(FAILURE_COPY_KEYS[key].title),
          message: t(FAILURE_COPY_KEYS[key].message)
        };
        return acc;
      },
      {} as Record<InventoryCreateFailureReason, { title: string; message: string }>
    );
    return presentInventoryCreateFailureCopy(reason, localized);
  }

  async function handleCreate() {
    if (!restaurant || accessState !== "ready" || saving) return;

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
      setNotice(failureNotice("validation"));
      return;
    }

    const restaurantId = restaurant.id;
    setSaving(true);
    setNotice(null);
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
      captureMiseError(error, {
        flow: "inventory_create",
        operation: "create_inventory_item",
        restaurant_id: restaurantId
      });
      setNotice(failureNotice(resolveInventoryCreateFailureReason(error)));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  if (accessState === "loading") {
    return (
      <Screen
        title={t("inventory.create.title")}
        subtitle={t("inventory.create.subtitle")}
        loading
      />
    );
  }

  if (accessState === "missing" || !restaurant) {
    return (
      <Screen title={t("inventory.create.title")} subtitle={t("inventory.create.subtitle")}>
        <StatusNotice
          tone="caution"
          title={t("inventory.create.noWorkspaceTitle")}
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

  if (accessState === "readonly") {
    return (
      <Screen
        title={t("inventory.create.title")}
        subtitle={t("inventory.create.subtitleRestaurant", { restaurant: restaurant.name })}
      >
        <StatusNotice
          tone="caution"
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
              onChangeText={(value) => {
                clearNotice();
                setItemName(value);
              }}
              accessibilityLabel={t("inventory.create.itemName")}
              autoCapitalize="words"
              editable={formEditable}
            />
            <Text style={styles.label}>{t("inventory.create.category")}</Text>
            <View style={styles.presetRow}>
              {CATEGORY_PRESETS.map((preset) => {
                const selected = category === preset;
                const label = categoryLabel(t, preset);
                return (
                  <Pressable
                    key={preset}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !formEditable }}
                    accessibilityLabel={t("inventory.create.categoryOption", { category: label })}
                    disabled={!formEditable}
                    onPress={() => {
                      clearNotice();
                      setCategory(preset);
                    }}
                    style={[styles.presetChip, selected && styles.presetChipSelected]}
                  >
                    <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label={t("inventory.create.categoryCustom")}
              value={category}
              onChangeText={(value) => {
                clearNotice();
                setCategory(value);
              }}
              accessibilityLabel={t("inventory.create.categoryCustom")}
              editable={formEditable}
            />
            <Field
              label={t("inventory.create.unit")}
              value={unit}
              onChangeText={(value) => {
                clearNotice();
                setUnit(value);
              }}
              accessibilityLabel={t("inventory.create.unit")}
              autoCapitalize="none"
              editable={formEditable}
            />
            <Field
              label={t("inventory.create.supplier")}
              value={supplierName}
              onChangeText={(value) => {
                clearNotice();
                setSupplierName(value);
              }}
              accessibilityLabel={t("inventory.create.supplier")}
              autoCapitalize="words"
              editable={formEditable}
            />
            <Field
              label={t("inventory.create.currentQuantity")}
              value={currentQuantity}
              onChangeText={(value) => {
                clearNotice();
                setCurrentQuantity(value);
              }}
              accessibilityLabel={t("inventory.create.currentQuantity")}
              keyboardType="decimal-pad"
              editable={formEditable}
            />
            <Field
              label={t("inventory.create.parLevel")}
              value={parLevel}
              onChangeText={(value) => {
                clearNotice();
                setParLevel(value);
              }}
              accessibilityLabel={t("inventory.create.parLevel")}
              keyboardType="decimal-pad"
              editable={formEditable}
            />
            <Field
              label={t("inventory.create.reorderThreshold")}
              value={reorderThreshold}
              onChangeText={(value) => {
                clearNotice();
                setReorderThreshold(value);
              }}
              accessibilityLabel={t("inventory.create.reorderThreshold")}
              keyboardType="decimal-pad"
              editable={formEditable}
            />
            <Field
              label={t("inventory.create.estimatedUnitCost")}
              value={estimatedUnitCost}
              onChangeText={(value) => {
                clearNotice();
                setEstimatedUnitCost(value);
              }}
              accessibilityLabel={t("inventory.create.estimatedUnitCost")}
              keyboardType="decimal-pad"
              editable={formEditable}
            />
            <Text style={styles.hint}>
              {t("inventory.create.boundsHint", {
                maximum: formatNumber(operatingLimits.inventoryQuantity)
              })}
            </Text>
          </View>
        </SectionSurface>

        {notice ? (
          <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
        ) : null}

        <Button
          title={saving ? t("common.saving") : t("inventory.create.saveAction")}
          onPress={() => void handleCreate()}
          disabled={!formEditable}
          fullWidth
          accessibilityLabel={t("inventory.create.saveAccessibility")}
          accessibilityState={{ disabled: !formEditable, busy: saving }}
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
  autoCapitalize,
  editable = true
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  keyboardType?: "decimal-pad" | "default";
  autoCapitalize?: "none" | "words";
  editable?: boolean;
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
        editable={editable}
        placeholderTextColor={colors.faint}
        style={[styles.input, !editable && styles.inputDisabled]}
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
  inputDisabled: {
    color: colors.muted,
    backgroundColor: colors.background
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
  }
});

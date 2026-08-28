import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  createInventoryItem,
  createSupplier,
  fetchSuppliers
} from "../../services/miseService";
import { operatingLimits } from "../../services/miseValidation";
import { canManageRestaurantData } from "../../services/tenantAccess";
import type { Supplier } from "../../types/mise";

const CATEGORY_PRESETS = ["Proteins", "Produce", "Dry Goods", "Dairy", "Other"] as const;

export default function InventoryCreateScreen() {
  const { formatNumber, parseNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id ?? "");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState(false);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Produce");
  const [unit, setUnit] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [currentQuantity, setCurrentQuantity] = useState("0");
  const [parLevel, setParLevel] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [estimatedUnitCost, setEstimatedUnitCost] = useState("0");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const loadSuppliers = useCallback(async () => {
    if (!restaurant) return;
    const restaurantId = restaurant.id;
    setSuppliersLoading(true);
    setSuppliersError(false);
    try {
      const next = await fetchSuppliers(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setSuppliers(next);
      setSupplierId((current) => {
        if (current && next.some((supplier) => supplier.id === current)) return current;
        return next[0]?.id ?? null;
      });
    } catch {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setSuppliersError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSuppliersLoading(false);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  async function handleCreateSupplier() {
    if (!restaurant || !canManage) return;
    const displayName = newSupplierName.trim();
    if (!displayName) {
      setMessage(t("inventory.create.supplierRequired"));
      setMessageIsError(true);
      return;
    }
    const restaurantId = restaurant.id;
    setCreatingSupplier(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      const created = await createSupplier(restaurantId, displayName);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setSuppliers((current) =>
        [...current.filter((supplier) => supplier.id !== created.id), created].sort((left, right) =>
          left.display_name.localeCompare(right.display_name)
        )
      );
      setSupplierId(created.id);
      setNewSupplierName("");
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(error instanceof Error ? error.message : t("inventory.create.supplierCreateError"));
      setMessageIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setCreatingSupplier(false);
    }
  }

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
      !supplierId ||
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
        supplier_id: supplierId
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
          title={t("inventory.noWorkspace.title")}
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
      <Screen
        title={t("inventory.create.title")}
        subtitle={t("inventory.create.subtitleRestaurant", { restaurant: restaurant.name })}
      >
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

            <Text style={styles.label}>{t("inventory.create.supplier")}</Text>
            {suppliersError ? (
              <StatusNotice
                title={t("inventory.create.supplierLoadError")}
                message={t("inventory.create.supplierLoadErrorBody")}
                tone="warning"
              />
            ) : null}
            <View style={styles.presetRow}>
              {suppliers.map((supplier) => {
                const selected = supplierId === supplier.id;
                return (
                  <Pressable
                    key={supplier.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t("inventory.create.supplierOption", {
                      supplier: supplier.display_name
                    })}
                    onPress={() => setSupplierId(supplier.id)}
                    style={[styles.presetChip, selected && styles.presetChipSelected]}
                  >
                    <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>
                      {supplier.display_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!suppliersLoading && suppliers.length === 0 && !suppliersError ? (
              <Text style={styles.hint}>{t("inventory.create.supplierEmpty")}</Text>
            ) : null}
            <Field
              label={t("inventory.create.supplierNew")}
              value={newSupplierName}
              onChangeText={setNewSupplierName}
              accessibilityLabel={t("inventory.create.supplierNew")}
              autoCapitalize="words"
            />
            <Button
              title={t("inventory.create.supplierCreateAction")}
              onPress={() => void handleCreateSupplier()}
              variant="secondary"
              size="compact"
              disabled={creatingSupplier || !newSupplierName.trim()}
              accessibilityLabel={t("inventory.create.supplierCreateAccessibility")}
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
            <Text style={styles.hint}>{t("inventory.create.openingHint")}</Text>
          </View>
        </SectionSurface>

        {message ? (
          <StatusNotice
            title={messageIsError ? t("inventory.create.saveError") : t("inventory.create.title")}
            message={message}
            tone={messageIsError ? "warning" : "success"}
          />
        ) : null}

        <Button
          title={t("inventory.create.saveAction")}
          onPress={() => void handleCreate()}
          fullWidth
          disabled={saving || suppliersLoading || !supplierId}
          accessibilityLabel={t("inventory.create.saveAccessibility")}
          icon={<PackagePlus size={18} color={colors.surface} strokeWidth={2.25} />}
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
  keyboardType?: "default" | "decimal-pad";
  autoCapitalize?: "none" | "words" | "sentences";
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
    gap: 12
  },
  field: {
    gap: 6
  },
  label: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
            borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.surface
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  presetChip: {
    borderWidth: 1,
            borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface
  },
  presetChipSelected: {
    borderColor: colors.accentDark,
    backgroundColor: colors.accentSoft
  },
  presetChipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600"
  },
  presetChipTextSelected: {
    color: colors.accentDark
  },
  hint: {
    ...typography.caption,
    color: colors.muted
  }
});

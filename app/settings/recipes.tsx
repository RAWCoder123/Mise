import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { AlertTriangle, ArrowLeft, BookOpen, Link2, Package, PackageCheck, Plus, Save, ShoppingBag } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { OperationsFlow } from "../../components/ui/OperationsFlow";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  addRecipeBaselineIngredient,
  confirmRecipeBaselineComplete,
  fetchInventoryItems,
  fetchRecipeBaselineSummary,
  updateRecipeBaselineIngredient
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { requireRecipeBaselineQuantity } from "../../services/miseValidation";
import type { InventoryItem, RecipeBaselineItem, RecipeBaselineSummary } from "../../types/mise";

export default function RecipeBaselinesScreen() {
  const navigation = useNavigation();
  const { formatNumber, parseNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [summary, setSummary] = useState<RecipeBaselineSummary | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [newMenuItemName, setNewMenuItemName] = useState("");
  const [newInventoryItemName, setNewInventoryItemName] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [savingMappingId, setSavingMappingId] = useState<string | null>(null);
  const [savingNewLink, setSavingNewLink] = useState(false);
  const [confirmingMenuItemId, setConfirmingMenuItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [hubLoadError, setHubLoadError] = useState(false);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    hasLoadedRef.current = false;
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    saveTimersRef.current.forEach((timer) => clearTimeout(timer));
    saveTimersRef.current.clear();
    setLoadedRestaurantId(null);
    setHubLoadError(false);
    setSummary(null);
    setInventoryItems([]);
    setDraftQuantities({});
    setNewMenuItemName("");
    setNewInventoryItemName("");
    setNewQuantity("1");
    setSavingMappingId(null);
    setSavingNewLink(false);
    setConfirmingMenuItemId(null);
    setError(null);
    setNotice(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    const soft = hasLoadedRef.current && activeRestaurantIdRef.current === restaurantId;
    if (soft) {
      // Invalidate readiness during soft refresh so mutations stay closed until proof returns.
      setLoadedRestaurantId(null);
    } else {
      setLoading(true);
      setError(null);
      setHubLoadError(false);
      setNotice(null);
    }
    try {
      const [nextSummary, nextInventoryItems] = await Promise.all([
        fetchRecipeBaselineSummary(restaurantId),
        fetchInventoryItems(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSummary(nextSummary);
      setInventoryItems(nextInventoryItems);
      setLoadedRestaurantId(restaurantId);
      setHubLoadError(false);
      // Soft refresh must preserve operator-entered ingredient quantity and builder drafts.
      if (soft) {
        setDraftQuantities((current) =>
          Object.fromEntries(
            nextSummary.items.flatMap((item) =>
              item.ingredients.map((ingredient) => [
                ingredient.mappingId,
                ingredient.mappingId in current
                  ? current[ingredient.mappingId]!
                  : formatNumber(ingredient.quantityUsedPerSale)
              ])
            )
          )
        );
      } else {
        setDraftQuantities(draftQuantitiesFromSummary(nextSummary, formatNumber));
      }
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      // Fail closed for display/actions, but keep local drafts and prior baselines for retry.
      setHubLoadError(true);
      setError(t("recipes.error.load"));
      if (!soft) {
        setSummary(null);
        setInventoryItems([]);
      }
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  }, [formatNumber, restaurant?.id, t]);

  // Coalesces refetches when the operator saves several ingredient quantities
  // in a row, so each save does not immediately re-pull all planning data.
  const scheduleReload = useCallback(
    (restaurantId: string) => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null;
        if (activeRestaurantIdRef.current === restaurantId) void load();
      }, 650);
    },
    [load]
  );

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      saveTimersRef.current.forEach((timer) => clearTimeout(timer));
      saveTimersRef.current.clear();
    };
  }, []);

  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: hubLoadError
  });
  const hubReady = hubLoadState === "ready";
  const mutationBusy = savingNewLink || savingMappingId !== null || confirmingMenuItemId !== null;
  const mutationAllowed = canManage && hubReady;
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: mutationBusy
  });
  const visibleSummary = hubReady ? summary : null;
  const visibleInventoryItems = hubReady ? inventoryItems : [];

  const selectedInventoryItem = useMemo(() => {
    const normalized = newInventoryItemName.trim().toLowerCase();
    if (!normalized) return null;
    return visibleInventoryItems.find((item) => item.item_name.toLowerCase() === normalized) ?? null;
  }, [newInventoryItemName, visibleInventoryItems]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function saveIngredient(mappingId: string, quantity: string, options?: { quiet?: boolean }) {
    if (!restaurant) return;
    if (!actionsEditable) {
      setError(t("recipes.error.readOnly"));
      return;
    }
    const restaurantId = restaurant.id;
    let parsed: number;
    try {
      parsed = requireRecipeBaselineQuantity(parseNumber(quantity));
    } catch {
      setError(t("recipes.error.quantity"));
      return;
    }
    setSavingMappingId(mappingId);
    setError(null);
    if (!options?.quiet) setNotice(null);
    try {
      await updateRecipeBaselineIngredient(restaurantId, mappingId, parsed);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      if (!options?.quiet) setNotice(t("recipes.notice.saved"));
      scheduleReload(restaurantId);
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setError(t("recipes.error.save"));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSavingMappingId(null);
    }
  }

  // Debounces the expensive save+recompute path while the operator is still
  // typing a quantity. Explicit Save flushes the pending timer immediately.
  function queueIngredientSave(
    mappingId: string,
    quantity: string,
    options?: { immediate?: boolean; cancel?: boolean }
  ) {
    const existing = saveTimersRef.current.get(mappingId);
    if (existing) {
      clearTimeout(existing);
      saveTimersRef.current.delete(mappingId);
    }
    if (options?.cancel) return;
    if (options?.immediate) {
      void saveIngredient(mappingId, quantity);
      return;
    }
    const timer = setTimeout(() => {
      saveTimersRef.current.delete(mappingId);
      void saveIngredient(mappingId, quantity, { quiet: true });
    }, 700);
    saveTimersRef.current.set(mappingId, timer);
  }

  async function addBaselineLink() {
    if (!restaurant) return;
    if (!actionsEditable) {
      setError(t("recipes.error.readOnly"));
      return;
    }
    const restaurantId = restaurant.id;
    const menuItemName = newMenuItemName.trim();

    if (!menuItemName) {
      setError(t("recipes.error.menuItem"));
      return;
    }
    if (!selectedInventoryItem) {
      setError(t("recipes.error.inventoryItem"));
      return;
    }
    if (selectedInventoryItem.restaurant_id !== restaurantId) {
      setError(t("recipes.error.wrongRestaurant"));
      return;
    }
    let quantity: number;
    try {
      quantity = requireRecipeBaselineQuantity(parseNumber(newQuantity));
    } catch {
      setError(t("recipes.error.quantity"));
      return;
    }

    setSavingNewLink(true);
    setError(null);
    setNotice(null);
    try {
      await addRecipeBaselineIngredient(restaurantId, {
        menuItemName,
        inventoryItemId: selectedInventoryItem.id,
        quantityUsedPerSale: quantity,
        unit: selectedInventoryItem.unit
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(t("recipes.notice.linked", { ingredient: selectedInventoryItem.item_name, dish: menuItemName }));
      setNewInventoryItemName("");
      setNewQuantity("1");
      await load();
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setError(t("recipes.error.add"));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSavingNewLink(false);
    }
  }

  async function confirmRecipe(item: RecipeBaselineItem) {
    if (!restaurant || !item.menuItemId || item.recipeRevision === undefined) return;
    if (!actionsEditable) {
      setError(t("recipes.error.readOnly"));
      return;
    }
    const restaurantId = restaurant.id;
    setConfirmingMenuItemId(item.menuItemId);
    setError(null);
    setNotice(null);
    try {
      await confirmRecipeBaselineComplete(restaurantId, item.menuItemId, item.recipeRevision);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(t("recipes.notice.confirmed", { item: item.menu_item_name }));
      await load();
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) setError(t("recipes.error.confirm"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setConfirmingMenuItemId(null);
    }
  }

  if (!restaurant) {
    return (
      <Screen
        title={t("recipes.title")}
        subtitle={t("recipes.noRestaurant.subtitle")}
        action={
          <ActionIcon accessibilityLabel={t("recipes.back")} onPress={goBackToSettings}>
            <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
          </ActionIcon>
        }
      >
        <EmptyState
          title={t("recipes.noRestaurant.title")}
          body={t("recipes.noRestaurant.body")}
          illustration={<BookOpen size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("recipes.title")}
      subtitle={t("recipes.subtitle")}
      loading={loading}
      keyboardAware
      action={
        <ActionIcon accessibilityLabel={t("recipes.back")} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      {error && <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text>}
      {notice && <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>}
      {visibleSummary && (
        <View style={styles.stack}>
          {!canManage ? (
            <StatusNotice
              title={t("recipes.readOnly.title")}
              message={t("recipes.readOnly.body")}
            />
          ) : null}

          <OperationalHero
            eyebrow={t("recipes.hero.eyebrow")}
            title={t("recipes.hero.title", { percent: formatNumber(visibleSummary.coveragePercent) })}
            body={t("recipes.hero.body")}
            meta={`${formatNumber(visibleSummary.coveragePercent)}% POS`}
            tone={visibleSummary.coveragePercent >= 100 ? "leaf" : "caution"}
            icon={
              <BookOpen
                size={icon.emphasis}
                color={visibleSummary.coveragePercent >= 100 ? colors.success : colors.caution}
                strokeWidth={iconStroke}
              />
            }
            stats={[
              { label: t("recipes.stat.dishes"), value: formatNumber(visibleSummary.menuItemsTracked), tone: "leaf" },
              { label: t("recipes.stat.links"), value: formatNumber(visibleSummary.ingredientMappings), tone: "neutral" },
              { label: t("recipes.stat.items"), value: formatNumber(visibleSummary.inventoryItemsLinked), tone: "neutral" }
            ]}
          />

          <OperationsFlow
            title={t("recipes.flow.title")}
            subtitle={t("recipes.flow.subtitle")}
            steps={[
              {
                label: t("recipes.flow.posSale"),
                value: formatNumber(visibleSummary.posItemsCovered),
                detail: t("recipes.flow.coveredItems"),
                icon: <ShoppingBag size={icon.row} color={colors.success} strokeWidth={iconStroke} />,
                tone: "leaf"
              },
              {
                label: t("recipes.flow.ingredientMap"),
                value: formatNumber(visibleSummary.ingredientMappings),
                detail: t("recipes.flow.baselineQuantities"),
                icon: <BookOpen size={icon.row} color={colors.text} strokeWidth={iconStroke} />
              },
              {
                label: t("recipes.flow.inventoryMovement"),
                value: formatNumber(visibleSummary.inventoryItemsLinked),
                detail: t("recipes.flow.stockAffected"),
                icon: <PackageCheck size={icon.row} color={colors.success} strokeWidth={iconStroke} />,
                tone: "leaf"
              }
            ]}
          />

          {visibleSummary.posItemsMissingRecipes.length > 0 && (
            <Card style={styles.warningCard}>
              <View style={styles.warningHeader}>
                <AlertTriangle size={icon.emphasis} color={colors.caution} strokeWidth={iconStroke} />
                <Text style={styles.warningTitle}>{t("recipes.warning.title")}</Text>
              </View>
              <Text style={styles.warningCopy}>
                {t("recipes.warning.body")}
              </Text>
              <View style={styles.missingList}>
                {visibleSummary.posItemsMissingRecipes.map((itemName) => (
                  <Badge key={itemName} label={itemName} tone="warning" />
                ))}
              </View>
            </Card>
          )}

          {mutationAllowed ? (
            <RecipeBaselineBuilder
              menuItemName={newMenuItemName}
              inventoryItemName={newInventoryItemName}
              quantity={newQuantity}
              selectedInventoryItem={selectedInventoryItem}
              missingMenuItems={visibleSummary.posItemsMissingRecipes}
              inventoryItems={visibleInventoryItems}
              saving={savingNewLink}
              onMenuItemNameChange={setNewMenuItemName}
              onInventoryItemNameChange={setNewInventoryItemName}
              onQuantityChange={setNewQuantity}
              onAdd={addBaselineLink}
            />
          ) : null}

          <SectionHeader
            title={t("recipes.section.title")}
            eyebrow={t("recipes.section.eyebrow")}
            action={t("recipes.section.shown", { count: formatNumber(visibleSummary.items.length) })}
          />
          <View style={styles.recipeList}>
            {visibleSummary.items.length === 0 ? (
              <EmptyState
                title={t("recipes.empty.title")}
                body={t("recipes.empty.body")}
                illustration={<BookOpen size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
              />
            ) : (
              visibleSummary.items.map((item) => (
                <RecipeRow
                  key={item.menu_item_name}
                  item={item}
                  canManage={actionsEditable}
                  savingMappingId={savingMappingId}
                  confirming={confirmingMenuItemId === item.menuItemId}
                  draftQuantities={draftQuantities}
                  onDraftChange={(mappingId, value) => {
                    setDraftQuantities((current) => ({ ...current, [mappingId]: value }));
                  }}
                  onSave={queueIngredientSave}
                  onConfirm={() => void confirmRecipe(item)}
                />
              ))
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

function RecipeBaselineBuilder({
  menuItemName,
  inventoryItemName,
  quantity,
  selectedInventoryItem,
  missingMenuItems,
  inventoryItems,
  saving,
  onMenuItemNameChange,
  onInventoryItemNameChange,
  onQuantityChange,
  onAdd
}: {
  menuItemName: string;
  inventoryItemName: string;
  quantity: string;
  selectedInventoryItem: InventoryItem | null;
  missingMenuItems: string[];
  inventoryItems: InventoryItem[];
  saving: boolean;
  onMenuItemNameChange: (value: string) => void;
  onInventoryItemNameChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onAdd: () => void;
}) {
  const { t } = useLocale();
  return (
    <Card style={styles.builderCard}>
      <View style={styles.builderHeader}>
        <IconBadge tone="brand">
          <Plus size={icon.row} color={colors.accent} strokeWidth={iconStroke} />
        </IconBadge>
        <View style={styles.builderHeaderText}>
          <Text style={styles.builderTitle}>{t("recipes.builder.title")}</Text>
          <Text style={styles.builderCopy}>{t("recipes.builder.body")}</Text>
        </View>
      </View>

      {missingMenuItems.length > 0 && (
        <View style={styles.suggestionBlock}>
          <Text style={styles.inputLabel}>{t("recipes.builder.missing")}</Text>
          <View style={styles.chipRow}>
            {missingMenuItems.slice(0, 5).map((itemName) => (
              <SuggestionChip
                key={itemName}
                label={itemName}
                active={menuItemName.trim().toLowerCase() === itemName.toLowerCase()}
                disabled={saving}
                onPress={() => onMenuItemNameChange(itemName)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.inputLabel}>{t("recipes.field.menuItem")}</Text>
        <TextInput
          accessibilityLabel={t("recipes.field.menuItem")}
          accessibilityState={{ disabled: saving }}
          value={menuItemName}
          onChangeText={onMenuItemNameChange}
          editable={!saving}
          placeholder={t("recipes.field.menuPlaceholder")}
          placeholderTextColor={colors.faint}
          style={styles.builderInput}
        />
      </View>

      <View style={styles.suggestionBlock}>
        <Text style={styles.inputLabel}>{t("recipes.field.inventoryItem")}</Text>
        <View style={styles.chipRow}>
          {inventoryItems.slice(0, 7).map((item) => (
            <SuggestionChip
              key={item.id}
              label={item.item_name}
              active={selectedInventoryItem?.id === item.id}
              disabled={saving}
              icon={<Package size={icon.inline} color={selectedInventoryItem?.id === item.id ? colors.surface : colors.text} strokeWidth={iconStroke} />}
              onPress={() => onInventoryItemNameChange(item.item_name)}
            />
          ))}
        </View>
        <TextInput
          accessibilityLabel={t("recipes.field.inventoryItem")}
          accessibilityState={{ disabled: saving }}
          value={inventoryItemName}
          onChangeText={onInventoryItemNameChange}
          editable={!saving}
          placeholder={t("recipes.field.inventoryPlaceholder")}
          placeholderTextColor={colors.faint}
          style={[styles.builderInput, styles.inventoryInput]}
        />
      </View>

      <View style={styles.quantityBuilderRow}>
        <View style={styles.quantityBuilderField}>
          <Text style={styles.inputLabel}>{t("recipes.field.quantity")}</Text>
          <TextInput
            accessibilityLabel={t("recipes.field.quantity")}
            accessibilityState={{ disabled: saving }}
            value={quantity}
            onChangeText={onQuantityChange}
            editable={!saving}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={styles.builderInput}
          />
        </View>
        <View style={styles.unitPreview}>
          <Text style={styles.unitPreviewValue}>{selectedInventoryItem?.unit ?? "--"}</Text>
          <Text style={styles.unitPreviewLabel}>{t("recipes.field.unit")}</Text>
        </View>
      </View>

      <Button
        title={t(saving ? "recipes.action.adding" : "recipes.action.add")}
        icon={<Plus size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
        onPress={onAdd}
        disabled={saving}
        fullWidth
      />
    </Card>
  );
}

function SuggestionChip({
  label,
  active,
  disabled,
  icon,
  onPress
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.suggestionChip,
        active && styles.suggestionChipActive,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      {icon}
      <Text style={[styles.suggestionChipText, active && styles.suggestionChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function draftQuantitiesFromSummary(
  summary: RecipeBaselineSummary,
  formatNumber: (value: number) => string
): Record<string, string> {
  return Object.fromEntries(
    summary.items.flatMap((item) =>
      item.ingredients.map((ingredient) => [
        ingredient.mappingId,
        formatNumber(ingredient.quantityUsedPerSale)
      ])
    )
  );
}

function RecipeRow({
  item,
  canManage,
  savingMappingId,
  confirming,
  draftQuantities,
  onDraftChange,
  onSave,
  onConfirm
}: {
  item: RecipeBaselineItem;
  canManage: boolean;
  savingMappingId: string | null;
  confirming: boolean;
  draftQuantities: Record<string, string>;
  onDraftChange: (mappingId: string, value: string) => void;
  onSave: (mappingId: string, quantity: string, options?: { immediate?: boolean; cancel?: boolean }) => void;
  onConfirm: () => void;
}) {
  const { formatNumber, parseNumber, t } = useLocale();

  function parsedQuantity(draftValue: string) {
    try {
      return requireRecipeBaselineQuantity(parseNumber(draftValue));
    } catch {
      return null;
    }
  }

  return (
    <View style={styles.recipeRow}>
      <View style={styles.statusRail} />
      <View style={styles.recipeLead}>
        <IconBadge tone="leaf">
          <Link2 size={icon.row} color={colors.success} strokeWidth={iconStroke} />
        </IconBadge>
        <View style={styles.recipeText}>
          <View style={styles.recipeTop}>
            <Text style={styles.recipeName}>{item.menu_item_name}</Text>
            <Text style={styles.soldText}>
              {t(item.todayQuantitySold === 1 ? "recipes.row.sold.one" : "recipes.row.sold.other", {
                count: formatNumber(item.todayQuantitySold)
              })}
            </Text>
          </View>
          <Text style={styles.recipeMeta}>
            {t(item.ingredientCount === 1 ? "recipes.row.linked.one" : "recipes.row.linked.other", {
              count: formatNumber(item.ingredientCount)
            })}
          </Text>
          <View style={styles.authorityRow}>
            <Badge
              label={t(item.authorityReady ? "recipes.authority.confirmed" : "recipes.authority.unconfirmed")}
              tone={item.authorityReady ? "success" : "warning"}
            />
            {canManage && !item.authorityReady && item.menuItemId ? (
              <Button
                title={t(confirming ? "recipes.action.confirming" : "recipes.action.confirm")}
                variant="secondary"
                size="compact"
                disabled={confirming || savingMappingId !== null}
                onPress={onConfirm}
              />
            ) : null}
          </View>
          <View style={styles.ingredientList}>
            {item.ingredients.map((ingredient) => {
              const draftValue =
                draftQuantities[ingredient.mappingId] ?? formatNumber(ingredient.quantityUsedPerSale);
              const isSaving = savingMappingId === ingredient.mappingId;
              const isBusy = savingMappingId !== null;
              const parsed = parsedQuantity(draftValue);
              const isDirty = parsed !== null && parsed !== ingredient.quantityUsedPerSale;

              return (
                <View key={ingredient.mappingId} style={styles.ingredientEditor}>
                  <View style={styles.ingredientTextBlock}>
                    <Text style={styles.ingredientName}>{ingredient.itemName}</Text>
                    <Text style={styles.ingredientUnit}>{t("recipes.row.perSale")}</Text>
                  </View>
                  <View style={styles.ingredientControls}>
                    <View style={styles.quantityEdit}>
                      {canManage ? (
                        <TextInput
                          value={draftValue}
                          onChangeText={(value) => {
                            onDraftChange(ingredient.mappingId, value);
                            const next = parsedQuantity(value);
                            if (next === null) {
                              onSave(ingredient.mappingId, value, { cancel: true });
                              return;
                            }
                            if (next === ingredient.quantityUsedPerSale) {
                              onSave(ingredient.mappingId, value, { cancel: true });
                              return;
                            }
                            onSave(ingredient.mappingId, value);
                          }}
                          onBlur={() => {
                            if (isDirty) onSave(ingredient.mappingId, draftValue, { immediate: true });
                          }}
                          editable={!isBusy}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          accessibilityLabel={t("recipes.row.quantityAccessibility", { ingredient: ingredient.itemName })}
                          accessibilityState={{ disabled: isBusy }}
                          style={styles.quantityInput}
                        />
                      ) : (
                        <Text
                          accessibilityLabel={t("recipes.row.readOnlyAccessibility", {
                            ingredient: ingredient.itemName,
                            quantity: draftValue,
                            unit: ingredient.unit
                          })}
                          style={styles.readOnlyQuantity}
                        >
                          {draftValue}
                        </Text>
                      )}
                      <Text style={styles.quantityUnit} numberOfLines={1}>
                        {ingredient.unit}
                      </Text>
                    </View>
                    {canManage ? (
                      <Button
                        title={t(isSaving ? "recipes.action.saving" : "recipes.action.save")}
                        accessibilityLabel={t("recipes.action.saveAccessibility", { ingredient: ingredient.itemName })}
                        variant="secondary"
                        icon={<Save size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                        disabled={isBusy || !isDirty}
                        onPress={() => onSave(ingredient.mappingId, draftValue, { immediate: true })}
                        style={styles.saveButton}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  warningCard: {
    borderColor: colors.caution,
    backgroundColor: colors.surfaceWarm
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  warningTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  warningCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8
  },
  missingList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  builderCard: {
    gap: 13
  },
  builderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  builderHeaderText: {
    flex: 1,
    minWidth: 0
  },
  builderTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  builderCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3
  },
  suggestionBlock: {
    gap: 9
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  suggestionChip: {
    minHeight: 44,
    maxWidth: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  suggestionChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  suggestionChipText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900"
  },
  suggestionChipTextActive: {
    color: colors.surface
  },
  fieldGroup: {
    gap: 7
  },
  inputLabel: {
    color: colors.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  builderInput: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 12
  },
  inventoryInput: {
    marginTop: 1
  },
  quantityBuilderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10
  },
  quantityBuilderField: {
    flex: 1,
    gap: 7
  },
  unitPreview: {
    width: 82,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  unitPreviewValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900"
  },
  unitPreviewLabel: {
    color: colors.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  recipeList: {
    gap: 10
  },
  recipeRow: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 13
  },
  statusRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: colors.success
  },
  recipeLead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  recipeText: {
    flex: 1,
    minWidth: 0
  },
  recipeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  recipeName: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  soldText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900"
  },
  recipeMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3
  },
  authorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8
  },
  ingredientList: {
    gap: 8,
    marginTop: 10
  },
  ingredientEditor: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    padding: 10,
    alignItems: "stretch",
    gap: 8
  },
  ingredientTextBlock: {
    minWidth: 0
  },
  ingredientName: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900"
  },
  ingredientUnit: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2
  },
  ingredientControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    minWidth: 0
  },
  quantityEdit: {
    minHeight: 48,
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  quantityInput: {
    flex: 1,
    minHeight: 44,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    padding: 0,
    minWidth: 48
  },
  readOnlyQuantity: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    minWidth: 48
  },
  quantityUnit: {
    color: colors.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  saveButton: {
    minHeight: 48,
    width: 100,
    paddingHorizontal: 8
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 12
  },
  notice: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.48
  }
});

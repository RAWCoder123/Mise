import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { AlertTriangle, ArrowLeft, BookOpen, Link2, Package, PackageCheck, Plus, Save, Search, ShoppingBag, Unlink } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { OperationsFlow } from "../../components/ui/OperationsFlow";
import { InsightChartIllustration } from "../../components/ui/MiseIllustrations";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  filterMenuItemsForPicker,
  filterRecipeBaselineItemsBySearch,
  RECIPE_BASELINE_SEARCH_THRESHOLD,
  resolveInventoryItemForRecipeLink,
  searchInventoryItemsForPicker
} from "../../services/domain/inventoryItemSearch";
import {
  addRecipeBaselineIngredient,
  deleteRecipeBaselineIngredient,
  fetchInventoryItems,
  fetchRecipeBaselineSummary,
  updateRecipeBaselineIngredient
} from "../../services/miseService";
import {
  presentRecipesHubEmptyCopy,
  presentRecipesHubSectionAction,
  presentRecipesMutationFormBusy,
  presentRecipesMutationFormEditable,
  presentRecipesMutationNoticeCopy,
  resolveRecipesHubLoadState,
  type RecipesMutationNoticeReason
} from "../../services/presentation/recipesHubPresentation";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import { requireRecipeBaselineQuantity } from "../../services/miseValidation";
import type { InventoryItem, RecipeBaselineItem, RecipeBaselineSummary } from "../../types/mise";

type RecipesNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const MUTATION_NOTICE_KEYS: Record<
  RecipesMutationNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  readOnly: {
    title: "recipes.notice.readOnlyTitle",
    message: "recipes.error.readOnly"
  },
  quantity: {
    title: "recipes.notice.quantityTitle",
    message: "recipes.error.quantity"
  },
  menuItem: {
    title: "recipes.notice.menuItemTitle",
    message: "recipes.error.menuItem"
  },
  inventoryItem: {
    title: "recipes.notice.inventoryItemTitle",
    message: "recipes.error.inventoryItem"
  },
  wrongRestaurant: {
    title: "recipes.notice.wrongRestaurantTitle",
    message: "recipes.error.wrongRestaurant"
  },
  saveFailed: {
    title: "recipes.notice.saveFailedTitle",
    message: "recipes.error.save"
  },
  addFailed: {
    title: "recipes.notice.addFailedTitle",
    message: "recipes.error.add"
  },
  unlinkFailed: {
    title: "recipes.notice.unlinkFailedTitle",
    message: "recipes.error.unlink"
  },
  saved: {
    title: "recipes.notice.savedTitle",
    message: "recipes.notice.saved"
  },
  linked: {
    title: "recipes.notice.linkedTitle",
    message: "recipes.notice.linked"
  },
  unlinked: {
    title: "recipes.notice.unlinkedTitle",
    message: "recipes.notice.unlinked"
  }
};

export default function RecipeBaselinesScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ menuItem?: string | string[] }>();
  const prefillsMenuItem = useMemo(() => {
    const raw = Array.isArray(params.menuItem) ? params.menuItem[0] : params.menuItem;
    return typeof raw === "string" ? raw.trim() : "";
  }, [params.menuItem]);
  const { formatNumber, parseNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [summary, setSummary] = useState<RecipeBaselineSummary | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [newMenuItemName, setNewMenuItemName] = useState(prefillsMenuItem);
  const [newInventoryItemName, setNewInventoryItemName] = useState("");
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [newQuantity, setNewQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [savingMappingId, setSavingMappingId] = useState<string | null>(null);
  const [savingNewLink, setSavingNewLink] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<RecipesNotice | null>(null);
  const [mappedDishQuery, setMappedDishQuery] = useState("");
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  function mutationNotice(
    reason: RecipesMutationNoticeReason,
    params?: Record<string, string>
  ): RecipesNotice {
    const localized = (
      Object.keys(MUTATION_NOTICE_KEYS) as RecipesMutationNoticeReason[]
    ).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(MUTATION_NOTICE_KEYS[key].title),
          message: t(MUTATION_NOTICE_KEYS[key].message, params)
        };
        return acc;
      },
      {} as Record<RecipesMutationNoticeReason, { title: string; message: string }>
    );
    return presentRecipesMutationNoticeCopy(reason, localized);
  }

  function clearNotice() {
    if (notice) setNotice(null);
  }

  useEffect(() => {
    requestIdRef.current += 1;
    loadedRestaurantRef.current = null;
    setLoadedRestaurantId(null);
    setSummary(null);
    setInventoryItems([]);
    setNewMenuItemName(prefillsMenuItem);
    setNewInventoryItemName("");
    setSelectedInventoryItemId(null);
    setNewQuantity("1");
    setSavingMappingId(null);
    setSavingNewLink(false);
    setLoadError(false);
    setNotice(null);
    setMappedDishQuery("");
    setLoading(Boolean(restaurant));
  }, [restaurant?.id, prefillsMenuItem]);

  useEffect(() => {
    if (!prefillsMenuItem) return;
    setNewMenuItemName((current) => (current.trim() ? current : prefillsMenuItem));
  }, [prefillsMenuItem]);

  const load = useCallback(async (showLoading = false) => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    if (showLoading || loadedRestaurantRef.current !== restaurantId) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const [nextSummary, nextInventoryItems] = await Promise.all([
        fetchRecipeBaselineSummary(restaurantId, { itemLimit: null }),
        fetchInventoryItems(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSummary(nextSummary);
      setInventoryItems(nextInventoryItems);
      loadedRestaurantRef.current = restaurantId;
      setLoadedRestaurantId(restaurantId);
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "settings_recipes",
        operation: "load",
        restaurant_id: restaurantId
      });
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [restaurant?.id]);

  const hubLoadState = resolveRecipesHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const visibleSummary = hubReady ? summary : null;
  const visibleInventoryItems = hubReady ? inventoryItems : [];
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const mutationBusy = presentRecipesMutationFormBusy(savingMappingId, savingNewLink);
  const formEditable = presentRecipesMutationFormEditable(canManage, mutationBusy, hubReady);
  const mappedDishes = visibleSummary?.items;
  const showMappedDishSearch = (mappedDishes?.length ?? 0) >= RECIPE_BASELINE_SEARCH_THRESHOLD;
  const filteredMappedDishes = useMemo(() => {
    if (!mappedDishes) return [];
    if (!showMappedDishSearch) return mappedDishes;
    return filterRecipeBaselineItemsBySearch(mappedDishes, mappedDishQuery);
  }, [mappedDishQuery, mappedDishes, showMappedDishSearch]);
  const mappedDishSearchNoMatches =
    showMappedDishSearch && mappedDishQuery.trim().length > 0 && filteredMappedDishes.length === 0;
  const emptyPresentation = presentRecipesHubEmptyCopy(
    hubLoadState,
    { searchNoMatches: mappedDishSearchNoMatches },
    {
      loadingTitle: t("recipes.empty.loadingTitle"),
      loadingBody: t("recipes.empty.loadingBody"),
      unavailableTitle: t("recipes.empty.unavailableTitle"),
      unavailableBody: t("recipes.empty.unavailableBody"),
      emptyTitle: t("recipes.empty.title"),
      emptyBody: t("recipes.empty.body"),
      searchEmptyTitle: t("recipes.section.search.emptyTitle"),
      searchEmptyBody: t("recipes.section.search.emptyBody")
    }
  );
  const sectionAction = presentRecipesHubSectionAction(
    hubLoadState,
    t("recipes.section.shown", {
      count: formatNumber(
        showMappedDishSearch ? filteredMappedDishes.length : visibleSummary?.items.length ?? 0
      )
    }),
    {
      loading: t("recipes.section.action.loading"),
      unavailable: t("recipes.section.action.unavailable")
    }
  );

  const selectedInventoryItem = useMemo(() => {
    return resolveInventoryItemForRecipeLink(
      visibleInventoryItems,
      newInventoryItemName,
      selectedInventoryItemId
    );
  }, [newInventoryItemName, selectedInventoryItemId, visibleInventoryItems]);

  const inventorySearchMatches = useMemo(
    () => searchInventoryItemsForPicker(visibleInventoryItems, newInventoryItemName),
    [newInventoryItemName, visibleInventoryItems]
  );

  function handleInventoryItemNameChange(value: string) {
    clearNotice();
    setNewInventoryItemName(value);
    const resolved = resolveInventoryItemForRecipeLink(visibleInventoryItems, value, null);
    setSelectedInventoryItemId(resolved?.id ?? null);
  }

  function handleInventoryItemSelect(item: InventoryItem) {
    clearNotice();
    setNewInventoryItemName(item.item_name);
    setSelectedInventoryItemId(item.id);
  }

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function saveIngredient(mappingId: string, quantity: string) {
    if (!restaurant || mutationBusy || !hubReady) return;
    if (!canManage) {
      setNotice(mutationNotice("readOnly"));
      return;
    }
    const restaurantId = restaurant.id;
    let parsed: number;
    try {
      parsed = requireRecipeBaselineQuantity(parseNumber(quantity));
    } catch {
      setNotice(mutationNotice("quantity"));
      return;
    }
    setSavingMappingId(mappingId);
    setNotice(null);
    try {
      await updateRecipeBaselineIngredient(restaurantId, mappingId, parsed);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("saved"));
      await load(false);
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "settings_recipes",
        operation: "save_baseline",
        restaurant_id: restaurantId
      });
      setNotice(mutationNotice("saveFailed"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSavingMappingId(null);
    }
  }

  function confirmUnlinkIngredient(mappingId: string, ingredientName: string, dishName: string) {
    if (!restaurant || mutationBusy || !hubReady) return;
    if (!canManage) {
      setNotice(mutationNotice("readOnly"));
      return;
    }
    Alert.alert(
      t("recipes.unlink.confirmTitle"),
      t("recipes.unlink.confirmBody", { ingredient: ingredientName, dish: dishName }),
      [
        { text: t("recipes.unlink.cancel"), style: "cancel" },
        {
          text: t("recipes.unlink.confirm"),
          style: "destructive",
          onPress: () => {
            void unlinkIngredient(mappingId, ingredientName, dishName);
          }
        }
      ]
    );
  }

  async function unlinkIngredient(mappingId: string, ingredientName: string, dishName: string) {
    if (!restaurant || mutationBusy || !hubReady) return;
    if (!canManage) {
      setNotice(mutationNotice("readOnly"));
      return;
    }
    const restaurantId = restaurant.id;
    setSavingMappingId(mappingId);
    setNotice(null);
    try {
      await deleteRecipeBaselineIngredient(restaurantId, mappingId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("unlinked", { ingredient: ingredientName, dish: dishName }));
      await load(false);
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "settings_recipes",
        operation: "unlink_baseline",
        restaurant_id: restaurantId
      });
      setNotice(mutationNotice("unlinkFailed"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSavingMappingId(null);
    }
  }

  async function addBaselineLink() {
    if (!restaurant || mutationBusy || !hubReady) return;
    if (!canManage) {
      setNotice(mutationNotice("readOnly"));
      return;
    }
    const restaurantId = restaurant.id;
    const menuItemName = newMenuItemName.trim();

    if (!menuItemName) {
      setNotice(mutationNotice("menuItem"));
      return;
    }
    if (!selectedInventoryItem) {
      setNotice(mutationNotice("inventoryItem"));
      return;
    }
    if (selectedInventoryItem.restaurant_id !== restaurantId) {
      setNotice(mutationNotice("wrongRestaurant"));
      return;
    }
    let quantity: number;
    try {
      quantity = requireRecipeBaselineQuantity(parseNumber(newQuantity));
    } catch {
      setNotice(mutationNotice("quantity"));
      return;
    }

    setSavingNewLink(true);
    setNotice(null);
    try {
      await addRecipeBaselineIngredient(restaurantId, {
        menuItemName,
        inventoryItemId: selectedInventoryItem.id,
        quantityUsedPerSale: quantity,
        unit: selectedInventoryItem.unit
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(
        mutationNotice("linked", {
          ingredient: selectedInventoryItem.item_name,
          dish: menuItemName
        })
      );
      setNewInventoryItemName("");
      setSelectedInventoryItemId(null);
      setNewQuantity("1");
      await load(false);
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "settings_recipes",
        operation: "add_baseline",
        restaurant_id: restaurantId
      });
      setNotice(mutationNotice("addFailed"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSavingNewLink(false);
    }
  }

  if (!restaurant) {
    return (
      <Screen
        title={t("recipes.title")}
        subtitle={t("recipes.noRestaurant.subtitle")}
        action={
          <ActionIcon accessibilityLabel={t("recipes.back")} onPress={goBackToSettings}>
            <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
          </ActionIcon>
        }
      >
        <EmptyState
          title={t("recipes.noRestaurant.title")}
          body={t("recipes.noRestaurant.body")}
          illustration={<InsightChartIllustration />}
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
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      {loadError ? (
        <RetryNotice
          title={t("recipes.retry.title")}
          message={t("recipes.error.load")}
          onRetry={() => void load(true)}
          retryLabel={t("common.retry")}
          accessibilityLabel={t("recipes.retry.accessibility")}
        />
      ) : null}
      {!loadError && notice ? (
        <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
      ) : null}
      <View style={styles.stack}>
        {!canManage && hubReady ? (
          <StatusNotice
            title={t("recipes.readOnly.title")}
            message={t("recipes.readOnly.body")}
          />
        ) : null}

        {visibleSummary ? (
          <>
            <OperationalHero
              eyebrow={t("recipes.hero.eyebrow")}
              title={t("recipes.hero.title", { percent: formatNumber(visibleSummary.coveragePercent) })}
              body={t("recipes.hero.body")}
              meta={`${formatNumber(visibleSummary.coveragePercent)}% POS`}
              tone={visibleSummary.coveragePercent >= 100 ? "leaf" : "caution"}
              icon={
                <BookOpen
                  size={21}
                  color={visibleSummary.coveragePercent >= 100 ? colors.success : colors.caution}
                  strokeWidth={2.6}
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
                  icon: <ShoppingBag size={18} color={colors.success} strokeWidth={2.4} />,
                  tone: "leaf"
                },
                {
                  label: t("recipes.flow.ingredientMap"),
                  value: formatNumber(visibleSummary.ingredientMappings),
                  detail: t("recipes.flow.baselineQuantities"),
                  icon: <BookOpen size={18} color={colors.text} strokeWidth={2.4} />
                },
                {
                  label: t("recipes.flow.inventoryMovement"),
                  value: formatNumber(visibleSummary.inventoryItemsLinked),
                  detail: t("recipes.flow.stockAffected"),
                  icon: <PackageCheck size={18} color={colors.success} strokeWidth={2.4} />,
                  tone: "leaf"
                }
              ]}
            />

            {visibleSummary.posItemsMissingRecipes.length > 0 && (
              <Card style={styles.warningCard}>
                <View style={styles.warningHeader}>
                  <AlertTriangle size={19} color={colors.caution} strokeWidth={2.4} />
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

            {visibleSummary.posItemsWithIncompatibleUnits.length > 0 && (
              <Card style={styles.warningCard}>
                <View style={styles.warningHeader}>
                  <AlertTriangle size={19} color={colors.caution} strokeWidth={2.4} />
                  <Text style={styles.warningTitle}>{t("recipes.warning.incompatibleTitle")}</Text>
                </View>
                <Text style={styles.warningCopy}>{t("recipes.warning.incompatibleBody")}</Text>
                <View style={styles.missingList}>
                  {visibleSummary.posItemsWithIncompatibleUnits.map((itemName) => (
                    <Badge key={`incompatible-${itemName}`} label={itemName} tone="warning" />
                  ))}
                </View>
              </Card>
            )}

            {canManage ? (
              <RecipeBaselineBuilder
                menuItemName={newMenuItemName}
                inventoryItemName={newInventoryItemName}
                quantity={newQuantity}
                selectedInventoryItem={selectedInventoryItem}
                missingMenuItems={visibleSummary.posItemsMissingRecipes}
                inventorySearchMatches={inventorySearchMatches.map((match) => match.item)}
                inventoryItemCount={visibleInventoryItems.length}
                saving={savingNewLink}
                editable={formEditable}
                onMenuItemNameChange={(value) => {
                  clearNotice();
                  setNewMenuItemName(value);
                }}
                onInventoryItemNameChange={handleInventoryItemNameChange}
                onInventoryItemSelect={handleInventoryItemSelect}
                onQuantityChange={(value) => {
                  clearNotice();
                  setNewQuantity(value);
                }}
                onAdd={addBaselineLink}
              />
            ) : null}
          </>
        ) : null}

        <SectionHeader
          title={t("recipes.section.title")}
          eyebrow={t("recipes.section.eyebrow")}
          action={sectionAction}
        />
        {showMappedDishSearch ? (
          <View style={styles.mappedSearchBox}>
            <Search size={18} color={colors.faint} strokeWidth={2.25} />
            <TextInput
              accessibilityLabel={t("recipes.section.search.accessibility")}
              accessibilityHint={t("recipes.section.search.hint")}
              value={mappedDishQuery}
              onChangeText={setMappedDishQuery}
              placeholder={t("recipes.section.search.placeholder")}
              placeholderTextColor={colors.faint}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.mappedSearchInput}
            />
          </View>
        ) : null}
        <View style={styles.recipeList}>
          {!hubReady || !visibleSummary || visibleSummary.items.length === 0 || mappedDishSearchNoMatches ? (
            <EmptyState
              compact={emptyPresentation.compact}
              title={emptyPresentation.title}
              body={emptyPresentation.body}
              illustration={emptyPresentation.compact ? undefined : <InsightChartIllustration />}
            />
          ) : (
            filteredMappedDishes.map((item) => (
              <RecipeRow
                key={item.menu_item_name}
                item={item}
                canManage={canManage}
                formEditable={formEditable}
                savingMappingId={savingMappingId}
                onSave={saveIngredient}
                onUnlink={confirmUnlinkIngredient}
              />
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

function RecipeBaselineBuilder({
  menuItemName,
  inventoryItemName,
  quantity,
  selectedInventoryItem,
  missingMenuItems,
  inventorySearchMatches,
  inventoryItemCount,
  saving,
  editable,
  onMenuItemNameChange,
  onInventoryItemNameChange,
  onInventoryItemSelect,
  onQuantityChange,
  onAdd
}: {
  menuItemName: string;
  inventoryItemName: string;
  quantity: string;
  selectedInventoryItem: InventoryItem | null;
  missingMenuItems: string[];
  inventorySearchMatches: InventoryItem[];
  inventoryItemCount: number;
  saving: boolean;
  editable: boolean;
  onMenuItemNameChange: (value: string) => void;
  onInventoryItemNameChange: (value: string) => void;
  onInventoryItemSelect: (item: InventoryItem) => void;
  onQuantityChange: (value: string) => void;
  onAdd: () => void;
}) {
  const { formatNumber, t } = useLocale();
  const filteredMissingMenuItems = useMemo(
    () => filterMenuItemsForPicker(missingMenuItems, menuItemName),
    [menuItemName, missingMenuItems]
  );
  const inventoryQueryActive = inventoryItemName.trim().length > 0;
  const inventoryHint = selectedInventoryItem
    ? t("recipes.builder.inventorySelected", {
        item: selectedInventoryItem.item_name,
        unit: selectedInventoryItem.unit
      })
    : inventoryQueryActive && inventorySearchMatches.length === 0
      ? t("recipes.builder.inventoryNoMatches")
      : inventoryQueryActive
        ? t("recipes.builder.inventoryPickOne")
        : t("recipes.builder.inventoryBrowse", { count: formatNumber(inventoryItemCount) });

  return (
    <Card style={styles.builderCard}>
      <View style={styles.builderHeader}>
        <IconBadge tone="brand">
          <Plus size={18} color={colors.accent} strokeWidth={2.5} />
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
            {filteredMissingMenuItems.map((itemName) => (
              <SuggestionChip
                key={itemName}
                label={itemName}
                active={menuItemName.trim().toLowerCase() === itemName.toLowerCase()}
                disabled={!editable}
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
          accessibilityState={{ disabled: !editable }}
          value={menuItemName}
          onChangeText={onMenuItemNameChange}
          editable={editable}
          placeholder={t("recipes.field.menuPlaceholder")}
          placeholderTextColor={colors.faint}
          style={styles.builderInput}
        />
      </View>

      <View style={styles.suggestionBlock}>
        <Text style={styles.inputLabel}>{t("recipes.field.inventoryItem")}</Text>
        <TextInput
          accessibilityLabel={t("recipes.field.inventoryItem")}
          accessibilityHint={t("recipes.field.inventorySearchHint")}
          accessibilityState={{ disabled: !editable }}
          value={inventoryItemName}
          onChangeText={onInventoryItemNameChange}
          editable={editable}
          autoCorrect={false}
          autoCapitalize="words"
          placeholder={t("recipes.field.inventoryPlaceholder")}
          placeholderTextColor={colors.faint}
          style={styles.builderInput}
        />
        <Text style={styles.inventoryHint} accessibilityLiveRegion="polite">
          {inventoryHint}
        </Text>
        <View style={styles.chipRow}>
          {inventorySearchMatches.map((item) => (
            <SuggestionChip
              key={item.id}
              label={`${item.item_name} · ${item.unit}`}
              active={selectedInventoryItem?.id === item.id}
              disabled={!editable}
              icon={
                <Package
                  size={13}
                  color={selectedInventoryItem?.id === item.id ? colors.surface : colors.text}
                  strokeWidth={2.4}
                />
              }
              onPress={() => onInventoryItemSelect(item)}
            />
          ))}
        </View>
      </View>

      <View style={styles.quantityBuilderRow}>
        <View style={styles.quantityBuilderField}>
          <Text style={styles.inputLabel}>{t("recipes.field.quantity")}</Text>
          <TextInput
            accessibilityLabel={t("recipes.field.quantity")}
            accessibilityState={{ disabled: !editable }}
            value={quantity}
            onChangeText={onQuantityChange}
            editable={editable}
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
        icon={<Plus size={17} color={colors.surface} strokeWidth={2.5} />}
        onPress={onAdd}
        disabled={!editable}
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

function RecipeRow({
  item,
  canManage,
  formEditable,
  savingMappingId,
  onSave,
  onUnlink
}: {
  item: RecipeBaselineItem;
  canManage: boolean;
  formEditable: boolean;
  savingMappingId: string | null;
  onSave: (mappingId: string, quantity: string) => void;
  onUnlink: (mappingId: string, ingredientName: string, dishName: string) => void;
}) {
  const { formatNumber, t } = useLocale();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const hasIncompatibleUnits = item.ingredients.some((ingredient) => !ingredient.unitCompatible);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(item.ingredients.map((ingredient) => [ingredient.mappingId, formatNumber(ingredient.quantityUsedPerSale)]))
    );
  }, [formatNumber, item]);

  return (
    <View style={styles.recipeRow}>
      <View style={[styles.statusRail, hasIncompatibleUnits && styles.statusRailCaution]} />
      <View style={styles.recipeLead}>
        <IconBadge tone={hasIncompatibleUnits ? "caution" : "leaf"}>
          {hasIncompatibleUnits ? (
            <AlertTriangle size={18} color={colors.caution} strokeWidth={2.4} />
          ) : (
            <Link2 size={18} color={colors.success} strokeWidth={2.4} />
          )}
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
          <View style={styles.ingredientList}>
            {item.ingredients.map((ingredient) => {
              const draftValue = drafts[ingredient.mappingId] ?? formatNumber(ingredient.quantityUsedPerSale);
              const isSaving = savingMappingId === ingredient.mappingId;
              const isBusy = savingMappingId !== null;
              const displayUnit = ingredient.unitCompatible
                ? ingredient.unit
                : ingredient.inventoryUnit || ingredient.unit;

              return (
                <View
                  key={ingredient.mappingId}
                  style={[
                    styles.ingredientEditor,
                    !ingredient.unitCompatible && styles.ingredientEditorCaution
                  ]}
                >
                  <View style={styles.ingredientTextBlock}>
                    <Text style={styles.ingredientName}>{ingredient.itemName}</Text>
                    <Text style={styles.ingredientUnit}>
                      {ingredient.unitCompatible
                        ? t("recipes.row.perSale")
                        : t("recipes.row.unitMismatch", {
                            recipeUnit: ingredient.unit,
                            inventoryUnit: ingredient.inventoryUnit || "--"
                          })}
                    </Text>
                  </View>
                  <View style={styles.ingredientControls}>
                    <View style={styles.quantityEdit}>
                      {canManage ? (
                        <TextInput
                          value={draftValue}
                          onChangeText={(value) => setDrafts((current) => ({ ...current, [ingredient.mappingId]: value }))}
                          editable={formEditable && !isBusy}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          accessibilityLabel={t("recipes.row.quantityAccessibility", { ingredient: ingredient.itemName })}
                          accessibilityState={{ disabled: !formEditable || isBusy }}
                          style={styles.quantityInput}
                        />
                      ) : (
                        <Text
                          accessibilityLabel={t("recipes.row.readOnlyAccessibility", {
                            ingredient: ingredient.itemName,
                            quantity: draftValue,
                            unit: displayUnit
                          })}
                          style={styles.readOnlyQuantity}
                        >
                          {draftValue}
                        </Text>
                      )}
                      <Text style={styles.quantityUnit} numberOfLines={1}>
                        {displayUnit}
                      </Text>
                    </View>
                    {canManage ? (
                      <View style={styles.ingredientActions}>
                        <Button
                          title={t(
                            isSaving
                              ? "recipes.action.saving"
                              : ingredient.unitCompatible
                                ? "recipes.action.save"
                                : "recipes.action.fixUnit"
                          )}
                          accessibilityLabel={t(
                            ingredient.unitCompatible
                              ? "recipes.action.saveAccessibility"
                              : "recipes.action.fixUnitAccessibility",
                            { ingredient: ingredient.itemName }
                          )}
                          variant="secondary"
                          icon={<Save size={15} color={colors.text} strokeWidth={2.5} />}
                          disabled={!formEditable || isBusy}
                          onPress={() => onSave(ingredient.mappingId, draftValue)}
                          style={styles.saveButton}
                        />
                        <Button
                          title={t("recipes.action.unlink")}
                          accessibilityLabel={t("recipes.action.unlinkAccessibility", { ingredient: ingredient.itemName })}
                          variant="danger"
                          icon={<Unlink size={15} color={colors.surface} strokeWidth={2.5} />}
                          disabled={!formEditable || isBusy}
                          onPress={() => onUnlink(ingredient.mappingId, ingredient.itemName, item.menu_item_name)}
                          style={styles.unlinkButton}
                        />
                      </View>
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
  mappedSearchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  mappedSearchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0
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
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
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
  inventoryHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
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
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900"
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
  statusRailCaution: {
    backgroundColor: colors.caution
  },
  ingredientEditorCaution: {
    borderColor: colors.caution,
    backgroundColor: colors.surfaceWarm
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
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1
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
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800"
  },
  ingredientActions: {
    gap: 8,
    minWidth: 100
  },
  saveButton: {
    minHeight: 48,
    width: 100,
    paddingHorizontal: 8
  },
  unlinkButton: {
    minHeight: 48,
    width: 100,
    paddingHorizontal: 8
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.48
  }
});

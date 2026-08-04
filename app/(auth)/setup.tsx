import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  ChefHat,
  FileSpreadsheet,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  Truck
} from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProduceCrateIllustration, SupplierBagIllustration } from "../../components/ui/MiseIllustrations";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import {
  SetupAddButton,
  SetupBulletRow,
  SetupChecklistCard,
  SetupImportRow
} from "../../components/ui/SetupChecklist";
import { SetupStepRail, type SetupStepRailItem } from "../../components/ui/SetupStepRail";
import { colors, fontFamilies, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey, MessageValues } from "../../i18n/catalog";
import {
  buildSetupDraftReadiness,
  parseSetupPosSalesCsv,
  recipeDraftsToBaselineText,
  type SetupInventoryDraftItem,
  type SetupRecipeDraft,
  type SetupRecipeIngredientDraft,
  type SetupStepId,
  type SetupSupplierDraft
} from "../../services/domain/setupDrafts";
import {
  resolveSetupRecipeIngredient,
  searchSetupInventoryForPicker
} from "../../services/domain/setupRecipeLinking";
import {
  createDemoSetupStarterDrafts,
  DEMO_DATASET,
  DEMO_SETUP_POS_SALES_PLACEHOLDER,
  isDemoDatasetRestaurantName
} from "../../services/demoData";
import { saveRestaurantSetup, updateRestaurantProfile } from "../../services/miseService";
import {
  presentSetupCreateNoticeCopy,
  presentSetupFormBusy,
  presentSetupFormEditable,
  resolveSetupCreateFailureReason,
  type SetupCreateNoticeReason
} from "../../services/presentation/setupCreatePresentation";
import { canUpdateRestaurantProfile } from "../../services/tenantAccess";
import { captureMiseError, trackMiseEvent } from "../../services/telemetry";
import { operatingLimits } from "../../services/miseValidation";
import type { PosProvider } from "../../types/mise";

const posOptions: PosProvider[] = ["Toast", "Square", "Clover", "Lightspeed"];
const orderDays = ["Mon", "Thu", "Fri"];
const stylesOptions = ["Conservative", "Balanced", "Lean"] as const;
const stepOrder: SetupStepId[] = ["profile", "inventory", "recipes", "email"];
type TranslateFunction = (key: MessageKey, values?: MessageValues) => string;

type SetupNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const NOTICE_COPY_KEYS: Record<
  SetupCreateNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  profileContinue: {
    title: "setup.error.notice.profileContinueTitle",
    message: "setup.error.profileContinue"
  },
  profileNavigate: {
    title: "setup.error.notice.profileNavigateTitle",
    message: "setup.error.profileNavigate"
  },
  validation: {
    title: "setup.error.notice.validationTitle",
    message: "setup.error.noticeTitle"
  },
  createFailed: {
    title: "setup.error.notice.createFailedTitle",
    message: "setup.error.create"
  }
};

export default function SetupScreen() {
  const { formatList, formatNumber, parseNumber, t } = useLocale();
  const {
    authUser,
    canUseDemoMode,
    clearWorkspaceAccessUnverified,
    continueWithDemo,
    createRestaurant,
    isDemoMode,
    memberships,
    ready,
    restaurant,
    workspaceAccessUnverified
  } = useMiseSession();
  const isDemoSetup = canUseDemoMode && (!authUser || isDemoMode);
  const canConfigure = Boolean(
    isDemoSetup ||
    (authUser && !restaurant) ||
    (restaurant && canUpdateRestaurantProfile(memberships, restaurant.id))
  );
  const starterDrafts = useMemo(() => createDemoSetupStarterDrafts(), []);
  const submissionLockRef = useRef(false);
  const [activeStep, setActiveStep] = useState<SetupStepId>("profile");
  const [restaurantName, setRestaurantName] = useState(
    isDemoSetup ? DEMO_DATASET.restaurant.name : restaurant?.name ?? ""
  );
  const [cuisineType, setCuisineType] = useState(
    isDemoSetup ? DEMO_DATASET.restaurant.cuisineType : restaurant?.cuisine_type ?? ""
  );
  const [posProvider, setPosProvider] = useState<PosProvider>(DEMO_DATASET.defaultPosProvider);
  const [inventoryItems, setInventoryItems] = useState<SetupInventoryDraftItem[]>(
    isDemoSetup ? starterDrafts.inventoryItems : []
  );
  const [suppliers, setSuppliers] = useState<SetupSupplierDraft[]>(isDemoSetup ? starterDrafts.suppliers : []);
  const [recipes, setRecipes] = useState<SetupRecipeDraft[]>(isDemoSetup ? starterDrafts.recipes : []);
  const [posSalesCsvText, setPosSalesCsvText] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Mon", "Thu"]);
  const [orderingStyle, setOrderingStyle] = useState<(typeof stylesOptions)[number]>("Balanced");
  const [readyName, setReadyName] = useState<string | null>(null);
  const [skippedRecipeIngredients, setSkippedRecipeIngredients] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<SetupNotice | null>(null);
  const [workspaceAccessNotice, setWorkspaceAccessNotice] = useState(false);
  const seededSetupKeyRef = useRef<string | null>(null);
  const busy = presentSetupFormBusy(loading, submissionLockRef.current);
  const formEditable = presentSetupFormEditable(canConfigure, busy);

  function clearNotice() {
    if (notice) setNotice(null);
  }

  function noticeFor(
    reason: SetupCreateNoticeReason,
    messageOverride?: string
  ): SetupNotice {
    const localized = (Object.keys(NOTICE_COPY_KEYS) as SetupCreateNoticeReason[]).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(NOTICE_COPY_KEYS[key].title),
          message: t(NOTICE_COPY_KEYS[key].message)
        };
        return acc;
      },
      {} as Record<SetupCreateNoticeReason, { title: string; message: string }>
    );
    if (reason === "validation" && messageOverride) {
      localized.validation.message = messageOverride;
    }
    return presentSetupCreateNoticeCopy(reason, localized);
  }

  useEffect(() => {
    if (!ready || submissionLockRef.current || readyName) return;
    const setupKey = isDemoSetup ? "local-demo" : restaurant?.id ?? `new:${authUser?.id ?? "signed-out"}`;
    if (seededSetupKeyRef.current === setupKey) return;
    seededSetupKeyRef.current = setupKey;
    setActiveStep("profile");
    setRestaurantName(isDemoSetup ? DEMO_DATASET.restaurant.name : restaurant?.name ?? "");
    setCuisineType(isDemoSetup ? DEMO_DATASET.restaurant.cuisineType : restaurant?.cuisine_type ?? "");
    setPosProvider(DEMO_DATASET.defaultPosProvider);
    setInventoryItems(isDemoSetup ? starterDrafts.inventoryItems : []);
    setSuppliers(isDemoSetup ? starterDrafts.suppliers : []);
    setRecipes(isDemoSetup ? starterDrafts.recipes : []);
    setPosSalesCsvText("");
    setSelectedDays(["Mon", "Thu"]);
    setOrderingStyle("Balanced");
    setNotice(null);
  }, [authUser?.id, isDemoSetup, ready, readyName, restaurant?.cuisine_type, restaurant?.id, restaurant?.name, starterDrafts]);

  useEffect(() => {
    if (!ready || !workspaceAccessUnverified) return;
    // Fail-closed membership clear: explain why the operator landed on setup without a workspace.
    setWorkspaceAccessNotice(true);
    clearWorkspaceAccessUnverified();
  }, [clearWorkspaceAccessUnverified, ready, workspaceAccessUnverified]);

  const posSalesImport = useMemo(() => parseSetupPosSalesCsv(posSalesCsvText), [posSalesCsvText]);

  const readiness = useMemo(
    () =>
      buildSetupDraftReadiness({
        restaurantName,
        cuisineType,
        inventoryItems,
        suppliers,
        recipes,
        posSales: posSalesImport.rows,
        emailConnected: false
      }),
    [cuisineType, inventoryItems, posSalesImport.rows, recipes, restaurantName, suppliers]
  );

  const setupSteps = useMemo(
    () =>
      stepOrder.map((step) => ({
        id: step,
        label: labelForStep(t, step),
        status: activeStep === step ? "active" : readiness[`${step}Ready` as keyof typeof readiness] ? "complete" : "missing"
      })) satisfies SetupStepRailItem[],
    [activeStep, readiness, t]
  );

  async function openDemoKitchen() {
    if (submissionLockRef.current || !formEditable) return;
    const validationError = validateSetupDrafts({
      restaurantName,
      cuisineType,
      inventoryItems,
      suppliers,
      recipes,
      posSalesCsvText,
      posSalesIssues: posSalesImport.issues.length,
      formatNumber,
      parseNumber,
      t
    });
    if (validationError) {
      setNotice(noticeFor("validation", validationError.message));
      setActiveStep(validationError.step);
      return;
    }

    submissionLockRef.current = true;
    setLoading(true);
    clearNotice();
    try {
      const normalizedInventoryItems = normalizeInventoryDraftNumbers(inventoryItems, parseNumber);
      const normalizedRecipes = normalizeRecipeDraftNumbers(recipes, parseNumber);
      const supplierNames = suppliers.map((supplier) => supplier.name.trim()).filter(Boolean);
      const inventoryItemNames = normalizedInventoryItems.map((item) => item.name.trim()).filter(Boolean);
      const recipeBaselineText = recipeDraftsToBaselineText(normalizedRecipes);
      const posSales = posSalesImport.rows;
      let skippedRecipeIngredientCount = 0;

      if (isDemoSetup) {
        const useDefaultDemoDataset = isDemoDatasetRestaurantName(restaurantName);
        await continueWithDemo({
          preset: useDefaultDemoDataset ? DEMO_DATASET.id : undefined,
          name: restaurantName,
          cuisine_type: cuisineType,
          posProvider,
          supplierNames,
          inventoryItemNames,
          recipeBaselineText,
          posSales
        });
      } else {
        const operationalProfile = {
          serviceStyle: "fast_casual" as const,
          orderCadence: selectedDays,
          prepWindows: ["Pre-service count", "Post-service review"],
          primarySuppliers: supplierNames,
          inventoryReviewDays: selectedDays,
          notes: [
            `Ordering style: ${orderingStyle}.`,
            recipeBaselineText ? "Recipe baselines provided during onboarding." : "Recipe baselines pending.",
            posSales.length > 0 ? `${posSales.length} POS sales rows imported during setup.` : "POS import pending."
          ].filter(Boolean).join(" ")
        };
        const nextRestaurant = restaurant
          ? await updateRestaurantProfile(restaurant.id, {
              name: restaurantName,
              cuisine_type: cuisineType,
              operational_profile: operationalProfile,
              service_style: operationalProfile.serviceStyle
            })
          : await createRestaurant({
              name: restaurantName,
              cuisine_type: cuisineType,
              operational_profile: operationalProfile
            });
        const setupSummary = await saveRestaurantSetup(nextRestaurant.id, {
          inventoryItems: normalizedInventoryItems,
          suppliers,
          recipes: normalizedRecipes,
          posSales,
          attachments: []
        });
        skippedRecipeIngredientCount = setupSummary.skippedRecipeIngredients;
        setSkippedRecipeIngredients(skippedRecipeIngredientCount);
      }
      trackMiseEvent("setup_completed", {
        mode: isDemoSetup ? "demo" : "tenant",
        inventory_count: inventoryItems.filter((item) => item.name.trim()).length,
        supplier_count: suppliers.filter((supplier) => supplier.name.trim()).length,
        recipe_count: recipes.filter((recipe) => recipe.dishName.trim()).length,
        pos_sales_rows: posSalesImport.rows.length,
        skipped_recipe_ingredients: skippedRecipeIngredientCount,
        attachment_count: 0
      });
      setReadyName(restaurantName);
    } catch (error) {
      captureMiseError(error, {
        flow: "setup_create",
        operation: isDemoSetup ? "start_demo" : "create_restaurant"
      });
      setNotice(noticeFor(resolveSetupCreateFailureReason(error)));
    } finally {
      submissionLockRef.current = false;
      setLoading(false);
    }
  }

  function nextStep() {
    if (submissionLockRef.current || busy) return;
    clearNotice();
    if (activeStep === "profile" && (!restaurantName.trim() || !cuisineType.trim())) {
      setNotice(noticeFor("profileContinue"));
      return;
    }
    const currentIndex = stepOrder.indexOf(activeStep);
    if (currentIndex < stepOrder.length - 1) {
      const next = stepOrder[currentIndex + 1];
      if (next) setActiveStep(next);
      return;
    }
    void openDemoKitchen();
  }

  function selectStep(step: SetupStepId) {
    if (step !== "profile" && (!restaurantName.trim() || !cuisineType.trim())) {
      setActiveStep("profile");
      setNotice(noticeFor("profileNavigate"));
      return;
    }
    clearNotice();
    setActiveStep(step);
  }

  function toggleDay(day: string) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]
    );
  }

  if (!ready) {
    return <Screen title={t("setup.title")} subtitle={t("setup.loadingPermissions")} loading />;
  }

  if (!canConfigure) {
    const needsSignIn = !authUser;
    return (
      <Screen
        title={t("setup.title")}
        subtitle={t(needsSignIn ? "setup.access.signInSubtitle" : "setup.access.roleSubtitle")}
      >
        <StatusNotice
          tone="warning"
          title={t(needsSignIn ? "setup.access.signInTitle" : "setup.access.roleTitle")}
          message={t(needsSignIn ? "setup.access.signInBody" : "setup.access.roleBody")}
        />
        <Button
          title={t(needsSignIn ? "setup.access.signInAction" : "setup.access.returnAction")}
          onPress={() => router.replace(needsSignIn ? "/login" : "/today")}
          fullWidth
          style={styles.accessButton}
        />
        {needsSignIn ? (
          <Button
            title={t("setup.access.createAccountAction")}
            variant="secondary"
            onPress={() => router.replace("/signup")}
            fullWidth
            style={styles.accessButton}
          />
        ) : null}
      </Screen>
    );
  }

  if (readyName) {
    const localizedDays = formatList(selectedDays.map((day) => dayLabel(t, day)));
    const importedRows = posSalesImport.rows.length;
    return (
      <Screen title={t("setup.ready.title")} subtitle={t("setup.ready.subtitle", { restaurant: readyName })}>
        <Card tone="warm">
          <View style={styles.statusRow}>
            <CheckCircle size={19} color={colors.success} strokeWidth={2.5} />
            <Text style={styles.status}>
              {isDemoSetup
                ? t("setup.ready.demoStatus", { provider: posProvider })
                : t("setup.ready.hostedStatus")}
            </Text>
          </View>
          <Text style={styles.title}>{t("setup.ready.complete")}</Text>
          <Text style={styles.copy}>{t("setup.ready.body")}</Text>
          <Text style={styles.setupSummary}>
            {t("setup.ready.summary", {
              style: styleLabel(t, orderingStyle),
              days: localizedDays || t("common.notSet")
            })}
            {importedRows > 0
              ? ` ${t(importedRows === 1 ? "setup.ready.imported.one" : "setup.ready.imported.other", {
                  count: formatNumber(importedRows)
                })}`
              : ""}
            {skippedRecipeIngredients > 0
              ? ` ${t(
                  skippedRecipeIngredients === 1
                    ? "setup.ready.skippedRecipes.one"
                    : "setup.ready.skippedRecipes.other",
                  { count: formatNumber(skippedRecipeIngredients) }
                )}`
              : ""}
          </Text>
          {skippedRecipeIngredients > 0 ? (
            <Button
              title={t("setup.ready.reviewRecipes")}
              variant="secondary"
              onPress={() => router.replace("/settings/recipes")}
              fullWidth
              style={styles.button}
            />
          ) : null}
          <Button title={t("setup.ready.openToday")} onPress={() => router.replace("/today")} fullWidth style={styles.button} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={t(isDemoSetup ? "setup.main.demoTitle" : "setup.main.hostedTitle")}
      subtitle={t(isDemoSetup ? "setup.main.demoSubtitle" : "setup.main.hostedSubtitle")}
      keyboardAware
    >
      <View style={styles.stack}>
        {workspaceAccessNotice ? (
          <StatusNotice
            tone="caution"
            title={t("setup.access.unverifiedTitle")}
            message={t("setup.access.unverifiedBody")}
          />
        ) : null}

        <SetupStepRail steps={setupSteps} onStepPress={(step) => selectStep(step as SetupStepId)} />

        {activeStep === "profile" ? (
          <SetupChecklistCard
            title={t("setup.step.profile")}
            description={t("setup.profile.description")}
          >
            <Field label={t("setup.profile.restaurantName")} value={restaurantName} onChangeText={setRestaurantName} />
            <Field label={t("setup.profile.cuisine")} value={cuisineType} onChangeText={setCuisineType} />
            {isDemoSetup ? (
              <>
                <Text style={styles.fieldGroupTitle}>{t("setup.profile.demoSource")}</Text>
                <View style={styles.chips}>
                  {posOptions.map((provider) => (
                    <ChoiceChip key={provider} label={provider} selected={provider === posProvider} onPress={() => setPosProvider(provider)} />
                  ))}
                </View>
              </>
            ) : null}
          </SetupChecklistCard>
        ) : null}

        {activeStep === "inventory" ? (
          <>
            <SetupChecklistCard
              title={t("setup.inventory.title")}
              description={t("setup.inventory.description")}
            >
              {inventoryItems.length === 0 ? (
                <>
                  <EmptyState
                    compact
                    title={t("setup.inventory.emptyTitle")}
                    body={t("setup.inventory.emptyBody")}
                    illustration={<ProduceCrateIllustration />}
                  />
                  <SetupAddButton
                    title={t("setup.inventory.addFirst")}
                    onPress={() => {
                      trackMiseEvent("inventory_item_added", { stage: "setup_first" });
                      setInventoryItems((current) => [...current, createInventoryDraft()]);
                    }}
                  />
                </>
              ) : (
                <>
                  {inventoryItems.map((item) => (
                    <InventoryDraftRow
                      key={item.id}
                      item={item}
                      onChange={(patch) => updateInventoryItem(item.id, patch, setInventoryItems)}
                      onRemove={() => removeDraft(item.id, setInventoryItems)}
                    />
                  ))}
                  <SetupAddButton
                    title={t("setup.inventory.addAnother")}
                    onPress={() => {
                      trackMiseEvent("inventory_item_added", { stage: "setup_additional" });
                      setInventoryItems((current) => [...current, createInventoryDraft()]);
                    }}
                  />
                </>
              )}
            </SetupChecklistCard>

            <SetupChecklistCard title={t("setup.suppliers.title")} description={t("setup.suppliers.description")}>
              {suppliers.length === 0 ? (
                <EmptyState
                  compact
                  title={t("setup.suppliers.emptyTitle")}
                  body={t("setup.suppliers.emptyBody")}
                  illustration={<SupplierBagIllustration />}
                />
              ) : (
                suppliers.map((supplier) => (
                  <SupplierDraftRow
                    key={supplier.id}
                    supplier={supplier}
                    onChange={(patch) => updateSupplier(supplier.id, patch, setSuppliers)}
                    onRemove={() => removeDraft(supplier.id, setSuppliers)}
                  />
                ))
              )}
            <SetupAddButton title={t("setup.suppliers.add")} onPress={() => setSuppliers((current) => [...current, createSupplierDraft()])} />
            </SetupChecklistCard>
          </>
        ) : null}

        {activeStep === "recipes" ? (
          <SetupChecklistCard
            title={t("setup.recipes.title")}
            description={t("setup.recipes.description")}
          >
            {recipes.length === 0 ? (
              <EmptyState
                compact
                title={t("setup.recipes.emptyTitle")}
                body={t("setup.recipes.emptyBody")}
                illustration={<ProduceCrateIllustration />}
              />
            ) : (
              recipes.map((recipe) => (
                <RecipeDraftEditor
                  key={recipe.id}
                  recipe={recipe}
                  inventoryItems={inventoryItems}
                  onChange={(patch) => updateRecipe(recipe.id, patch, setRecipes)}
                  onRemove={() => removeDraft(recipe.id, setRecipes)}
                />
              ))
            )}
            <SetupAddButton
              title={t("setup.recipes.add")}
              onPress={() => {
                trackMiseEvent("recipe_mapped", { stage: "setup_started" });
                setRecipes((current) => [...current, createRecipeDraft()]);
              }}
            />
          </SetupChecklistCard>
        ) : null}

        {activeStep === "email" ? (
          <>
            <SetupChecklistCard title={t("setup.rhythm.title")} description={t("setup.rhythm.description")}>
              <Text style={styles.fieldGroupTitle}>{t("setup.rhythm.days")}</Text>
              <View style={styles.chips}>
                {orderDays.map((day) => (
                  <ChoiceChip key={day} label={dayLabel(t, day)} selected={selectedDays.includes(day)} onPress={() => toggleDay(day)} />
                ))}
              </View>
              <Text style={styles.fieldGroupTitle}>{t("setup.rhythm.style")}</Text>
              <View style={styles.chips}>
                {stylesOptions.map((option) => (
                  <ChoiceChip key={option} label={styleLabel(t, option)} selected={option === orderingStyle} onPress={() => setOrderingStyle(option)} />
                ))}
              </View>
            </SetupChecklistCard>

            <SetupChecklistCard
              title={t("setup.pos.title")}
              description={t("setup.pos.description")}
            >
              <SetupImportRow
                title={t("setup.pos.pasteTitle")}
                detail={t("setup.pos.format")}
                icon={<FileSpreadsheet size={18} color={colors.text} strokeWidth={2.4} />}
              />
              <TextInput
                accessibilityLabel={t("setup.pos.accessibility")}
                accessibilityHint={t("setup.pos.hint")}
                value={posSalesCsvText}
                onChangeText={setPosSalesCsvText}
                style={styles.textArea}
                multiline
                textAlignVertical="top"
                placeholder={DEMO_SETUP_POS_SALES_PLACEHOLDER}
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
              />
              {posSalesImport.acceptedRowCount > 0 ? (
                <SetupBulletRow
                  title={t(
                    posSalesImport.acceptedRowCount === 1 ? "setup.pos.ready.one" : "setup.pos.ready.other",
                    { count: formatNumber(posSalesImport.acceptedRowCount) }
                  )}
                  detail={t("setup.pos.readyDetail")}
                  complete
                />
              ) : (
                <SetupBulletRow
                  title={t(isDemoSetup ? "setup.pos.demoAvailable" : "setup.pos.noRows")}
                  detail={t(isDemoSetup ? "setup.pos.demoDetail" : "setup.pos.noRowsDetail")}
                />
              )}
              {posSalesImport.issues.slice(0, 3).map((issue) => (
                <SetupBulletRow
                  key={`${issue.row}_${issue.field}`}
                  title={t("setup.pos.issueTitle", { row: formatNumber(issue.row), field: issue.field })}
                  detail={t("setup.pos.issueDetail")}
                />
              ))}
            </SetupChecklistCard>

          </>
        ) : null}

        {notice ? (
          <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
        ) : null}

        <View style={styles.footerPanel}>
          <View style={styles.footerStatus}>
            {isDemoSetup ? <ChefHat size={18} color={colors.accent} strokeWidth={2.5} /> : <ShieldCheck size={18} color={colors.text} strokeWidth={2.5} />}
            <Text style={styles.status}>
              {t("setup.footer.progress", {
                complete: formatNumber(setupSteps.filter((step) => step.status === "complete").length),
                total: formatNumber(setupSteps.length)
              })}
            </Text>
          </View>
          <Button
            title={activeStep === "email"
              ? loading
                ? t("setup.action.starting")
                : t(isDemoSetup ? "setup.action.startDemo" : "setup.action.create")
              : t("setup.action.continue")}
            accessibilityLabel={activeStep === "email"
              ? t(isDemoSetup ? "setup.action.startDemoAccessibility" : "setup.action.createAccessibility")
              : t("setup.action.continueTo", {
                  step: labelForStep(t, stepOrder[stepOrder.indexOf(activeStep) + 1] ?? "email")
                })}
            accessibilityState={{ disabled: loading, busy: loading }}
            onPress={nextStep}
            disabled={loading}
            fullWidth
            style={styles.button}
          />
          {isDemoSetup ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("setup.action.skipAccessibility")}
              accessibilityState={{ disabled: loading, busy: loading }}
              disabled={loading}
              onPress={() => void openDemoKitchen()}
              style={({ pressed }) => [styles.skipButton, loading && styles.disabled, pressed && !loading && styles.pressed]}
            >
              <Text style={styles.skipText}>{t("setup.action.skip")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function InventoryDraftRow({
  item,
  onChange,
  onRemove
}: {
  item: SetupInventoryDraftItem;
  onChange: (patch: Partial<SetupInventoryDraftItem>) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  return (
    <View style={styles.draftPanel}>
      <View style={styles.draftHeader}>
        <Package size={18} color={colors.caution} strokeWidth={2.5} />
        <TextInput
          accessibilityLabel={t("setup.field.inventoryName")}
          value={item.name}
          onChangeText={(name) => onChange({ name })}
          style={styles.draftTitleInput}
          placeholder={t("setup.field.inventoryPlaceholder")}
          placeholderTextColor={colors.faint}
        />
        <IconPress
          label={t("setup.remove.inventory", { item: item.name || t("setup.fallback.inventory") })}
          onPress={onRemove}
        />
      </View>
      <View style={styles.formGrid}>
        <MiniField label={t("setup.field.onHand")} value={item.quantity} onChangeText={(quantity) => onChange({ quantity })} keyboardType="decimal-pad" />
        <MiniField label={t("setup.field.unit")} value={item.unit} onChangeText={(unit) => onChange({ unit })} />
        <MiniField label={t("setup.field.par")} value={item.parLevel} onChangeText={(parLevel) => onChange({ parLevel })} keyboardType="decimal-pad" />
      </View>
      <Field label={t("setup.field.supplier")} value={item.supplier} onChangeText={(supplier) => onChange({ supplier })} compact />
    </View>
  );
}

function SupplierDraftRow({
  supplier,
  onChange,
  onRemove
}: {
  supplier: SetupSupplierDraft;
  onChange: (patch: Partial<SetupSupplierDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  return (
    <View style={styles.draftPanel}>
      <View style={styles.draftHeader}>
        <Truck size={18} color={colors.success} strokeWidth={2.5} />
        <TextInput
          accessibilityLabel={t("setup.field.supplierName")}
          value={supplier.name}
          onChangeText={(name) => onChange({ name })}
          style={styles.draftTitleInput}
          placeholder={t("setup.field.supplierName")}
          placeholderTextColor={colors.faint}
        />
        <IconPress
          label={t("setup.remove.supplier", { supplier: supplier.name || t("setup.fallback.supplier") })}
          onPress={onRemove}
        />
      </View>
      <Field label={t("setup.field.email")} value={supplier.email} onChangeText={(email) => onChange({ email })} compact keyboardType="email-address" />
    </View>
  );
}

function RecipeDraftEditor({
  recipe,
  inventoryItems,
  onChange,
  onRemove
}: {
  recipe: SetupRecipeDraft;
  inventoryItems: SetupInventoryDraftItem[];
  onChange: (patch: Partial<SetupRecipeDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  const namedInventoryCount = inventoryItems.filter((item) => item.name.trim()).length;

  function updateIngredient(id: string, patch: Partial<SetupRecipeIngredientDraft>) {
    onChange({
      ingredients: recipe.ingredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...patch } : ingredient
      )
    });
  }

  function handleIngredientNameChange(ingredient: SetupRecipeIngredientDraft, itemName: string) {
    const resolved = resolveSetupRecipeIngredient(inventoryItems, {
      itemName,
      inventoryItemId: null
    });
    updateIngredient(ingredient.id, {
      itemName,
      inventoryItemId: resolved?.id ?? null,
      ...(resolved && resolved.id !== ingredient.inventoryItemId
        ? { unit: resolved.unit.trim() || ingredient.unit || "unit" }
        : {})
    });
  }

  function handleIngredientSelect(ingredient: SetupRecipeIngredientDraft, item: SetupInventoryDraftItem) {
    updateIngredient(ingredient.id, {
      itemName: item.name.trim(),
      inventoryItemId: item.id,
      unit: item.unit.trim() || ingredient.unit || "unit"
    });
  }

  return (
    <View style={styles.recipePanel}>
      <View style={styles.draftHeader}>
        <ChefHat size={18} color={colors.caution} strokeWidth={2.5} />
        <TextInput
          accessibilityLabel={t("setup.field.dishName")}
          value={recipe.dishName}
          onChangeText={(dishName) => onChange({ dishName })}
          style={styles.draftTitleInput}
          placeholder={t("setup.field.dishName")}
          placeholderTextColor={colors.faint}
        />
        <IconPress
          label={t("setup.remove.recipe", { recipe: recipe.dishName || t("setup.fallback.recipe") })}
          onPress={onRemove}
        />
      </View>
      {recipe.ingredients.map((ingredient) => {
        const matches = searchSetupInventoryForPicker(inventoryItems, ingredient.itemName);
        const selected = resolveSetupRecipeIngredient(inventoryItems, ingredient);
        const queryActive = ingredient.itemName.trim().length > 0;
        const hint = selected
          ? t("setup.recipes.inventorySelected", {
              item: selected.name.trim(),
              unit: selected.unit.trim() || "unit"
            })
          : queryActive && matches.length === 0 && namedInventoryCount > 0
            ? t("setup.recipes.inventoryNoMatches")
            : queryActive && namedInventoryCount > 0
              ? t("setup.recipes.inventoryPickOne")
              : namedInventoryCount > 0
                ? t("setup.recipes.inventoryBrowse")
                : t("setup.recipes.inventoryEmpty");

        return (
          <View key={ingredient.id} style={styles.ingredientBlock}>
            <View style={styles.ingredientRow}>
              <TextInput
                accessibilityLabel={t("setup.field.recipeIngredientAccessibility", {
                  recipe: recipe.dishName || t("setup.fallback.recipe")
                })}
                accessibilityHint={t("setup.field.ingredientSearchHint")}
                value={ingredient.itemName}
                onChangeText={(itemName) => handleIngredientNameChange(ingredient, itemName)}
                style={[styles.ingredientInput, styles.ingredientNameInput]}
                placeholder={t("setup.field.ingredient")}
                placeholderTextColor={colors.faint}
                autoCorrect={false}
                autoCapitalize="words"
              />
              <TextInput
                accessibilityLabel={t("setup.field.quantityAccessibility", {
                  ingredient: ingredient.itemName || t("setup.fallback.ingredient")
                })}
                value={ingredient.quantity}
                onChangeText={(quantity) => updateIngredient(ingredient.id, { quantity })}
                style={styles.ingredientInput}
                placeholder={t("setup.field.quantityShort")}
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
              />
              <TextInput
                accessibilityLabel={t("setup.field.unitAccessibility", {
                  ingredient: ingredient.itemName || t("setup.fallback.ingredient")
                })}
                value={ingredient.unit}
                onChangeText={(unit) => updateIngredient(ingredient.id, { unit })}
                style={styles.ingredientInput}
                placeholder={t("setup.field.unit")}
                placeholderTextColor={colors.faint}
              />
            </View>
            {namedInventoryCount > 0 ? (
              <>
                <Text style={styles.ingredientHint} accessibilityLiveRegion="polite">
                  {hint}
                </Text>
                <View style={styles.ingredientChipRow}>
                  {matches.map((match) => {
                    const active = selected?.id === match.item.draft.id;
                    return (
                      <Pressable
                        key={match.item.draft.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${match.item.item_name} · ${match.item.unit}`}
                        accessibilityState={{ selected: active }}
                        onPress={() => handleIngredientSelect(ingredient, match.item.draft)}
                        style={({ pressed }) => [
                          styles.ingredientChip,
                          active && styles.ingredientChipActive,
                          pressed && styles.pressed
                        ]}
                      >
                        <Package
                          size={13}
                          color={active ? colors.surface : colors.text}
                          strokeWidth={2.4}
                        />
                        <Text
                          style={[styles.ingredientChipText, active && styles.ingredientChipTextActive]}
                          numberOfLines={1}
                        >
                          {`${match.item.item_name} · ${match.item.unit}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        );
      })}
      <Pressable
        accessibilityLabel={t("setup.addIngredientAccessibility", {
          recipe: recipe.dishName || t("setup.fallback.recipe")
        })}
        onPress={() => onChange({ ingredients: [...recipe.ingredients, createRecipeIngredientDraft()] })}
        style={styles.inlineAdd}
        accessibilityRole="button"
      >
        <Plus size={16} color={colors.accent} strokeWidth={2.5} />
        <Text style={styles.inlineAddText}>{t("setup.addIngredient")}</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  compact,
  keyboardType
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  compact?: boolean;
  keyboardType?: "default" | "email-address" | "decimal-pad";
}) {
  return (
    <View style={[styles.field, compact && styles.compactField]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function MiniField({
  label,
  value,
  onChangeText,
  keyboardType
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "decimal-pad";
}) {
  return (
    <View style={styles.miniField}>
      <Text style={styles.miniLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        style={styles.miniInput}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selectedChip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

function IconPress({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.iconPress} accessibilityRole="button">
      <Trash2 size={16} color={colors.faint} strokeWidth={2.4} />
    </Pressable>
  );
}

function updateInventoryItem(
  id: string,
  patch: Partial<SetupInventoryDraftItem>,
  setInventoryItems: (update: (current: SetupInventoryDraftItem[]) => SetupInventoryDraftItem[]) => void
) {
  setInventoryItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

function updateSupplier(
  id: string,
  patch: Partial<SetupSupplierDraft>,
  setSuppliers: (update: (current: SetupSupplierDraft[]) => SetupSupplierDraft[]) => void
) {
  setSuppliers((current) => current.map((supplier) => (supplier.id === id ? { ...supplier, ...patch } : supplier)));
}

function updateRecipe(
  id: string,
  patch: Partial<SetupRecipeDraft>,
  setRecipes: (update: (current: SetupRecipeDraft[]) => SetupRecipeDraft[]) => void
) {
  setRecipes((current) => current.map((recipe) => (recipe.id === id ? { ...recipe, ...patch } : recipe)));
}

function removeDraft<T extends { id: string }>(
  id: string,
  setter: (update: (current: T[]) => T[]) => void
) {
  setter((current) => current.filter((item) => item.id !== id));
}

function createInventoryDraft(): SetupInventoryDraftItem {
  return { id: makeLocalId("inventory"), name: "", quantity: "", unit: "lb", parLevel: "", supplier: "" };
}

function createSupplierDraft(): SetupSupplierDraft {
  return { id: makeLocalId("supplier"), name: "", email: "" };
}

function createRecipeDraft(): SetupRecipeDraft {
  return { id: makeLocalId("recipe"), dishName: "", ingredients: [createRecipeIngredientDraft()] };
}

function createRecipeIngredientDraft(): SetupRecipeIngredientDraft {
  return {
    id: makeLocalId("ingredient"),
    itemName: "",
    quantity: "",
    unit: "lb",
    inventoryItemId: null
  };
}

function validateSetupDrafts({
  restaurantName,
  cuisineType,
  inventoryItems,
  suppliers,
  recipes,
  posSalesCsvText,
  posSalesIssues,
  formatNumber,
  parseNumber,
  t
}: {
  restaurantName: string;
  cuisineType: string;
  inventoryItems: SetupInventoryDraftItem[];
  suppliers: SetupSupplierDraft[];
  recipes: SetupRecipeDraft[];
  posSalesCsvText: string;
  posSalesIssues: number;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  parseNumber: (value: string) => number | null;
  t: TranslateFunction;
}) {
  if (!restaurantName.trim() || !cuisineType.trim()) {
    return setupValidationFailure("profile", t("setup.validation.profile"));
  }

  for (const [index, item] of inventoryItems.entries()) {
    const hasDraftData = Boolean(
      item.name.trim() || item.quantity.trim() || item.parLevel.trim() || item.supplier.trim()
    );
    if (!hasDraftData) continue;
    const label = item.name.trim() || t("setup.validation.inventoryLabel", { count: formatNumber(index + 1) });
    if (!item.name.trim()) return setupValidationFailure("inventory", t("setup.validation.needsName", { item: label }));
    if (!item.quantity.trim()) return setupValidationFailure("inventory", t("setup.validation.needsQuantity", { item: label }));
    if (!item.unit.trim()) return setupValidationFailure("inventory", t("setup.validation.needsUnit", { item: label }));
    if (!isBoundedSetupNumber(item.quantity, 0, operatingLimits.inventoryQuantity, parseNumber)) {
      return setupValidationFailure(
        "inventory",
        t("setup.validation.onHandRange", {
          item: label,
          maximum: formatNumber(operatingLimits.inventoryQuantity)
        })
      );
    }
    if (item.parLevel.trim() && !isBoundedSetupNumber(item.parLevel, 0, operatingLimits.inventoryQuantity, parseNumber)) {
      return setupValidationFailure(
        "inventory",
        t("setup.validation.parRange", {
          item: label,
          maximum: formatNumber(operatingLimits.inventoryQuantity)
        })
      );
    }
  }

  for (const [index, supplier] of suppliers.entries()) {
    const name = supplier.name.trim();
    const email = supplier.email.trim();
    if (!name && email) {
      return setupValidationFailure(
        "inventory",
        t("setup.validation.supplierName", {
          supplier: t("setup.validation.supplierLabel", { count: formatNumber(index + 1) })
        })
      );
    }
    if (email && !isValidEmail(email)) {
      return setupValidationFailure(
        "inventory",
        t("setup.validation.supplierEmail", {
          supplier: name || t("setup.validation.supplierLabel", { count: formatNumber(index + 1) })
        })
      );
    }
  }

  for (const [recipeIndex, recipe] of recipes.entries()) {
    const startedIngredients = recipe.ingredients.filter(
      (ingredient) => ingredient.itemName.trim() || ingredient.quantity.trim()
    );
    const hasDraftData = Boolean(recipe.dishName.trim() || startedIngredients.length > 0);
    if (!hasDraftData) continue;
    const recipeLabel = recipe.dishName.trim() || t("setup.validation.recipeLabel", { count: formatNumber(recipeIndex + 1) });
    if (!recipe.dishName.trim()) {
      return setupValidationFailure("recipes", t("setup.validation.recipeName", { recipe: recipeLabel }));
    }
    if (startedIngredients.length === 0) {
      return setupValidationFailure("recipes", t("setup.validation.recipeIngredient", { recipe: recipeLabel }));
    }

    for (const [ingredientIndex, ingredient] of startedIngredients.entries()) {
      const ingredientLabel = ingredient.itemName.trim() || t("setup.validation.ingredientLabel", { count: formatNumber(ingredientIndex + 1) });
      if (!ingredient.itemName.trim() || !ingredient.quantity.trim() || !ingredient.unit.trim()) {
        return setupValidationFailure(
          "recipes",
          t("setup.validation.ingredientFields", { recipe: recipeLabel, ingredient: ingredientLabel })
        );
      }
      if (!isBoundedSetupNumber(ingredient.quantity, Number.EPSILON, operatingLimits.recipeQuantityPerSale, parseNumber)) {
        return setupValidationFailure(
          "recipes",
          t("setup.validation.ingredientRange", {
            recipe: recipeLabel,
            ingredient: ingredientLabel,
            maximum: formatNumber(operatingLimits.recipeQuantityPerSale)
          })
        );
      }
    }
  }

  if (posSalesCsvText.trim() && posSalesIssues > 0) {
    return setupValidationFailure(
      "email",
      t(posSalesIssues === 1 ? "setup.validation.posIssues.one" : "setup.validation.posIssues.other", {
        count: formatNumber(posSalesIssues)
      })
    );
  }

  return null;
}

function setupValidationFailure(step: SetupStepId, message: string) {
  return { step, message };
}

function isBoundedSetupNumber(
  value: string,
  minimum: number,
  maximum: number,
  parseNumber: (value: string) => number | null
) {
  const parsed = parseNumber(value);
  return parsed !== null && parsed >= minimum && parsed <= maximum;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.round(Math.random() * 10000)}`;
}

function labelForStep(t: TranslateFunction, step: SetupStepId) {
  if (step === "profile") return t("setup.step.profile");
  if (step === "inventory") return t("setup.step.inventory");
  if (step === "recipes") return t("setup.step.recipes");
  return t("setup.step.rhythm");
}

function dayLabel(t: TranslateFunction, day: string) {
  if (day === "Mon") return t("setup.day.mon");
  if (day === "Thu") return t("setup.day.thu");
  if (day === "Fri") return t("setup.day.fri");
  return day;
}

function styleLabel(t: TranslateFunction, style: (typeof stylesOptions)[number]) {
  if (style === "Conservative") return t("setup.style.conservative");
  if (style === "Lean") return t("setup.style.lean");
  return t("setup.style.balanced");
}

function normalizeInventoryDraftNumbers(
  items: SetupInventoryDraftItem[],
  parseNumber: (value: string) => number | null
) {
  return items.map((item) => ({
    ...item,
    quantity: normalizeDraftNumber(item.quantity, parseNumber),
    parLevel: normalizeDraftNumber(item.parLevel, parseNumber)
  }));
}

function normalizeRecipeDraftNumbers(
  recipes: SetupRecipeDraft[],
  parseNumber: (value: string) => number | null
) {
  return recipes.map((recipe) => ({
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: normalizeDraftNumber(ingredient.quantity, parseNumber)
    }))
  }));
}

function normalizeDraftNumber(value: string, parseNumber: (value: string) => number | null) {
  if (!value.trim()) return "";
  const parsed = parseNumber(value);
  return parsed === null ? value : String(parsed);
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  readinessList: {
    gap: 0
  },
  title: {
    color: colors.text,
    ...typography.sectionTitle
  },
  copy: {
    color: colors.muted,
    ...typography.body,
    marginTop: 8
  },
  field: {
    marginTop: 2
  },
  compactField: {
    marginTop: 10
  },
  label: {
    color: colors.text,
    ...typography.caption,
    marginBottom: 7
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    color: colors.text,
    ...typography.body
  },
  textArea: {
    minHeight: 116,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.text,
    ...typography.body
  },
  fieldGroupTitle: {
    color: colors.text,
    ...typography.caption,
    marginTop: 6
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2
  },
  chip: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  selectedChip: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accentDark
  },
  chipText: {
    color: colors.text,
    ...typography.caption
  },
  selectedChipText: {
    color: colors.surface
  },
  draftPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 9
  },
  recipePanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 9
  },
  draftHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  draftTitleInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    color: colors.text,
    ...typography.cardTitle,
    padding: 0
  },
  iconPress: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  formGrid: {
    flexDirection: "row",
    gap: 8
  },
  miniField: {
    flex: 1,
    minWidth: 0
  },
  miniLabel: {
    color: colors.muted,
    ...typography.caption,
    fontFamily: fontFamilies.medium,
    marginBottom: 5
  },
  miniInput: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    ...typography.body,
    paddingHorizontal: 10
  },
  ingredientBlock: {
    gap: 6
  },
  ingredientRow: {
    flexDirection: "row",
    gap: 7
  },
  ingredientInput: {
    flex: 0.72,
    minWidth: 0,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    ...typography.body,
    paddingHorizontal: 10
  },
  ingredientNameInput: {
    flex: 1.55
  },
  ingredientHint: {
    color: colors.muted,
    ...typography.caption
  },
  ingredientChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  ingredientChip: {
    maxWidth: "100%",
    minHeight: 36,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  ingredientChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  ingredientChipText: {
    color: colors.text,
    ...typography.caption,
    fontFamily: fontFamilies.medium,
    maxWidth: 180
  },
  ingredientChipTextActive: {
    color: colors.surface
  },
  inlineAdd: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  inlineAddText: {
    color: colors.accentDark,
    ...typography.caption
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16
  },
  footerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  setupSummary: {
    color: colors.text,
    ...typography.body,
    fontFamily: fontFamilies.semibold,
    marginTop: 14
  },
  status: {
    color: colors.text,
    ...typography.caption,
    flex: 1
  },
  button: {
    marginTop: 10
  },
  accessButton: {
    marginTop: spacing.md
  },
  footerPanel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    backgroundColor: colors.surface,
    padding: 12
  },
  skipButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  skipText: {
    color: colors.text,
    ...typography.body
  },
  pressed: {
    opacity: 0.68
  },
  disabled: {
    opacity: 0.48
  }
});

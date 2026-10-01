import { useEffect, useState } from "react";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, CalendarClock, Check, Plus, X } from "lucide-react-native";
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import {
  colors,
  fontFamilies,
  icon,
  iconStroke,
  radii,
  spacing,
  typography
} from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  OPERATING_PROFILE_PREP_PRESETS,
  OPERATING_PROFILE_WEEKDAYS,
  RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS,
  addCustomProfileString,
  buildRestaurantOperatingProfilePatch,
  draftFromOperatingProfile,
  removeProfileString,
  toggleOrderedString,
  type RestaurantOperatingProfileDraft
} from "../../services/domain/restaurantOperatingProfile";
import { updateRestaurantProfile } from "../../services/miseService";
import { canUpdateRestaurantProfile } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

type SaveStatus = "saved" | "error" | null;

const WEEKDAY_LABEL_KEYS: Record<(typeof OPERATING_PROFILE_WEEKDAYS)[number], MessageKey> = {
  Mon: "settings.operatingProfile.day.mon",
  Tue: "settings.operatingProfile.day.tue",
  Wed: "settings.operatingProfile.day.wed",
  Thu: "settings.operatingProfile.day.thu",
  Fri: "settings.operatingProfile.day.fri",
  Sat: "settings.operatingProfile.day.sat",
  Sun: "settings.operatingProfile.day.sun"
};

export default function OperatingProfileSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const {
    applyRestaurantProfile,
    isDemoMode,
    memberships,
    restaurant,
    usingLocalDemo
  } = useMiseSession();
  const canEdit = canUpdateRestaurantProfile(memberships, restaurant?.id);
  const [draft, setDraft] = useState<RestaurantOperatingProfileDraft | null>(
    restaurant ? draftFromOperatingProfile(restaurant) : null
  );
  const [customPrep, setCustomPrep] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>(null);
  const [validationKey, setValidationKey] = useState<MessageKey | null>(null);

  useEffect(() => {
    setDraft(restaurant ? draftFromOperatingProfile(restaurant) : null);
    setCustomPrep("");
    setStatus(null);
    setValidationKey(null);
  }, [
    restaurant?.id,
    restaurant?.service_style,
    restaurant?.operational_profile.orderCadence.join("|"),
    restaurant?.operational_profile.prepWindows.join("|"),
    restaurant?.operational_profile.inventoryReviewDays.join("|"),
    restaurant?.operational_profile.notes,
    restaurant?.operational_profile.primarySuppliers.join("|")
  ]);

  const persistenceMessageKey: MessageKey =
    usingLocalDemo || isDemoMode
      ? "settings.operatingProfile.demoPersistence"
      : restaurant
        ? "settings.operatingProfile.hostedPersistence"
        : "settings.operatingProfile.sessionPersistence";

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  function updateDraft<K extends keyof RestaurantOperatingProfileDraft>(
    key: K,
    value: RestaurantOperatingProfileDraft[K]
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setStatus(null);
    setValidationKey(null);
  }

  function toggleCadence(day: string) {
    if (!draft || !canEdit) return;
    updateDraft("orderCadence", toggleOrderedString(draft.orderCadence, day));
  }

  function toggleReviewDay(day: string) {
    if (!draft || !canEdit) return;
    updateDraft("inventoryReviewDays", toggleOrderedString(draft.inventoryReviewDays, day));
  }

  function togglePrepPreset(preset: string) {
    if (!draft || !canEdit) return;
    updateDraft("prepWindows", toggleOrderedString(draft.prepWindows, preset));
  }

  function addPrepWindow() {
    if (!draft || !canEdit) return;
    try {
      updateDraft("prepWindows", addCustomProfileString(draft.prepWindows, customPrep));
      setCustomPrep("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/limited to \d+ characters/i.test(message)) {
        setValidationKey("settings.operatingProfile.error.entryTooLong");
      } else if (/limited to \d+ entries/i.test(message)) {
        setValidationKey("settings.operatingProfile.error.listFull");
      } else {
        setValidationKey("settings.operatingProfile.error.invalidPrep");
      }
    }
  }

  async function handleSave() {
    if (saving || !restaurant || !draft || !canEdit) return;
    setStatus(null);
    setValidationKey(null);

    if (draft.notes.trim().length > RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS) {
      setValidationKey("settings.operatingProfile.error.notesTooLong");
      return;
    }

    const patch = buildRestaurantOperatingProfilePatch(restaurant, draft);
    if (!patch) {
      setStatus("saved");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateRestaurantProfile(restaurant.id, patch);
      await applyRestaurantProfile(updated);
      setDraft(draftFromOperatingProfile(updated));
      setStatus("saved");
      AccessibilityInfo.announceForAccessibility(
        t("settings.operatingProfile.savedAnnouncement", { name: updated.name })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/Order cadence|Inventory review/i.test(message)) {
        setValidationKey("settings.operatingProfile.error.invalidDays");
      } else if (/Prep windows/i.test(message)) {
        setValidationKey("settings.operatingProfile.error.invalidPrep");
      } else if (/notes/i.test(message)) {
        setValidationKey("settings.operatingProfile.error.notesTooLong");
      } else if (/limited to/i.test(message)) {
        setValidationKey("settings.operatingProfile.error.listFull");
      } else {
        setValidationKey(null);
      }
      captureMiseError(error, {
        flow: "settings_operating_profile",
        operation: "update_restaurant_profile",
        restaurant_id: restaurant.id
      });
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  if (!restaurant || !draft) {
    return (
      <Screen
        title={t("settings.operatingProfile.title")}
        subtitle={t("settings.operatingProfile.subtitle")}
        action={
          <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
            <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
          </ActionIcon>
        }
      >
        <Card style={styles.formCard}>
          <Text style={styles.sectionBody}>{t("settings.profile.noRestaurant")}</Text>
        </Card>
      </Screen>
    );
  }

  const customCadence = draft.orderCadence.filter(
    (day) => !(OPERATING_PROFILE_WEEKDAYS as readonly string[]).includes(day)
  );
  const customReview = draft.inventoryReviewDays.filter(
    (day) => !(OPERATING_PROFILE_WEEKDAYS as readonly string[]).includes(day)
  );
  const customPrepWindows = draft.prepWindows.filter(
    (window) => !(OPERATING_PROFILE_PREP_PRESETS as readonly string[]).includes(window)
  );

  return (
    <Screen
      title={t("settings.operatingProfile.title")}
      subtitle={t("settings.operatingProfile.subtitle")}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.stack}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{t("settings.operatingProfile.sectionTitle")}</Text>
            <Text style={styles.sectionBody}>
              {t(
                canEdit
                  ? "settings.operatingProfile.sectionBody"
                  : "settings.operatingProfile.readOnlyBody"
              )}
            </Text>
          </View>

          <Card style={styles.formCard}>
            <View style={styles.hero}>
              <IconBadge tone="brand">
                <CalendarClock size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
              </IconBadge>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>{restaurant.name}</Text>
                <Text style={styles.heroMeta}>{t(persistenceMessageKey)}</Text>
              </View>
            </View>

            <FieldLabel label={t("settings.operatingProfile.orderCadence")} />
            <Text style={styles.fieldHint}>{t("settings.operatingProfile.orderCadenceHint")}</Text>
            <View style={styles.chipRow}>
              {OPERATING_PROFILE_WEEKDAYS.map((day) => (
                <ChoiceChip
                  key={`cadence-${day}`}
                  label={t(WEEKDAY_LABEL_KEYS[day])}
                  selected={draft.orderCadence.includes(day)}
                  disabled={!canEdit}
                  onPress={() => toggleCadence(day)}
                />
              ))}
            </View>
            {customCadence.length > 0 ? (
              <View style={styles.chipRow}>
                {customCadence.map((day) => (
                  <ChoiceChip
                    key={`cadence-custom-${day}`}
                    label={day}
                    selected
                    disabled={!canEdit}
                    onPress={() => toggleCadence(day)}
                  />
                ))}
              </View>
            ) : null}

            <FieldLabel label={t("settings.operatingProfile.inventoryReviewDays")} />
            <Text style={styles.fieldHint}>
              {t("settings.operatingProfile.inventoryReviewDaysHint")}
            </Text>
            <View style={styles.chipRow}>
              {OPERATING_PROFILE_WEEKDAYS.map((day) => (
                <ChoiceChip
                  key={`review-${day}`}
                  label={t(WEEKDAY_LABEL_KEYS[day])}
                  selected={draft.inventoryReviewDays.includes(day)}
                  disabled={!canEdit}
                  onPress={() => toggleReviewDay(day)}
                />
              ))}
            </View>
            {customReview.length > 0 ? (
              <View style={styles.chipRow}>
                {customReview.map((day) => (
                  <ChoiceChip
                    key={`review-custom-${day}`}
                    label={day}
                    selected
                    disabled={!canEdit}
                    onPress={() => toggleReviewDay(day)}
                  />
                ))}
              </View>
            ) : null}

            <FieldLabel label={t("settings.operatingProfile.prepWindows")} />
            <Text style={styles.fieldHint}>{t("settings.operatingProfile.prepWindowsHint")}</Text>
            <View style={styles.chipRow}>
              {OPERATING_PROFILE_PREP_PRESETS.map((preset) => (
                <ChoiceChip
                  key={`prep-${preset}`}
                  label={preset}
                  selected={draft.prepWindows.includes(preset)}
                  disabled={!canEdit}
                  onPress={() => togglePrepPreset(preset)}
                />
              ))}
            </View>
            {customPrepWindows.length > 0 ? (
              <View style={styles.customList}>
                {customPrepWindows.map((window) => (
                  <View key={`prep-custom-${window}`} style={styles.customRow}>
                    <Text style={styles.customLabel}>{window}</Text>
                    {canEdit ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("settings.operatingProfile.removePrepAccessibility", {
                          window
                        })}
                        onPress={() =>
                          updateDraft("prepWindows", removeProfileString(draft.prepWindows, window))
                        }
                        hitSlop={8}
                      >
                        <X size={icon.row} color={colors.muted} strokeWidth={iconStroke} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
            {canEdit ? (
              <View style={styles.addRow}>
                <TextInput
                  value={customPrep}
                  onChangeText={(value) => {
                    setCustomPrep(value);
                    setValidationKey(null);
                    setStatus(null);
                  }}
                  placeholder={t("settings.operatingProfile.prepPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={styles.addInput}
                  editable={!saving}
                  maxLength={160}
                  accessibilityLabel={t("settings.operatingProfile.prepWindows")}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.operatingProfile.addPrepAccessibility")}
                  onPress={addPrepWindow}
                  disabled={saving || customPrep.trim().length === 0}
                  style={({ pressed }) => [
                    styles.addButton,
                    (saving || customPrep.trim().length === 0) && styles.addButtonDisabled,
                    pressed && styles.pressed
                  ]}
                >
                  <Plus size={icon.row} color={colors.accentDark} strokeWidth={iconStroke} />
                </Pressable>
              </View>
            ) : null}

            <FieldLabel label={t("settings.operatingProfile.notes")} />
            <TextInput
              value={draft.notes}
              onChangeText={(value) => updateDraft("notes", value)}
              placeholder={t("settings.operatingProfile.notesPlaceholder")}
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.notesInput]}
              editable={canEdit && !saving}
              multiline
              maxLength={RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS}
              accessibilityLabel={t("settings.operatingProfile.notes")}
            />

            {restaurant.operational_profile.primarySuppliers.length > 0 ? (
              <>
                <FieldLabel label={t("settings.operatingProfile.primarySuppliers")} />
                <Text style={styles.fieldHint}>
                  {t("settings.operatingProfile.primarySuppliersHint")}
                </Text>
                <Text style={styles.readOnlyValue}>
                  {restaurant.operational_profile.primarySuppliers.join(" · ")}
                </Text>
              </>
            ) : null}

            {validationKey ? <Text style={styles.errorText}>{t(validationKey)}</Text> : null}
            {status === "error" && !validationKey ? (
              <Text style={styles.errorText}>{t("settings.operatingProfile.saveError")}</Text>
            ) : null}
            {status === "saved" ? (
              <View style={styles.savedRow}>
                <Check size={icon.row} color={colors.success} strokeWidth={iconStroke} />
                <Text style={styles.savedText}>{t("settings.operatingProfile.saved")}</Text>
              </View>
            ) : null}

            {canEdit ? (
              <Button
                title={t(saving ? "settings.operatingProfile.saving" : "settings.operatingProfile.save")}
                onPress={() => void handleSave()}
                disabled={saving}
                fullWidth
                icon={
                  saving ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Check size={icon.row} color={colors.surface} strokeWidth={iconStroke} />
                  )
                }
              />
            ) : null}
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function ChoiceChip({
  label,
  selected,
  disabled,
  onPress
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.xl
  },
  sectionHeading: {
    gap: spacing.xs
  },
  sectionTitle: {
    ...typography.sectionTitle,
    fontFamily: fontFamilies.display,
    color: colors.text
  },
  sectionBody: {
    ...typography.body,
    color: colors.muted
  },
  formCard: {
    gap: spacing.md
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  heroCopy: {
    flex: 1,
    gap: 2
  },
  heroTitle: {
    ...typography.cardTitle,
    color: colors.text
  },
  heroMeta: {
    ...typography.caption,
    color: colors.muted
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs
  },
  fieldHint: {
    ...typography.caption,
    color: colors.muted,
    marginTop: -spacing.xs
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: "center"
  },
  chipSelected: {
    borderColor: colors.accentDark,
    backgroundColor: colors.accentSoft
  },
  chipDisabled: {
    opacity: 0.7
  },
  chipLabel: {
    ...typography.caption,
    color: colors.text
  },
  chipLabelSelected: {
    color: colors.accentDark,
    fontFamily: fontFamilies.semibold
  },
  customList: {
    gap: spacing.xs
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 44
  },
  customLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 44,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.body.fontSize
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  addButtonDisabled: {
    opacity: 0.5
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.body.fontSize,
    minHeight: 44
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  readOnlyValue: {
    ...typography.body,
    color: colors.text
  },
  errorText: {
    ...typography.caption,
    color: colors.danger
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  savedText: {
    ...typography.caption,
    color: colors.success
  },
  pressed: {
    opacity: 0.85
  }
});

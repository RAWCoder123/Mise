import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, Check, Store } from "lucide-react-native";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
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
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, fontFamilies, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  RESTAURANT_ADDRESS_MAX_CHARACTERS,
  RESTAURANT_CUISINE_MAX_CHARACTERS,
  RESTAURANT_LOGO_URL_MAX_CHARACTERS,
  RESTAURANT_NAME_MAX_CHARACTERS,
  buildRestaurantIdentityPatch,
  draftFromRestaurant,
  isValidRestaurantHexColor,
  restaurantIdentityChanged,
  restaurantIdentityOptions,
  type RestaurantIdentityDraft
} from "../../services/domain/restaurantIdentity";
import { fetchRestaurant, updateRestaurantProfile } from "../../services/miseService";
import {
  presentIdentitySettingsInteractive,
  presentIdentitySettingsNote,
  presentIdentitySettingsValuesVisible,
  resolveRestaurantIdentityLoadState
} from "../../services/presentation/identitySettingsPresentation";
import { canUpdateRestaurantProfile } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import type { Restaurant, RestaurantServiceStyle } from "../../types/mise";
import { restaurantInitials } from "../../utils/restaurantBranding";

type SaveStatus = "saved" | "error" | null;

const SERVICE_STYLE_LABELS: Record<RestaurantServiceStyle, MessageKey> = {
  quick_service: "settings.serviceStyle.quickService",
  fast_casual: "settings.serviceStyle.fastCasual",
  full_service: "settings.serviceStyle.fullService",
  bar: "settings.serviceStyle.bar",
  cafe: "settings.serviceStyle.cafe",
  ghost_kitchen: "settings.serviceStyle.ghostKitchen"
};

export default function RestaurantIdentitySettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const {
    applyRestaurantProfile,
    isDemoMode,
    memberships,
    ready: sessionReady,
    restaurant,
    usingLocalDemo
  } = useMiseSession();
  const [identityRestaurant, setIdentityRestaurant] = useState<Restaurant | null>(restaurant);
  const [draft, setDraft] = useState<RestaurantIdentityDraft | null>(
    restaurant ? draftFromRestaurant(restaurant) : null
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>(null);
  const [validationKey, setValidationKey] = useState<MessageKey | null>(null);
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const hasLocalIdentityRef = useRef(Boolean(restaurant));
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  hasLocalIdentityRef.current = Boolean(identityRestaurant || draft);

  const canEdit = canUpdateRestaurantProfile(memberships, restaurant?.id);
  const hubLoadState = resolveRestaurantIdentityLoadState({
    sessionReady,
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const interactive = presentIdentitySettingsInteractive(hubLoadState);
  const valuesVisible =
    presentIdentitySettingsValuesVisible(hubLoadState) ||
    (hubLoadState === "loading" && Boolean(draft && identityRestaurant));
  const formEditable = canEdit && interactive && !saving;

  useEffect(() => {
    const restaurantId = restaurant?.id ?? null;
    if (!restaurantId || !restaurant) {
      loadedRestaurantRef.current = null;
      dirtyRef.current = false;
      setLoadedRestaurantId(null);
      setLoadError(false);
      setIdentityRestaurant(null);
      setDraft(null);
      return;
    }
    if (loadedRestaurantRef.current !== restaurantId) {
      dirtyRef.current = false;
      setLoadedRestaurantId(null);
      setLoadError(false);
      setIdentityRestaurant(restaurant);
      setDraft(draftFromRestaurant(restaurant));
      setStatus(null);
      setValidationKey(null);
      setLogoPreviewFailed(false);
    }
  }, [restaurant, restaurant?.id]);

  const load = useCallback(
    async (showLoading = false) => {
      if (!sessionReady) return;

      if (!restaurant?.id) {
        loadedRestaurantRef.current = null;
        setLoadedRestaurantId(null);
        setLoadError(false);
        setIdentityRestaurant(null);
        setDraft(null);
        return;
      }

      const restaurantId = restaurant.id;
      const requestId = ++requestIdRef.current;
      const soft = !showLoading && loadedRestaurantRef.current === restaurantId;
      if (showLoading || !soft) {
        setLoadedRestaurantId(null);
      }
      setLoadError(false);

      try {
        const nextRestaurant = await fetchRestaurant(restaurantId);
        if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
          return;
        }
        loadedRestaurantRef.current = restaurantId;
        setIdentityRestaurant(nextRestaurant);
        if (!dirtyRef.current || showLoading) {
          setDraft(draftFromRestaurant(nextRestaurant));
          setLogoPreviewFailed(false);
        }
        await applyRestaurantProfile(nextRestaurant);
        if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
          return;
        }
        dirtyRef.current = false;
        setLoadedRestaurantId(restaurantId);
        setLoadError(false);
      } catch (error) {
        if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
          return;
        }
        captureMiseError(error, {
          flow: "settings_restaurant",
          operation: "load_restaurant_identity",
          restaurant_id: restaurantId
        });
        if (!(soft && hasLocalIdentityRef.current)) {
          loadedRestaurantRef.current = null;
          setLoadedRestaurantId(null);
        }
        setLoadError(true);
      }
    },
    [applyRestaurantProfile, restaurant, sessionReady]
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  const options = useMemo(
    () => restaurantIdentityOptions(identityRestaurant ?? restaurant),
    [identityRestaurant, restaurant]
  );

  const persistenceMessageKey: MessageKey = usingLocalDemo || isDemoMode
    ? "settings.restaurant.demoPersistence"
    : restaurant
      ? "settings.restaurant.hostedPersistence"
      : "settings.restaurant.sessionPersistence";

  const persistenceNote = presentIdentitySettingsNote(hubLoadState, {
    loading: t("settings.restaurant.status.loading"),
    unavailable: t("settings.restaurant.status.unavailable"),
    missing: t("settings.profile.noRestaurant"),
    ready: t(persistenceMessageKey)
  });

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  function updateDraft<K extends keyof RestaurantIdentityDraft>(
    key: K,
    value: RestaurantIdentityDraft[K]
  ) {
    dirtyRef.current = true;
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setStatus(null);
    setValidationKey(null);
    if (key === "logo_url") setLogoPreviewFailed(false);
  }

  async function handleSave() {
    if (saving || !identityRestaurant || !draft || !canEdit || !interactive) return;
    setStatus(null);

    if (!isValidRestaurantHexColor(draft.brand_color)) {
      setValidationKey("settings.restaurant.error.invalidBrandColor");
      return;
    }
    if (!isValidRestaurantHexColor(draft.accent_color)) {
      setValidationKey("settings.restaurant.error.invalidAccentColor");
      return;
    }

    const patch = buildRestaurantIdentityPatch(identityRestaurant, draft);
    if (!restaurantIdentityChanged(patch)) {
      setStatus("saved");
      dirtyRef.current = false;
      return;
    }

    if (!patch.name && draft.name.trim().length === 0) {
      setValidationKey("settings.restaurant.error.invalidName");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateRestaurantProfile(identityRestaurant.id, patch);
      await applyRestaurantProfile(updated);
      setIdentityRestaurant(updated);
      setDraft(draftFromRestaurant(updated));
      dirtyRef.current = false;
      loadedRestaurantRef.current = updated.id;
      setLoadedRestaurantId(updated.id);
      setStatus("saved");
      AccessibilityInfo.announceForAccessibility(
        t("settings.restaurant.savedAnnouncement", { name: updated.name })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/name must be between|Restaurant name/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidName");
      } else if (/address/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidAddress");
      } else if (/Cuisine/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidCuisine");
      } else if (/timezone|IANA/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidTimezone");
      } else if (/Currency/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidCurrency");
      } else if (/Service style/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidServiceStyle");
      } else if (/Brand color/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidBrandColor");
      } else if (/Accent color/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidAccentColor");
      } else if (/Logo URL/i.test(message)) {
        setValidationKey("settings.restaurant.error.invalidLogoUrl");
      } else {
        setValidationKey(null);
      }
      captureMiseError(error, {
        flow: "settings_restaurant",
        operation: "update_restaurant_profile",
        restaurant_id: identityRestaurant.id
      });
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  const previewSource = identityRestaurant;
  const previewBrand =
    draft && isValidRestaurantHexColor(draft.brand_color)
      ? draft.brand_color.trim().toUpperCase()
      : previewSource?.brand_color ?? colors.accent;
  const previewAccent =
    draft && isValidRestaurantHexColor(draft.accent_color)
      ? draft.accent_color.trim().toUpperCase()
      : previewSource?.accent_color ?? colors.success;
  const logoPreviewUrl = draft?.logo_url.trim() ?? "";

  return (
    <Screen
      title={t("settings.restaurant.title")}
      subtitle={t("settings.restaurant.subtitle")}
      loading={hubLoadState === "loading" && !valuesVisible}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.stack}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{t("settings.restaurant.sectionTitle")}</Text>
            <Text style={styles.sectionBody}>
              {t(canEdit ? "settings.restaurant.sectionBody" : "settings.restaurant.readOnlyBody")}
            </Text>
          </View>

          {loadError ? (
            <RetryNotice
              title={t("settings.restaurant.retry.title")}
              message={t("settings.restaurant.retry.body")}
              onRetry={() => void load(true)}
              retryLabel={t("common.retry")}
              accessibilityLabel={t("settings.restaurant.retry.accessibility")}
            />
          ) : null}

          {hubLoadState === "missing" ? (
            <Card style={styles.formCard}>
              <Text style={styles.sectionBody}>{t("settings.profile.noRestaurant")}</Text>
            </Card>
          ) : null}

          {valuesVisible && draft && previewSource ? (
          <Card style={styles.formCard}>
            <View style={styles.previewRow} accessibilityLabel={t("settings.restaurant.brandPreview")}>
              <View style={[styles.brandMark, { backgroundColor: previewBrand }]}>
                {logoPreviewUrl && !logoPreviewFailed ? (
                  <Image
                    source={{ uri: logoPreviewUrl }}
                    accessibilityIgnoresInvertColors
                    onError={() => setLogoPreviewFailed(true)}
                    style={styles.brandLogo}
                  />
                ) : (
                  <Text style={styles.brandInitials}>
                    {restaurantInitials({ ...previewSource, name: draft.name || previewSource.name })}
                  </Text>
                )}
              </View>
              <View style={styles.previewCopy}>
                <Text style={styles.previewName}>{draft.name.trim() || previewSource.name}</Text>
                <View style={styles.previewAccentRow}>
                  <View style={[styles.previewAccentSwatch, { backgroundColor: previewAccent }]} />
                  <Text style={styles.previewMeta}>{t("settings.restaurant.accentPreview")}</Text>
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.name")}</Text>
              <TextInput
                value={draft.name}
                onChangeText={(value) => updateDraft("name", value)}
                accessibilityLabel={t("settings.restaurant.name")}
                autoCapitalize="words"
                autoCorrect
                editable={formEditable}
                maxLength={RESTAURANT_NAME_MAX_CHARACTERS}
                placeholder={t("settings.restaurant.namePlaceholder")}
                placeholderTextColor={colors.faint}
                style={[styles.input, !formEditable && styles.inputDisabled]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.address")}</Text>
              <TextInput
                value={draft.address}
                onChangeText={(value) => updateDraft("address", value)}
                accessibilityLabel={t("settings.restaurant.address")}
                autoCapitalize="words"
                autoCorrect
                editable={formEditable}
                maxLength={RESTAURANT_ADDRESS_MAX_CHARACTERS}
                placeholder={t("settings.restaurant.addressPlaceholder")}
                placeholderTextColor={colors.faint}
                style={[styles.input, !formEditable && styles.inputDisabled]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.cuisine")}</Text>
              <TextInput
                value={draft.cuisine_type}
                onChangeText={(value) => updateDraft("cuisine_type", value)}
                accessibilityLabel={t("settings.restaurant.cuisine")}
                autoCapitalize="words"
                autoCorrect
                editable={formEditable}
                maxLength={RESTAURANT_CUISINE_MAX_CHARACTERS}
                placeholder={t("settings.restaurant.cuisinePlaceholder")}
                placeholderTextColor={colors.faint}
                style={[styles.input, !formEditable && styles.inputDisabled]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.brandColor")}</Text>
              <View style={styles.swatchRow}>
                {options.brandColors.map((hex) => {
                  const selected = draft.brand_color.trim().toUpperCase() === hex.toUpperCase();
                  return (
                    <Pressable
                      key={`brand-${hex}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: !formEditable }}
                      accessibilityLabel={t("settings.restaurant.brandColorOption", { color: hex })}
                      disabled={!formEditable}
                      onPress={() => updateDraft("brand_color", hex)}
                      style={({ pressed }) => [
                        styles.swatch,
                        { backgroundColor: hex },
                        selected && styles.swatchSelected,
                        pressed && formEditable && styles.pressed
                      ]}
                    >
                      {selected ? <Check size={14} color="#FFFFFF" strokeWidth={2.8} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={draft.brand_color}
                onChangeText={(value) => updateDraft("brand_color", value)}
                accessibilityLabel={t("settings.restaurant.brandColor")}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={formEditable}
                maxLength={7}
                placeholder="#EF3F27"
                placeholderTextColor={colors.faint}
                style={[styles.input, !formEditable && styles.inputDisabled]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.accentColor")}</Text>
              <View style={styles.swatchRow}>
                {options.brandColors.map((hex) => {
                  const selected = draft.accent_color.trim().toUpperCase() === hex.toUpperCase();
                  return (
                    <Pressable
                      key={`accent-${hex}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: !formEditable }}
                      accessibilityLabel={t("settings.restaurant.accentColorOption", { color: hex })}
                      disabled={!formEditable}
                      onPress={() => updateDraft("accent_color", hex)}
                      style={({ pressed }) => [
                        styles.swatch,
                        { backgroundColor: hex },
                        selected && styles.swatchSelected,
                        pressed && formEditable && styles.pressed
                      ]}
                    >
                      {selected ? <Check size={14} color="#FFFFFF" strokeWidth={2.8} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={draft.accent_color}
                onChangeText={(value) => updateDraft("accent_color", value)}
                accessibilityLabel={t("settings.restaurant.accentColor")}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={formEditable}
                maxLength={7}
                placeholder="#1F7A4D"
                placeholderTextColor={colors.faint}
                style={[styles.input, !formEditable && styles.inputDisabled]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.logoUrl")}</Text>
              <Text style={styles.helper}>{t("settings.restaurant.logoUrlHelper")}</Text>
              <TextInput
                value={draft.logo_url}
                onChangeText={(value) => updateDraft("logo_url", value)}
                accessibilityLabel={t("settings.restaurant.logoUrl")}
                autoCapitalize="none"
                autoCorrect={false}
                editable={formEditable}
                keyboardType="url"
                maxLength={RESTAURANT_LOGO_URL_MAX_CHARACTERS}
                placeholder={t("settings.restaurant.logoUrlPlaceholder")}
                placeholderTextColor={colors.faint}
                style={[styles.input, !formEditable && styles.inputDisabled]}
              />
              {formEditable && draft.logo_url.trim().length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.restaurant.clearLogo")}
                  disabled={saving}
                  onPress={() => updateDraft("logo_url", "")}
                  style={({ pressed }) => [styles.clearLogo, pressed && styles.pressed]}
                >
                  <Text style={styles.clearLogoText}>{t("settings.restaurant.clearLogo")}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.serviceStyle")}</Text>
              <View style={styles.chipRow}>
                {options.serviceStyles.map((style) => {
                  const selected = draft.service_style === style;
                  return (
                    <Pressable
                      key={style}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: !formEditable }}
                      accessibilityLabel={t(SERVICE_STYLE_LABELS[style])}
                      disabled={!formEditable}
                      onPress={() => updateDraft("service_style", style)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && formEditable && styles.pressed
                      ]}
                    >
                      {selected ? <Check size={14} color={colors.accentDark} strokeWidth={2.6} /> : null}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(SERVICE_STYLE_LABELS[style])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.timezone")}</Text>
              <View style={styles.chipRow}>
                {options.timezones.map((timezone) => {
                  const selected = draft.timezone === timezone;
                  return (
                    <Pressable
                      key={timezone}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: !formEditable }}
                      accessibilityLabel={timezone}
                      disabled={!formEditable}
                      onPress={() => updateDraft("timezone", timezone)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && formEditable && styles.pressed
                      ]}
                    >
                      {selected ? <Check size={14} color={colors.accentDark} strokeWidth={2.6} /> : null}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{timezone}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.restaurant.currency")}</Text>
              <View style={styles.chipRow}>
                {options.currencies.map((currency) => {
                  const selected = draft.currency === currency;
                  return (
                    <Pressable
                      key={currency}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: !formEditable }}
                      accessibilityLabel={currency}
                      disabled={!formEditable}
                      onPress={() => updateDraft("currency", currency)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && formEditable && styles.pressed
                      ]}
                    >
                      {selected ? <Check size={14} color={colors.accentDark} strokeWidth={2.6} /> : null}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{currency}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {validationKey ? (
              <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
                {t(validationKey)}
              </Text>
            ) : null}

            {canEdit ? (
              <Button
                title={saving ? t("settings.restaurant.saving") : t("settings.restaurant.save")}
                onPress={() => void handleSave()}
                disabled={!interactive || saving}
                fullWidth
              />
            ) : null}
          </Card>
          ) : null}

          {saving ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>{t("common.loading")}</Text>
            </View>
          ) : null}

          {!loadError && status && draft && previewSource ? (
            <View
              style={[styles.status, status === "error" ? styles.statusError : styles.statusSuccess]}
              accessibilityLiveRegion="polite"
            >
              <Text
                style={[
                  styles.statusText,
                  status === "error" ? styles.statusErrorText : styles.statusSuccessText
                ]}
              >
                {status === "error"
                  ? t("settings.restaurant.saveError")
                  : t("settings.restaurant.savedAnnouncement", {
                      name: draft.name.trim() || previewSource.name
                    })}
              </Text>
            </View>
          ) : null}

          <View style={styles.persistenceNote}>
            <IconBadge tone="neutral">
              <Store size={19} color={colors.text} strokeWidth={2.2} />
            </IconBadge>
            <Text style={styles.persistenceText}>{persistenceNote}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg
  },
  sectionHeading: {
    gap: spacing.xs
  },
  sectionTitle: {
    color: colors.text,
    ...typography.sectionTitle
  },
  sectionBody: {
    maxWidth: 390,
    color: colors.muted,
    ...typography.body
  },
  formCard: {
    gap: spacing.md
  },
  previewRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  brandLogo: {
    width: 52,
    height: 52
  },
  brandInitials: {
    color: "#FFFFFF",
    fontFamily: fontFamilies.semibold,
    fontSize: 18,
    lineHeight: 22
  },
  previewCopy: {
    flex: 1,
    gap: 4
  },
  previewName: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22
  },
  previewAccentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  previewAccentSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  previewMeta: {
    color: colors.muted,
    ...typography.caption
  },
  field: {
    gap: spacing.xs
  },
  label: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 18
  },
  helper: {
    color: colors.faint,
    ...typography.caption
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 22
  },
  inputDisabled: {
    backgroundColor: colors.surfaceWarm,
    color: colors.muted
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent"
  },
  swatchSelected: {
    borderColor: colors.text
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  chipText: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 18
  },
  chipTextSelected: {
    color: colors.accentDark
  },
  clearLogo: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start"
  },
  clearLogoText: {
    color: colors.accentDark,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 20
  },
  pressed: {
    opacity: 0.88
  },
  error: {
    color: colors.danger,
    ...typography.caption
  },
  loading: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  loadingText: {
    color: colors.muted,
    ...typography.body
  },
  status: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  statusSuccess: {
    backgroundColor: colors.successSoft
  },
  statusError: {
    backgroundColor: colors.dangerSoft
  },
  statusText: {
    ...typography.caption
  },
  statusSuccessText: {
    color: colors.success
  },
  statusErrorText: {
    color: colors.danger
  },
  persistenceNote: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  persistenceText: {
    flex: 1,
    color: colors.muted,
    ...typography.body
  }
});

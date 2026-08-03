import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey, MessageValues } from "../../i18n/catalog";
import {
  fetchSupplierRecipientDirectory,
  saveSupplierRecipient
} from "../../services/miseService";
import {
  supplierRecipientDirectoryKey,
  type SupplierRecipientDirectoryEntry
} from "../../services/domain/supplierRecipients";
import {
  presentSuppliersHubConfiguredCount,
  presentSuppliersHubEmptyCopy,
  presentSuppliersMutationActionsEditable,
  presentSuppliersMutationBusy,
  presentSuppliersMutationNoticeCopy,
  resolveSuppliersHubLoadState,
  type SuppliersMutationNoticeReason
} from "../../services/presentation/suppliersHubPresentation";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

interface SupplierNotice {
  tone: StatusNoticeTone;
  title: string;
  message: string;
}

interface SupplierCopy {
  title: string;
  subtitle: string;
  back: string;
  noRestaurantTitle: string;
  noRestaurantBody: string;
  readOnlyTitle: string;
  readOnlyBody: string;
  loadErrorTitle: string;
  loadErrorBody: string;
  retry: string;
  retryAccessibility: string;
  invalidTitle: string;
  invalidBody: (supplier: string) => string;
  savedTitle: string;
  savedBody: (supplier: string) => string;
  saveErrorTitle: string;
  saveErrorBody: (supplier: string) => string;
  safetyTitle: string;
  safetyBody: string;
  sectionTitle: string;
  sectionSubtitle: string;
  configuredCount: (configured: string, total: string) => string;
  configuredCountLoading: string;
  configuredCountUnavailable: string;
  emptyTitle: string;
  emptyBody: string;
  emptyLoadingTitle: string;
  emptyLoadingBody: string;
  emptyUnavailableTitle: string;
  emptyUnavailableBody: string;
  savedRecipient: string;
  currentSupplier: string;
  configured: string;
  needsEmail: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailAccessibility: (supplier: string) => string;
  emailHint: string;
  save: string;
  saving: string;
  saveAccessibility: (supplier: string) => string;
  saveHint: string;
  readOnlyEmailAccessibility: (supplier: string, email: string | null) => string;
  notConfigured: string;
}

function buildSupplierCopy(t: (key: MessageKey, values?: MessageValues) => string): SupplierCopy {
  return {
    title: t("settings.suppliers.title"),
    subtitle: t("settings.suppliers.subtitle"),
    back: t("settings.suppliers.back"),
    noRestaurantTitle: t("settings.suppliers.noRestaurant.title"),
    noRestaurantBody: t("settings.suppliers.noRestaurant.body"),
    readOnlyTitle: t("settings.suppliers.readOnly.title"),
    readOnlyBody: t("settings.suppliers.readOnly.body"),
    loadErrorTitle: t("settings.suppliers.retry.title"),
    loadErrorBody: t("settings.suppliers.retry.body"),
    retry: t("common.retry"),
    retryAccessibility: t("settings.suppliers.retry.accessibility"),
    invalidTitle: t("settings.suppliers.notice.invalidTitle"),
    invalidBody: (supplier) => t("settings.suppliers.notice.invalidBody", { supplier }),
    savedTitle: t("settings.suppliers.notice.savedTitle"),
    savedBody: (supplier) => t("settings.suppliers.notice.savedBody", { supplier }),
    saveErrorTitle: t("settings.suppliers.notice.saveErrorTitle"),
    saveErrorBody: (supplier) => t("settings.suppliers.notice.saveErrorBody", { supplier }),
    safetyTitle: t("settings.suppliers.safety.title"),
    safetyBody: t("settings.suppliers.safety.body"),
    sectionTitle: t("settings.suppliers.section.title"),
    sectionSubtitle: t("settings.suppliers.section.subtitle"),
    configuredCount: (configured, total) => t("settings.suppliers.configuredCount", { configured, total }),
    configuredCountLoading: t("settings.suppliers.configuredCount.loading"),
    configuredCountUnavailable: t("settings.suppliers.configuredCount.unavailable"),
    emptyTitle: t("settings.suppliers.empty.title"),
    emptyBody: t("settings.suppliers.empty.body"),
    emptyLoadingTitle: t("settings.suppliers.empty.loadingTitle"),
    emptyLoadingBody: t("settings.suppliers.empty.loadingBody"),
    emptyUnavailableTitle: t("settings.suppliers.empty.unavailableTitle"),
    emptyUnavailableBody: t("settings.suppliers.empty.unavailableBody"),
    savedRecipient: t("settings.suppliers.savedRecipient"),
    currentSupplier: t("settings.suppliers.currentSupplier"),
    configured: t("settings.suppliers.configured"),
    needsEmail: t("settings.suppliers.needsEmail"),
    emailLabel: t("settings.suppliers.emailLabel"),
    emailPlaceholder: t("settings.suppliers.emailPlaceholder"),
    emailAccessibility: (supplier) => t("settings.suppliers.emailAccessibility", { supplier }),
    emailHint: t("settings.suppliers.emailHint"),
    save: t("settings.suppliers.save"),
    saving: t("settings.suppliers.saving"),
    saveAccessibility: (supplier) => t("settings.suppliers.saveAccessibility", { supplier }),
    saveHint: t("settings.suppliers.saveHint"),
    readOnlyEmailAccessibility: (supplier, email) => t("settings.suppliers.readOnlyEmailAccessibility", {
      supplier,
      email: email ?? t("settings.suppliers.notConfigured")
    }),
    notConfigured: t("settings.suppliers.notConfigured")
  };
}

export default function SupplierRecipientsScreen() {
  const navigation = useNavigation();
  const { formatNumber, t } = useLocale();
  const copy = useMemo(() => buildSupplierCopy(t), [t]);
  const { memberships, restaurant } = useMiseSession();
  const [entries, setEntries] = useState<SupplierRecipientDirectoryEntry[]>([]);
  const [draftEmails, setDraftEmails] = useState<Record<string, string>>({});
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<SupplierNotice | null>(null);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  const actionLocksRef = useRef(new Set<string>());
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const mutationBusy = presentSuppliersMutationBusy(savingKeys.size);

  const mutationNotice = useCallback((
    reason: SuppliersMutationNoticeReason,
    supplierName: string
  ): SupplierNotice => {
    const localized: Record<SuppliersMutationNoticeReason, { title: string; message: string }> = {
      invalidEmail: {
        title: copy.invalidTitle,
        message: copy.invalidBody(supplierName)
      },
      saved: {
        title: copy.savedTitle,
        message: copy.savedBody(supplierName)
      },
      saveError: {
        title: copy.saveErrorTitle,
        message: copy.saveErrorBody(supplierName)
      }
    };
    return presentSuppliersMutationNoticeCopy(reason, localized);
  }, [copy]);

  const load = useCallback(async (showLoading = false) => {
    if (!restaurant) {
      setLoading(false);
      setLoadError(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    if (showLoading || loadedRestaurantRef.current !== restaurantId) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const nextEntries = await fetchSupplierRecipientDirectory(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEntries.some((entry) => entry.restaurantId !== restaurantId)) {
        throw new Error("Supplier directory did not match the active restaurant.");
      }
      setEntries(nextEntries);
      setDraftEmails(Object.fromEntries(
        nextEntries.map((entry) => [supplierRecipientDirectoryKey(entry.supplierName), entry.email ?? ""])
      ));
      loadedRestaurantRef.current = restaurantId;
      setLoadedRestaurantId(restaurantId);
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "settings_suppliers",
        operation: "load",
        restaurant_id: restaurantId
      });
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    loadedRestaurantRef.current = null;
    actionLocksRef.current.clear();
    setEntries([]);
    setDraftEmails({});
    setLoadedRestaurantId(null);
    setLoadError(false);
    setSavingKeys(new Set());
    setNotice(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function save(entry: SupplierRecipientDirectoryEntry) {
    if (!restaurant || !canManage) return;
    const restaurantId = restaurant.id;
    const key = supplierRecipientDirectoryKey(entry.supplierName);
    if (actionLocksRef.current.has(key)) return;
    const email = (draftEmails[key] ?? "").trim();
    if (!isValidRecipientEmail(email)) {
      setNotice(mutationNotice("invalidEmail", entry.supplierName));
      return;
    }

    actionLocksRef.current.add(key);
    setSavingKeys((current) => new Set(current).add(key));
    setNotice(null);
    try {
      const saved = await saveSupplierRecipient(restaurantId, entry.supplierName, email);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setEntries((current) => current.map((currentEntry) =>
        supplierRecipientDirectoryKey(currentEntry.supplierName) === key
          ? {
              ...currentEntry,
              supplierName: saved.supplier_name,
              email: saved.email,
              recipientId: saved.id,
              updatedAt: saved.updated_at,
              source: currentEntry.source === "current" ? "current_and_saved" : currentEntry.source
            }
          : currentEntry
      ));
      setDraftEmails((current) => ({ ...current, [key]: saved.email ?? "" }));
      setNotice(mutationNotice("saved", saved.supplier_name));
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "settings_suppliers",
        operation: "save",
        restaurant_id: restaurantId
      });
      setNotice(mutationNotice("saveError", entry.supplierName));
    } finally {
      actionLocksRef.current.delete(key);
      if (activeRestaurantIdRef.current === restaurantId) {
        setSavingKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    }
  }

  const hubLoadState = resolveSuppliersHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentSuppliersMutationActionsEditable(canManage, mutationBusy, hubReady);
  const visibleEntries = hubReady ? entries : [];
  const configuredCount = useMemo(
    () => visibleEntries.filter((entry) => Boolean(entry.email)).length,
    [visibleEntries]
  );
  const configuredCountLabel = presentSuppliersHubConfiguredCount(
    hubLoadState,
    configuredCount,
    visibleEntries.length,
    {
      loading: copy.configuredCountLoading,
      unavailable: copy.configuredCountUnavailable,
      configuredCount: copy.configuredCount
    },
    formatNumber
  );
  const emptyPresentation = presentSuppliersHubEmptyCopy(hubLoadState, {
    loadingTitle: copy.emptyLoadingTitle,
    loadingBody: copy.emptyLoadingBody,
    unavailableTitle: copy.emptyUnavailableTitle,
    unavailableBody: copy.emptyUnavailableBody,
    emptyTitle: copy.emptyTitle,
    emptyBody: copy.emptyBody
  });

  return (
    <Screen
      title={copy.title}
      subtitle={copy.subtitle}
      loading={loading}
      keyboardAware
      action={
        <ActionIcon accessibilityLabel={copy.back} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.25} />
        </ActionIcon>
      }
    >
      {!restaurant ? (
        <StatusNotice tone="warning" title={copy.noRestaurantTitle} message={copy.noRestaurantBody} />
      ) : (
        <View style={styles.stack}>
          {!canManage ? (
            <StatusNotice title={copy.readOnlyTitle} message={copy.readOnlyBody} />
          ) : null}

          {loadError ? (
            <RetryNotice
              title={copy.loadErrorTitle}
              message={copy.loadErrorBody}
              retryLabel={copy.retry}
              accessibilityLabel={copy.retryAccessibility}
              onRetry={() => void load(true)}
            />
          ) : null}

          {!loadError && notice ? (
            <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
          ) : null}

          <StatusNotice
            icon={<ShieldCheck size={20} color={colors.text} strokeWidth={2.25} />}
            title={copy.safetyTitle}
            message={copy.safetyBody}
          />

          <SectionSurface
            title={copy.sectionTitle}
            subtitle={copy.sectionSubtitle}
            action={configuredCountLabel}
            padding="none"
          >
            {hubLoadState !== "ready" || visibleEntries.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState compact title={emptyPresentation.title} body={emptyPresentation.body} />
              </View>
            ) : (
              visibleEntries.map((entry, index) => {
                const key = supplierRecipientDirectoryKey(entry.supplierName);
                const draftEmail = draftEmails[key] ?? "";
                const saving = savingKeys.has(key);
                const unchanged = draftEmail.trim().toLowerCase() === (entry.email ?? "").toLowerCase();
                const rowEditable = actionsEditable && !saving;
                return (
                  <View
                    key={key}
                    style={[styles.recipientRow, index > 0 && styles.dividedRow]}
                  >
                    <View style={styles.recipientHeader}>
                      <IconBadge tone={entry.email ? "leaf" : "warning"}>
                        <Mail
                          size={20}
                          color={entry.email ? colors.success : colors.warning}
                          strokeWidth={2.25}
                        />
                      </IconBadge>
                      <View style={styles.recipientCopy}>
                        <Text style={styles.supplierName} numberOfLines={2}>{entry.supplierName}</Text>
                        <Text style={styles.supplierMeta}>
                          {entry.source === "saved" ? copy.savedRecipient : copy.currentSupplier}
                        </Text>
                      </View>
                      <Badge
                        label={entry.email ? copy.configured : copy.needsEmail}
                        tone={entry.email ? "success" : "warning"}
                      />
                    </View>

                    {canManage ? (
                      <View style={styles.editor}>
                        <Text style={styles.inputLabel}>{copy.emailLabel}</Text>
                        <TextInput
                          accessibilityLabel={copy.emailAccessibility(entry.supplierName)}
                          accessibilityHint={copy.emailHint}
                          autoCapitalize="none"
                          autoComplete="email"
                          autoCorrect={false}
                          editable={rowEditable}
                          keyboardType="email-address"
                          onChangeText={(value) => setDraftEmails((current) => ({ ...current, [key]: value }))}
                          onSubmitEditing={() => {
                            if (!unchanged && rowEditable) void save(entry);
                          }}
                          placeholder={copy.emailPlaceholder}
                          placeholderTextColor={colors.faint}
                          returnKeyType="done"
                          style={styles.input}
                          textContentType="emailAddress"
                          value={draftEmail}
                        />
                        <Button
                          title={saving ? copy.saving : copy.save}
                          accessibilityLabel={copy.saveAccessibility(entry.supplierName)}
                          accessibilityHint={copy.saveHint}
                          variant="secondary"
                          fullWidth
                          disabled={!rowEditable || unchanged}
                          onPress={() => void save(entry)}
                        />
                      </View>
                    ) : (
                      <View accessible accessibilityLabel={copy.readOnlyEmailAccessibility(entry.supplierName, entry.email)}>
                        <Text style={styles.readOnlyLabel}>{copy.emailLabel}</Text>
                        <Text style={[styles.readOnlyEmail, !entry.email && styles.missingEmail]}>
                          {entry.email ?? copy.notConfigured}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </SectionSurface>
        </View>
      )}
    </Screen>
  );
}

function isValidRecipientEmail(value: string) {
  const normalized = value.trim();
  return normalized.length >= 3 && normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  emptyWrap: {
    padding: 14
  },
  recipientRow: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface
  },
  dividedRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  recipientHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  recipientCopy: {
    flex: 1,
    minWidth: 0
  },
  supplierName: {
    color: colors.text,
    ...typography.cardTitle
  },
  supplierMeta: {
    color: colors.muted,
    ...typography.body,
    marginTop: 2
  },
  editor: {
    gap: 8
  },
  inputLabel: {
    color: colors.text,
    ...typography.caption
  },
  input: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceWarm,
    color: colors.text,
    ...typography.body,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  readOnlyLabel: {
    color: colors.muted,
    ...typography.caption
  },
  readOnlyEmail: {
    color: colors.text,
    ...typography.body,
    marginTop: 4
  },
  missingEmail: {
    color: colors.warning
  }
});

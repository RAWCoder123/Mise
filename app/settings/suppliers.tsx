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
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey, MessageValues } from "../../i18n/catalog";
import {
  fetchSupplierRecipientDirectory,
  renameSupplier,
  saveSupplierRecipient
} from "../../services/miseService";
import type { SupplierRecipientDirectoryEntry } from "../../services/domain/supplierRecipients";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

interface SupplierNotice {
  tone: StatusNoticeTone;
  title: string;
  message: string;
}

type Translate = (key: MessageKey, values?: MessageValues) => string;

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
  invalidNameTitle: string;
  invalidNameBody: string;
  savedTitle: string;
  savedBody: (supplier: string) => string;
  saveErrorTitle: string;
  saveErrorBody: (supplier: string) => string;
  renamedTitle: string;
  renamedBody: (supplier: string) => string;
  renameErrorTitle: string;
  renameErrorBody: (supplier: string) => string;
  safetyTitle: string;
  safetyBody: string;
  sectionTitle: string;
  sectionSubtitle: string;
  configuredCount: (configured: string, total: string) => string;
  emptyTitle: string;
  emptyBody: string;
  savedRecipient: string;
  currentSupplier: string;
  configured: string;
  needsEmail: string;
  nameLabel: string;
  namePlaceholder: string;
  nameAccessibility: (supplier: string) => string;
  nameHint: string;
  rename: string;
  renameAccessibility: (supplier: string) => string;
  renameHint: string;
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

function buildSupplierCopy(t: Translate): SupplierCopy {
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
    retry: t("settings.suppliers.retry"),
    retryAccessibility: t("settings.suppliers.retry.accessibility"),
    invalidTitle: t("settings.suppliers.notice.invalidTitle"),
    invalidBody: (supplier) => t("settings.suppliers.notice.invalidBody", { supplier }),
    invalidNameTitle: t("settings.suppliers.notice.invalidNameTitle"),
    invalidNameBody: t("settings.suppliers.notice.invalidNameBody"),
    savedTitle: t("settings.suppliers.notice.savedTitle"),
    savedBody: (supplier) => t("settings.suppliers.notice.savedBody", { supplier }),
    saveErrorTitle: t("settings.suppliers.notice.saveErrorTitle"),
    saveErrorBody: (supplier) => t("settings.suppliers.notice.saveErrorBody", { supplier }),
    renamedTitle: t("settings.suppliers.notice.renamedTitle"),
    renamedBody: (supplier) => t("settings.suppliers.notice.renamedBody", { supplier }),
    renameErrorTitle: t("settings.suppliers.notice.renameErrorTitle"),
    renameErrorBody: (supplier) => t("settings.suppliers.notice.renameErrorBody", { supplier }),
    safetyTitle: t("settings.suppliers.safety.title"),
    safetyBody: t("settings.suppliers.safety.body"),
    sectionTitle: t("settings.suppliers.section.title"),
    sectionSubtitle: t("settings.suppliers.section.subtitle"),
    configuredCount: (configured, total) => t("settings.suppliers.configuredCount", { configured, total }),
    emptyTitle: t("settings.suppliers.empty.title"),
    emptyBody: t("settings.suppliers.empty.body"),
    savedRecipient: t("settings.suppliers.savedRecipient"),
    currentSupplier: t("settings.suppliers.currentSupplier"),
    configured: t("settings.suppliers.configured"),
    needsEmail: t("settings.suppliers.needsEmail"),
    nameLabel: t("settings.suppliers.nameLabel"),
    namePlaceholder: t("settings.suppliers.namePlaceholder"),
    nameAccessibility: (supplier) => t("settings.suppliers.nameAccessibility", { supplier }),
    nameHint: t("settings.suppliers.nameHint"),
    rename: t("settings.suppliers.rename"),
    renameAccessibility: (supplier) => t("settings.suppliers.renameAccessibility", { supplier }),
    renameHint: t("settings.suppliers.renameHint"),
    emailLabel: t("settings.suppliers.emailLabel"),
    emailPlaceholder: t("settings.suppliers.emailPlaceholder"),
    emailAccessibility: (supplier) => t("settings.suppliers.emailAccessibility", { supplier }),
    emailHint: t("settings.suppliers.emailHint"),
    save: t("settings.suppliers.save"),
    saving: t("settings.suppliers.saving"),
    saveAccessibility: (supplier) => t("settings.suppliers.saveAccessibility", { supplier }),
    saveHint: t("settings.suppliers.saveHint"),
    readOnlyEmailAccessibility: (supplier, email) =>
      t("settings.suppliers.readOnlyEmailAccessibility", {
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
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<SupplierNotice | null>(null);
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
      const nextEntries = await fetchSupplierRecipientDirectory(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEntries.some((entry) => entry.restaurantId !== restaurantId)) {
        throw new Error("Supplier directory did not match the active restaurant.");
      }
      setEntries(nextEntries);
      setDraftEmails(Object.fromEntries(
        nextEntries.map((entry) => [entry.supplierId, entry.email ?? ""])
      ));
      setDraftNames(Object.fromEntries(
        nextEntries.map((entry) => [entry.supplierId, entry.supplierName])
      ));
      setLoadedRestaurantId(restaurantId);
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, { flow: "suppliers", operation: "load", restaurant_id: restaurantId });
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
    setDraftEmails({});
    setDraftNames({});
    setLoadedRestaurantId(null);
    setLoadError(false);
    setSavingKeys(new Set());
    setNotice(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: savingKeys.size > 0
  });
  // Soft-refresh / load errors clear visible rows via hubReady; do not also
  // claim "no suppliers" while the directory is unavailable or still loading.
  const visibleEntries = hubReady ? entries : [];

  async function saveRecipient(entry: SupplierRecipientDirectoryEntry) {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    const key = entry.supplierId;
    if (actionLocksRef.current.has(key)) return;
    const email = (draftEmails[key] ?? "").trim();
    if (!isValidRecipientEmail(email)) {
      setNotice({
        tone: "warning",
        title: copy.invalidTitle,
        message: copy.invalidBody(entry.supplierName)
      });
      return;
    }

    actionLocksRef.current.add(key);
    setSavingKeys((current) => new Set(current).add(key));
    setNotice(null);
    try {
      const saved = await saveSupplierRecipient(restaurantId, entry.supplierId, email);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setEntries((current) => current.map((currentEntry) =>
        currentEntry.supplierId === key
          ? {
              ...currentEntry,
              email: saved.email,
              recipientId: saved.id,
              updatedAt: saved.updated_at,
              source: currentEntry.source === "current" ? "current_and_saved" : currentEntry.source
            }
          : currentEntry
      ));
      setDraftEmails((current) => ({ ...current, [key]: saved.email ?? "" }));
      setNotice({
        tone: "success",
        title: copy.savedTitle,
        message: copy.savedBody(entry.supplierName)
      });
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "suppliers",
        operation: "save_recipient",
        restaurant_id: restaurantId
      });
      setNotice({
        tone: "danger",
        title: copy.saveErrorTitle,
        message: copy.saveErrorBody(entry.supplierName)
      });
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

  async function rename(entry: SupplierRecipientDirectoryEntry) {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    const key = entry.supplierId;
    if (actionLocksRef.current.has(key)) return;
    const requestedName = draftNames[key] ?? "";
    const displayName = canonicalSupplierName(requestedName);
    if (!isValidSupplierName(requestedName)) {
      setNotice({
        tone: "warning",
        title: copy.invalidNameTitle,
        message: copy.invalidNameBody
      });
      return;
    }

    actionLocksRef.current.add(key);
    setSavingKeys((current) => new Set(current).add(key));
    setNotice(null);
    try {
      await renameSupplier(restaurantId, entry.supplierId, displayName);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setEntries((current) => current.map((currentEntry) =>
        currentEntry.supplierId === key
          ? { ...currentEntry, supplierName: displayName }
          : currentEntry
      ));
      setDraftNames((current) => ({ ...current, [key]: displayName }));
      setNotice({
        tone: "success",
        title: copy.renamedTitle,
        message: copy.renamedBody(displayName)
      });
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "suppliers",
        operation: "rename_supplier",
        restaurant_id: restaurantId
      });
      setNotice({
        tone: "danger",
        title: copy.renameErrorTitle,
        message: copy.renameErrorBody(entry.supplierName)
      });
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

  const configuredCount = useMemo(
    () => visibleEntries.filter((entry) => Boolean(entry.email)).length,
    [visibleEntries]
  );

  return (
    <Screen
      title={copy.title}
      subtitle={copy.subtitle}
      loading={loading}
      keyboardAware
      action={
        <ActionIcon accessibilityLabel={copy.back} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
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
            <StatusNotice
              tone="danger"
              title={copy.loadErrorTitle}
              message={copy.loadErrorBody}
              actionLabel={copy.retry}
              actionAccessibilityLabel={copy.retryAccessibility}
              onAction={() => void load()}
            />
          ) : null}

          {notice ? <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} /> : null}

          <StatusNotice
            icon={<ShieldCheck size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            title={copy.safetyTitle}
            message={copy.safetyBody}
          />

          <SectionSurface
            title={copy.sectionTitle}
            subtitle={copy.sectionSubtitle}
            action={
              !hubReady
                ? undefined
                : copy.configuredCount(formatNumber(configuredCount), formatNumber(visibleEntries.length))
            }
            padding="none"
          >
            {!hubReady ? null : visibleEntries.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState compact title={copy.emptyTitle} body={copy.emptyBody} />
              </View>
            ) : (
              visibleEntries.map((entry, index) => {
                const key = entry.supplierId;
                const draftEmail = draftEmails[key] ?? "";
                const draftName = draftNames[key] ?? entry.supplierName;
                const saving = savingKeys.has(key);
                const emailUnchanged = draftEmail.trim().toLowerCase() === (entry.email ?? "").toLowerCase();
                const nameUnchanged = canonicalSupplierName(draftName) === entry.supplierName;
                return (
                  <View
                    key={key}
                    style={[styles.recipientRow, index > 0 && styles.dividedRow]}
                  >
                    <View style={styles.recipientHeader}>
                      <IconBadge tone={entry.email ? "leaf" : "warning"}>
                        <Mail
                          size={icon.emphasis}
                          color={entry.email ? colors.success : colors.warning}
                          strokeWidth={iconStroke}
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
                        <Text style={styles.inputLabel}>{copy.nameLabel}</Text>
                        <TextInput
                          accessibilityLabel={copy.nameAccessibility(entry.supplierName)}
                          accessibilityHint={copy.nameHint}
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={actionsEditable && !saving}
                          maxLength={160}
                          onChangeText={(value) => setDraftNames((current) => ({ ...current, [key]: value }))}
                          onSubmitEditing={() => {
                            if (!nameUnchanged && actionsEditable && !saving) void rename(entry);
                          }}
                          placeholder={copy.namePlaceholder}
                          placeholderTextColor={colors.faint}
                          returnKeyType="done"
                          style={styles.input}
                          value={draftName}
                        />
                        <Button
                          title={saving ? copy.saving : copy.rename}
                          accessibilityLabel={copy.renameAccessibility(entry.supplierName)}
                          accessibilityHint={copy.renameHint}
                          variant="secondary"
                          fullWidth
                          disabled={!actionsEditable || saving || nameUnchanged}
                          onPress={() => void rename(entry)}
                        />
                        <Text style={styles.inputLabel}>{copy.emailLabel}</Text>
                        <TextInput
                          accessibilityLabel={copy.emailAccessibility(entry.supplierName)}
                          accessibilityHint={copy.emailHint}
                          autoCapitalize="none"
                          autoComplete="email"
                          autoCorrect={false}
                          editable={actionsEditable && !saving}
                          keyboardType="email-address"
                          onChangeText={(value) => setDraftEmails((current) => ({ ...current, [key]: value }))}
                          onSubmitEditing={() => {
                            if (!emailUnchanged && actionsEditable && !saving) void saveRecipient(entry);
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
                          disabled={!actionsEditable || saving || emailUnchanged}
                          onPress={() => void saveRecipient(entry)}
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

function canonicalSupplierName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isValidSupplierName(value: string) {
  const canonical = canonicalSupplierName(value);
  return canonical.length >= 1 && canonical.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value);
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

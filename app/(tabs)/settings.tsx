import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  Languages,
  LogOut,
  Mail,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Store,
  Trash2,
  Truck,
  Upload
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { IconBadge } from "../../components/ui/IconBadge";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, fontFamilies, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { LANGUAGE_OPTIONS, type MessageKey, type MessageValues } from "../../i18n/catalog";
import { DEMO_DATASET } from "../../services/demoData";
import {
  deleteAccount,
  fetchDemoReadinessSummary,
  fetchEmailConnectionState,
  fetchRestaurantOpsProfile,
  fetchSuppliers
} from "../../services/miseService";
import { canDeleteRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import type {
  DemoReadinessSummary,
  RestaurantEmailConnection,
  RestaurantOpsProfile,
  RestaurantRole,
  RestaurantServiceStyle
} from "../../types/mise";

type Translator = (key: MessageKey, values?: MessageValues) => string;
type SettingsNotice = { key: MessageKey; tone: StatusNoticeTone };

export default function SettingsScreen() {
  const { formatList, formatNumber, locale, t } = useLocale();
  const {
    availableRestaurants,
    isDemoMode,
    memberships,
    restaurant,
    posProvider,
    resetDemoData,
    role,
    signOut,
    switchRestaurant,
    usingLocalDemo,
    user
  } = useMiseSession();
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [opsProfile, setOpsProfile] = useState<RestaurantOpsProfile | null>(null);
  const [emailConnection, setEmailConnection] = useState<RestaurantEmailConnection | null>(null);
  const [readiness, setReadiness] = useState<DemoReadinessSummary | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [message, setMessage] = useState<SettingsNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [switchingRestaurantId, setSwitchingRestaurantId] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setSuppliers([]);
    setOpsProfile(null);
    setEmailConnection(null);
    setReadiness(null);
    setDiagnosticsOpen(false);
    setMessage(null);
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setSuppliers([]);
      setOpsProfile(null);
      setEmailConnection(null);
      setReadiness(null);
      return;
    }

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    try {
      const [nextSuppliers, nextOpsProfile, nextEmailConnection, nextReadiness] = await Promise.all([
        fetchSuppliers(restaurantId),
        fetchRestaurantOpsProfile(restaurantId),
        fetchEmailConnectionState(restaurantId),
        __DEV__ && isDemoMode ? fetchDemoReadinessSummary(restaurantId) : Promise.resolve(null)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSuppliers(nextSuppliers);
      setOpsProfile(nextOpsProfile);
      setEmailConnection(nextEmailConnection);
      setReadiness(nextReadiness);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "settings", operation: "load", restaurant_id: restaurantId });
      setMessage({ key: "settings.notice.loadError", tone: "danger" });
    }
  }, [isDemoMode, restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function reset() {
    setLoading(true);
    setMessage(null);
    try {
      await resetDemoData({
        preset: DEMO_DATASET.id,
        posProvider: posProvider ?? DEMO_DATASET.defaultPosProvider
      });
      await load();
      setMessage({ key: "settings.notice.demoRestored", tone: "success" });
    } catch (resetError) {
      captureMiseError(resetError, { flow: "settings", operation: "restore_demo", restaurant_id: restaurant?.id });
      setMessage({ key: "settings.notice.demoRestoreError", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function leave() {
    setSigningOut(true);
    setMessage(null);
    try {
      await signOut();
      router.replace("/login");
    } catch (signOutError) {
      captureMiseError(signOutError, { flow: "settings", operation: "sign_out" });
      setMessage({ key: "settings.notice.signOutError", tone: "danger" });
      setSigningOut(false);
    }
  }

  async function removeAccount() {
    if (deletingAccount || !restaurant) return;
    setDeletingAccount(true);
    setMessage(null);
    try {
      await deleteAccount(restaurant.id);
      await signOut();
      router.replace("/login");
    } catch (deleteError) {
      captureMiseError(deleteError, { flow: "settings", operation: "delete_account", restaurant_id: restaurant.id });
      setMessage({ key: "settings.notice.deleteAccountError", tone: "danger" });
      setDeletingAccount(false);
    }
  }

  async function chooseRestaurant(restaurantId: string) {
    if (restaurantId === restaurant?.id || switchingRestaurantId) return;
    setSwitchingRestaurantId(restaurantId);
    setMessage(null);
    try {
      await switchRestaurant(restaurantId);
    } catch (switchError) {
      captureMiseError(switchError, { flow: "settings", operation: "switch_restaurant", restaurant_id: restaurantId });
      setMessage({ key: "settings.notice.switchError", tone: "danger" });
    } finally {
      setSwitchingRestaurantId(null);
    }
  }

  const visibleSuppliers = loadedRestaurantId === restaurant?.id ? suppliers : [];
  const visibleOpsProfile = loadedRestaurantId === restaurant?.id ? opsProfile : null;
  const visibleEmailConnection = loadedRestaurantId === restaurant?.id ? emailConnection : null;
  const visibleReadiness = loadedRestaurantId === restaurant?.id ? readiness : null;
  const gmailConnected = visibleEmailConnection?.status === "connected";
  const gmailNeedsAttention = visibleEmailConnection?.status === "needs_reauth" || visibleEmailConnection?.status === "restricted";
  const canExportRestaurant = Boolean(restaurant) && canDeleteRestaurantData(memberships, restaurant?.id);
  const localizedRole = role ? roleLabel(role, t) : null;
  const profileLine = restaurant
    ? `${restaurant.cuisine_type?.trim() || t("settings.profile.cuisineFallback")} · ${serviceStyleLabel(restaurant.service_style, t)}`
    : t("settings.workspace.metaFallback");

  return (
    <Screen title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <View style={styles.stack}>
        {message ? <StatusNotice title={t(message.key)} tone={message.tone} /> : null}

        <View style={styles.accountHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(user?.name || user?.email || "Mise")}</Text>
          </View>
          <View style={styles.accountHeroCopy}>
            <Text style={styles.accountHeroName}>{user?.name?.trim() || t("settings.account.title")}</Text>
            <Text style={styles.accountHeroMeta}>
              {localizedRole ? t("settings.account.signedInAs", { role: localizedRole }) : t("settings.account.operator")}
            </Text>
            <Text style={styles.accountHeroEmail}>{user?.email?.trim() || t("settings.account.emailMissing")}</Text>
          </View>
          {localizedRole ? <Badge label={localizedRole} tone="neutral" /> : null}
        </View>

        <SettingsSection title={t("settings.section.restaurant")}>
          <View style={styles.profileRow}>
            <IconBadge tone="brand">
              <Store size={20} color={colors.accentDark} strokeWidth={2.25} />
            </IconBadge>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{restaurant?.name ?? t("settings.profile.noRestaurant")}</Text>
              <Text style={styles.profileMeta}>{profileLine}</Text>
              {restaurant?.address ? (
                <Text style={styles.profileMeta}>{restaurant.address}</Text>
              ) : (
                <Text style={styles.profileMetaMuted}>{t("settings.profile.addressMissing")}</Text>
              )}
            </View>
            {localizedRole ? <Badge label={localizedRole} tone="neutral" /> : null}
          </View>

          {restaurant ? (
            <View style={styles.identityGrid}>
              <IdentityFact label={t("settings.profile.timezone")} value={restaurant.timezone} />
              <IdentityFact label={t("settings.profile.currency")} value={restaurant.currency} />
              <IdentityFact
                label={t("settings.profile.serviceStyle")}
                value={serviceStyleLabel(restaurant.service_style, t)}
              />
              <IdentityFact
                label={t("settings.profile.orderCadence")}
                value={
                  restaurant.operational_profile.orderCadence.length > 0
                    ? formatList(restaurant.operational_profile.orderCadence)
                    : t("settings.profile.orderCadenceEmpty")
                }
              />
            </View>
          ) : null}

          {availableRestaurants.length > 1 ? (
            <View style={styles.workspaceList}>
              {availableRestaurants.map((item) => {
                const selected = item.id === restaurant?.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: selected || Boolean(switchingRestaurantId) }}
                    accessibilityLabel={t(
                      selected ? "settings.workspace.currentAccessibility" : "settings.workspace.switchAccessibility",
                      { restaurant: item.name }
                    )}
                    accessibilityHint={selected ? undefined : t("settings.workspace.switchHint")}
                    disabled={selected || Boolean(switchingRestaurantId)}
                    onPress={() => void chooseRestaurant(item.id)}
                    style={({ pressed }) => [
                      styles.workspaceRow,
                      selected && styles.workspaceRowSelected,
                      switchingRestaurantId === item.id && styles.workspaceRowBusy,
                      pressed && styles.pressed
                    ]}
                  >
                    <Building2 size={20} color={selected ? colors.accentDark : colors.muted} strokeWidth={2.25} />
                    <View style={styles.workspaceCopy}>
                      <Text style={styles.workspaceName}>{item.name}</Text>
                      <Text style={styles.workspaceMeta}>{item.cuisine_type ?? t("settings.workspace.metaFallback")}</Text>
                    </View>
                    {selected ? <Check size={20} color={colors.success} strokeWidth={2.25} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </SettingsSection>

        <SettingsSection title={t("settings.section.preferences")}>
          <OperationalRow
            title={t("settings.preference.language")}
            subtitle={LANGUAGE_OPTIONS.find((option) => option.locale === locale)?.nativeName ?? locale}
            icon={<Languages size={20} color={colors.caution} strokeWidth={2.25} />}
            iconTone="caution"
            onPress={() => router.push("/settings/language" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.integrations")}>
          {isDemoMode ? (
            <OperationalRow
              title={t("settings.integration.pos.title")}
              subtitle={posProvider
                ? t("settings.integration.pos.connectedSubtitle", { provider: posProviderLabel(posProvider, t) })
                : t("settings.integration.pos.notConnectedSubtitle")}
              icon={<PlugZap size={20} color={posProvider ? colors.success : colors.muted} strokeWidth={2.25} />}
              iconTone={posProvider ? "leaf" : "neutral"}
              badgeLabel={t(posProvider ? "settings.integration.pos.connected" : "settings.integration.pos.notConnected")}
              badgeTone={posProvider ? "success" : "neutral"}
              onPress={() => router.push("/settings/pos")}
            />
          ) : (
            <OperationalRow
              title={t("settings.integration.noPos.title")}
              subtitle={t("settings.integration.noPos.body")}
              icon={<PlugZap size={20} color={colors.muted} strokeWidth={2.25} />}
              iconTone="neutral"
              onPress={() => router.push("/settings/sales-import" as never)}
            />
          )}
          <OperationalRow
            title={t("settings.integration.gmail.title")}
            titleLines={2}
            subtitle={gmailConnectionSubtitle(visibleEmailConnection, t)}
            icon={
              <Mail
                size={20}
                color={gmailConnected ? colors.success : gmailNeedsAttention ? colors.caution : colors.muted}
                strokeWidth={2.25}
              />
            }
            iconTone={gmailConnected ? "leaf" : gmailNeedsAttention ? "caution" : "neutral"}
            badgeLabel={gmailConnectionBadge(visibleEmailConnection, t)}
            badgeTone={gmailConnected ? "success" : gmailNeedsAttention ? "caution" : "neutral"}
            onPress={() => router.push("/settings/gmail" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.operations")}>
          <OperationalRow
            title={t("settings.operations.salesImport.title")}
            subtitle={t("settings.operations.salesImport.body")}
            icon={<Upload size={20} color={colors.success} strokeWidth={2.25} />}
            iconTone="leaf"
            onPress={() => router.push("/settings/sales-import" as never)}
          />
          <OperationalRow
            title={t("settings.operations.recipes.title")}
            subtitle={t("settings.operations.recipes.body")}
            icon={<BookOpen size={20} color={colors.caution} strokeWidth={2.25} />}
            iconTone="caution"
            onPress={() => router.push("/settings/recipes" as never)}
          />
          <OperationalRow
            title={t("settings.operations.suppliers.title")}
            subtitle={supplierSummary(visibleSuppliers, t, formatList, formatNumber)}
            icon={<Truck size={20} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            value={formatNumber(visibleSuppliers.length)}
            onPress={() => router.push("/settings/suppliers" as never)}
          />
          {restaurant ? (
            <View style={styles.quietRow}>
              <IconBadge tone="leaf">
                <ShieldCheck size={20} color={colors.success} strokeWidth={2.25} />
              </IconBadge>
              <View style={styles.quietCopy}>
                <Text style={styles.rowTitle}>{t("settings.operations.service.title")}</Text>
                <Text style={styles.rowBody}>
                  {serviceStyleLabel(restaurant.service_style, t)} · {restaurant.timezone} · {restaurant.currency}
                </Text>
              </View>
            </View>
          ) : null}
        </SettingsSection>

        <SettingsSection title={t("settings.section.data")}>
          <View style={styles.quietRow}>
            <IconBadge tone={usingLocalDemo ? "neutral" : "leaf"}>
              <Database size={20} color={usingLocalDemo ? colors.muted : colors.success} strokeWidth={2.25} />
            </IconBadge>
            <View style={styles.quietCopy}>
              <Text style={styles.rowTitle}>{t(usingLocalDemo ? "settings.data.local.title" : "settings.data.hosted.title")}</Text>
              <Text style={styles.rowBody}>
                {t(usingLocalDemo ? "settings.data.local.body" : "settings.data.hosted.body")}
              </Text>
            </View>
          </View>

          {canExportRestaurant ? (
            <OperationalRow
              title={t("settings.data.export.title")}
              subtitle={t("settings.data.export.body")}
              icon={<Download size={20} color={colors.accentDark} strokeWidth={2.25} />}
              iconTone="brand"
              onPress={() => router.push("/settings/export" as never)}
            />
          ) : null}

          {isDemoMode ? (
            <View style={styles.sectionAction}>
              <Button
                title={t(loading ? "settings.data.restoring" : "settings.data.restore")}
                variant="secondary"
                icon={<RefreshCw size={18} color={colors.text} strokeWidth={2.25} />}
                onPress={reset}
                disabled={loading}
                fullWidth
              />
            </View>
          ) : null}

          {__DEV__ && visibleReadiness ? (
            <View style={styles.diagnostics}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: diagnosticsOpen }}
                accessibilityLabel={t("settings.diagnostics.toggleAccessibility", {
                  state: t(diagnosticsOpen ? "settings.diagnostics.expanded" : "settings.diagnostics.collapsed")
                })}
                accessibilityHint={t("settings.diagnostics.toggleHint")}
                onPress={() => setDiagnosticsOpen((open) => !open)}
                style={({ pressed }) => [styles.diagnosticsToggle, pressed && styles.pressed]}
              >
                <View style={styles.diagnosticsCopy}>
                  <Text style={styles.diagnosticsTitle}>{t("settings.diagnostics.title")}</Text>
                  <Text style={styles.diagnosticsMeta}>
                    {t("settings.diagnostics.readyPercent", {
                      percent: formatNumber(visibleReadiness.score / 100, { style: "percent", maximumFractionDigits: 0 })
                    })}
                  </Text>
                </View>
                {diagnosticsOpen ? (
                  <ChevronUp size={20} color={colors.muted} strokeWidth={2.25} />
                ) : (
                  <ChevronDown size={20} color={colors.muted} strokeWidth={2.25} />
                )}
              </Pressable>
              {diagnosticsOpen ? (
                <View style={styles.diagnosticsList}>
                  {visibleReadiness.checks.map((check) => (
                    <View key={check.id} style={styles.diagnosticRow}>
                      <View style={[styles.diagnosticDot, { backgroundColor: check.status === "ready" ? colors.success : colors.caution }]} />
                      <Text style={styles.diagnosticLabel}>{readinessCheckLabel(check.id, t)}</Text>
                      <Text style={styles.diagnosticStatus}>
                        {t(check.status === "ready" ? "settings.diagnostics.status.ready" : "settings.diagnostics.status.review")}
                      </Text>
                    </View>
                  ))}
                  {visibleOpsProfile ? (
                    <Text style={styles.diagnosticFootnote}>
                      {t(
                        visibleOpsProfile.posIntegrations.length === 1
                          ? "settings.diagnostics.posRecord.one"
                          : "settings.diagnostics.posRecord.other",
                        { count: formatNumber(visibleOpsProfile.posIntegrations.length) }
                      )} · {t(
                        visibleOpsProfile.supplierItems.length === 1
                          ? "settings.diagnostics.catalogItem.one"
                          : "settings.diagnostics.catalogItem.other",
                        { count: formatNumber(visibleOpsProfile.supplierItems.length) }
                      )}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </SettingsSection>

        <SettingsSection title={t("settings.section.account")}>
          <View style={styles.sectionAction}>
            <Button
              title={t(signingOut ? "settings.account.signingOut" : "settings.account.signOut")}
              variant="ghost"
              icon={<LogOut size={18} color={colors.text} strokeWidth={2.25} />}
              onPress={leave}
              disabled={signingOut}
              fullWidth
            />
          </View>
          <View style={styles.dangerZone}>
            <Text style={styles.rowTitle}>{t("settings.account.deleteTitle")}</Text>
            <Text style={styles.rowBody}>{t("settings.account.deleteBody")}</Text>
            {deleteConfirmOpen ? (
              <View style={styles.deleteConfirm}>
                <StatusNotice
                  tone="danger"
                  title={t("settings.account.deleteWarningTitle")}
                  message={t("settings.account.deleteWarningBody")}
                />
                <Text style={styles.deleteConfirmLabel}>
                  {t("settings.account.deleteConfirmLabel", { word: t("settings.account.deleteConfirmWord") })}
                </Text>
                <TextInput
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  accessibilityLabel={t("settings.account.deleteConfirmAccessibility")}
                  accessibilityHint={t("settings.account.deleteConfirmHint", {
                    word: t("settings.account.deleteConfirmWord")
                  })}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!deletingAccount}
                  placeholder={t("settings.account.deleteConfirmWord")}
                  placeholderTextColor={colors.faint}
                  style={styles.deleteConfirmInput}
                />
                <Button
                  title={t(deletingAccount ? "settings.account.deleting" : "settings.account.deleteConfirm")}
                  variant="danger"
                  icon={<Trash2 size={18} color={colors.surface} strokeWidth={2.25} />}
                  onPress={removeAccount}
                  disabled={
                    deletingAccount ||
                    deleteConfirmText.trim().toLowerCase() !==
                      t("settings.account.deleteConfirmWord").toLowerCase()
                  }
                  fullWidth
                />
                <Button
                  title={t("common.cancel")}
                  variant="ghost"
                  onPress={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteConfirmText("");
                  }}
                  disabled={deletingAccount}
                  fullWidth
                />
              </View>
            ) : (
              <View style={styles.deleteOpenAction}>
                <Button
                  title={t("settings.account.deleteTitle")}
                  accessibilityHint={t("settings.account.deleteOpenHint")}
                  variant="secondary"
                  icon={<Trash2 size={18} color={colors.danger} strokeWidth={2.25} />}
                  onPress={() => setDeleteConfirmOpen(true)}
                  fullWidth
                />
              </View>
            )}
          </View>
        </SettingsSection>
      </View>
    </Screen>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionSurface}>{children}</View>
    </View>
  );
}

function IdentityFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.identityFact}>
      <Text style={styles.identityLabel}>{label}</Text>
      <Text style={styles.identityValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function gmailConnectionSubtitle(connection: RestaurantEmailConnection | null, t: Translator) {
  if (connection?.status === "connected") {
    return connection.sender_email
      ? t("settings.integration.gmail.connectedWithSender", { sender: connection.sender_email })
      : t("settings.integration.gmail.connected");
  }
  if (connection?.status === "needs_reauth") return t("settings.integration.gmail.reconnect");
  if (connection?.status === "restricted") return t("settings.integration.gmail.restricted");
  return t("settings.integration.gmail.notConnected");
}

function gmailConnectionBadge(connection: RestaurantEmailConnection | null, t: Translator) {
  if (connection?.status === "connected") return t("settings.gmail.status.connected");
  if (connection?.status === "needs_reauth") return t("settings.gmail.status.needsReauth");
  if (connection?.status === "restricted") return t("settings.gmail.status.restricted");
  return t("settings.gmail.status.notConnected");
}

function supplierSummary(
  suppliers: string[],
  t: Translator,
  formatList: (values: readonly string[], options?: Intl.ListFormatOptions) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
) {
  if (suppliers.length === 0) return t("settings.operations.suppliers.empty");
  if (suppliers.length <= 2) return formatList(suppliers);
  return t("settings.operations.suppliers.more", {
    suppliers: formatList(suppliers.slice(0, 2)),
    count: formatNumber(suppliers.length - 2)
  });
}

function roleLabel(role: RestaurantRole, t: Translator) {
  return t(`settings.role.${role}` as MessageKey);
}

function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function serviceStyleLabel(style: RestaurantServiceStyle, t: Translator) {
  const keyByStyle: Record<RestaurantServiceStyle, MessageKey> = {
    quick_service: "settings.serviceStyle.quickService",
    fast_casual: "settings.serviceStyle.fastCasual",
    full_service: "settings.serviceStyle.fullService",
    bar: "settings.serviceStyle.bar",
    cafe: "settings.serviceStyle.cafe",
    ghost_kitchen: "settings.serviceStyle.ghostKitchen"
  };
  return t(keyByStyle[style]);
}

function posProviderLabel(provider: string, t: Translator) {
  if (provider === "manual_csv") return t("settings.integration.pos.manualCsv");
  if (provider === "demo") return t("common.demo");
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function readinessCheckLabel(checkId: string, t: Translator) {
  const keyById: Record<string, MessageKey> = {
    profile: "settings.diagnostics.check.profile",
    pos: "settings.diagnostics.check.pos",
    recipes: "settings.diagnostics.check.recipes",
    inventory: "settings.diagnostics.check.inventory",
    orders: "settings.diagnostics.check.orders",
    insights: "settings.diagnostics.check.insights"
  };
  return t(keyById[checkId] ?? "settings.diagnostics.check.default");
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg
  },
  accountHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  avatarText: {
    color: colors.accentDark,
    fontFamily: fontFamilies.bold,
    fontSize: 19,
    lineHeight: 24
  },
  accountHeroCopy: {
    flex: 1,
    minWidth: 0
  },
  accountHeroName: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    lineHeight: 23
  },
  accountHeroMeta: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  accountHeroEmail: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    ...typography.sectionTitle
  },
  sectionSurface: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14
  },
  profileRow: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  profileCopy: {
    flex: 1,
    minWidth: 0
  },
  profileName: {
    color: colors.text,
    ...typography.cardTitle
  },
  profileMeta: {
    color: colors.muted,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  profileMetaMuted: {
    color: colors.faint,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  identityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  identityFact: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: 0,
    gap: 2,
    paddingVertical: 4
  },
  identityLabel: {
    color: colors.faint,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 14
  },
  identityValue: {
    color: colors.text,
    fontFamily: typography.families.medium,
    fontSize: 13,
    lineHeight: 17
  },
  workspaceList: {
    paddingBottom: spacing.sm
  },
  workspaceRow: {
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm
  },
  workspaceRowSelected: {
    backgroundColor: colors.accentSoft
  },
  workspaceRowBusy: {
    opacity: 0.58
  },
  workspaceCopy: {
    flex: 1,
    minWidth: 0
  },
  workspaceName: {
    color: colors.text,
    ...typography.cardTitle
  },
  workspaceMeta: {
    color: colors.muted,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  quietRow: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md
  },
  quietCopy: {
    flex: 1,
    minWidth: 0
  },
  rowTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  rowBody: {
    color: colors.muted,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  rowValue: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 17,
    lineHeight: 21
  },
  sectionAction: {
    paddingVertical: spacing.md
  },
  dangerZone: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md
  },
  deleteOpenAction: {
    marginTop: spacing.md
  },
  deleteConfirm: {
    marginTop: spacing.md,
    gap: spacing.sm
  },
  deleteConfirmLabel: {
    color: colors.text,
    ...typography.caption
  },
  deleteConfirmInput: {
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
  diagnostics: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  diagnosticsToggle: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  diagnosticsCopy: {
    flex: 1
  },
  diagnosticsTitle: {
    color: colors.text,
    ...typography.caption
  },
  diagnosticsMeta: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 16
  },
  diagnosticsList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm
  },
  diagnosticRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  diagnosticDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  diagnosticLabel: {
    flex: 1,
    color: colors.text,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  diagnosticStatus: {
    color: colors.muted,
    ...typography.caption
  },
  diagnosticFootnote: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm
  },
  pressed: {
    opacity: 0.68
  }
});

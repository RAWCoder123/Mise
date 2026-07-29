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
  LifeBuoy,
  ArrowLeft,
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

import { Button } from "../../components/ui/Button";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, fontFamilies, radii, typography } from "../../constants/theme";
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
  const { formatNumber, locale, t } = useLocale();
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


  return (
    <Screen
      title={t("settings.profile.screenTitle")}
      titleAlign="center"
      leadingAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}
        >
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.1} />
        </Pressable>
      }
    >
      <View style={styles.stack}>
        {message ? <StatusNotice title={t(message.key)} tone={message.tone} /> : null}

        <View style={styles.accountHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(user?.name || user?.email || "Mise")}</Text>
          </View>
          <View style={styles.accountHeroCopy}>
            <Text style={styles.accountHeroName}>{user?.name?.trim() || t("settings.account.title")}</Text>
            <Text style={styles.accountHeroMeta}>
              {localizedRole ?? t("settings.account.operator")}
            </Text>
            <Text style={styles.accountHeroEmail}>{user?.email?.trim() || t("settings.account.emailMissing")}</Text>
          </View>
        </View>

        <SettingsSection title={t("settings.section.account")}>
          <OperationalRow
            title={t("settings.account.privacy.title")}
            icon={<ShieldCheck size={18} color={colors.success} strokeWidth={2.25} />}
            iconTone="leaf"
            onPress={() => router.push("/settings/privacy" as never)}
          />
          <OperationalRow
            title={t("settings.account.support.title")}
            icon={<LifeBuoy size={18} color={colors.accentDark} strokeWidth={2.25} />}
            iconTone="brand"
            onPress={() => router.push("/settings/support" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.restaurant")}>
          <OperationalRow
            title={restaurant?.name ?? t("settings.profile.noRestaurant")}
            value={localizedRole ?? undefined}
            icon={<Store size={18} color={colors.accentDark} strokeWidth={2.25} />}
            iconTone="brand"
          />
          {restaurant ? (
            <>
              <OperationalRow
                title={t("settings.profile.timezone")}
                value={restaurant.timezone}
                icon={<Building2 size={18} color={colors.muted} strokeWidth={2.25} />}
                iconTone="neutral"
              />
              <OperationalRow
                title={t("settings.profile.currency")}
                value={restaurant.currency}
                icon={<Building2 size={18} color={colors.muted} strokeWidth={2.25} />}
                iconTone="neutral"
              />
              <OperationalRow
                title={t("settings.profile.serviceStyle")}
                value={serviceStyleLabel(restaurant.service_style, t)}
                icon={<Store size={18} color={colors.muted} strokeWidth={2.25} />}
                iconTone="neutral"
              />
            </>
          ) : null}
          {availableRestaurants.length > 1
            ? availableRestaurants.map((item) => {
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
                    <Building2 size={18} color={selected ? colors.accentDark : colors.muted} strokeWidth={2.25} />
                    <View style={styles.workspaceCopy}>
                      <Text style={styles.workspaceName}>{item.name}</Text>
                      <Text style={styles.workspaceMeta}>{item.cuisine_type ?? t("settings.workspace.metaFallback")}</Text>
                    </View>
                    {selected ? <Check size={18} color={colors.success} strokeWidth={2.25} /> : null}
                  </Pressable>
                );
              })
            : null}
        </SettingsSection>

        <SettingsSection title={t("settings.section.preferences")}>
          <OperationalRow
            title={t("settings.preference.language")}
            value={LANGUAGE_OPTIONS.find((option) => option.locale === locale)?.nativeName ?? locale}
            icon={<Languages size={18} color={colors.caution} strokeWidth={2.25} />}
            iconTone="caution"
            onPress={() => router.push("/settings/language" as never)}
          />
        </SettingsSection>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(signingOut ? "settings.account.signingOut" : "settings.account.signOut")}
          disabled={signingOut}
          onPress={leave}
          style={({ pressed }) => [styles.signOutTextButton, pressed && styles.pressed]}
        >
          <Text style={styles.signOutText}>{t(signingOut ? "settings.account.signingOut" : "settings.account.signOut")}</Text>
        </Pressable>

        <SettingsSection title={t("settings.section.integrations")}>
          {isDemoMode ? (
            <OperationalRow
              title={t("settings.integration.pos.title")}
              value={t(posProvider ? "settings.integration.pos.connected" : "settings.integration.pos.notConnected")}
              icon={<PlugZap size={18} color={posProvider ? colors.success : colors.muted} strokeWidth={2.25} />}
              iconTone={posProvider ? "leaf" : "neutral"}
              onPress={() => router.push("/settings/pos")}
            />
          ) : (
            <OperationalRow
              title={t("settings.integration.noPos.title")}
              icon={<PlugZap size={18} color={colors.muted} strokeWidth={2.25} />}
              iconTone="neutral"
              onPress={() => router.push("/settings/sales-import" as never)}
            />
          )}
          <OperationalRow
            title={t("settings.integration.gmail.title")}
            value={gmailConnectionBadge(visibleEmailConnection, t)}
            icon={
              <Mail
                size={18}
                color={gmailConnected ? colors.success : gmailNeedsAttention ? colors.caution : colors.muted}
                strokeWidth={2.25}
              />
            }
            iconTone={gmailConnected ? "leaf" : gmailNeedsAttention ? "caution" : "neutral"}
            onPress={() => router.push("/settings/gmail" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.operations")}>
          <OperationalRow
            title={t("settings.operations.salesImport.title")}
            icon={<Upload size={18} color={colors.success} strokeWidth={2.25} />}
            iconTone="leaf"
            onPress={() => router.push("/settings/sales-import" as never)}
          />
          <OperationalRow
            title={t("settings.operations.recipes.title")}
            icon={<BookOpen size={18} color={colors.caution} strokeWidth={2.25} />}
            iconTone="caution"
            onPress={() => router.push("/settings/recipes" as never)}
          />
          <OperationalRow
            title={t("settings.operations.suppliers.title")}
            value={formatNumber(visibleSuppliers.length)}
            icon={<Truck size={18} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/settings/suppliers" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.data")}>
          <OperationalRow
            title={t(usingLocalDemo ? "settings.data.local.title" : "settings.data.hosted.title")}
            icon={<Database size={18} color={usingLocalDemo ? colors.muted : colors.success} strokeWidth={2.25} />}
            iconTone={usingLocalDemo ? "neutral" : "leaf"}
          />

          {canExportRestaurant ? (
            <OperationalRow
              title={t("settings.data.export.title")}
              icon={<Download size={18} color={colors.accentDark} strokeWidth={2.25} />}
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

function gmailConnectionBadge(connection: RestaurantEmailConnection | null, t: Translator) {
  if (connection?.status === "connected") return t("settings.gmail.status.connected");
  if (connection?.status === "needs_reauth") return t("settings.gmail.status.needsReauth");
  if (connection?.status === "restricted") return t("settings.gmail.status.restricted");
  return t("settings.gmail.status.notConnected");
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
    gap: 12
  },
  accountHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft
  },
  avatarText: {
    color: colors.accentDark,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    lineHeight: 20
  },
  accountHeroCopy: {
    flex: 1,
    minWidth: 0
  },
  accountHeroName: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    lineHeight: 20
  },
  accountHeroMeta: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    lineHeight: 15,
    marginTop: 1
  },
  accountHeroEmail: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1
  },
  section: {
    gap: 4
  },
  sectionTitle: {
    color: colors.text,
    ...typography.sectionTitle
  },
  sectionSurface: {
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 0
  },
  workspaceRow: {
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 2
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
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 16
  },
  workspaceMeta: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 14
  },
  rowTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  rowBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2
  },
  sectionAction: {
    paddingVertical: 10
  },
  dangerZone: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: 10,
    gap: 4
  },
  deleteOpenAction: {
    marginTop: 8
  },
  deleteConfirm: {
    marginTop: 8,
    gap: 8
  },
  deleteConfirmLabel: {
    color: colors.text,
    ...typography.caption
  },
  deleteConfirmInput: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    ...typography.body,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  diagnostics: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  diagnosticsToggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
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
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 14
  },
  diagnosticsList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: 8
  },
  diagnosticRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  diagnosticDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  diagnosticLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 16
  },
  diagnosticStatus: {
    color: colors.muted,
    ...typography.caption
  },
  diagnosticFootnote: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6
  },
  signOutTextButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    marginBottom: 4
  },
  signOutText: {
    color: colors.accent,
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 16
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.68
  }
});

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
  LogOut,
  Mail,
  PlugZap,
  RefreshCw,
  Shield,
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
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, density, fontFamilies, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { LANGUAGE_OPTIONS, type MessageKey, type MessageValues } from "../../i18n/catalog";
import { DEMO_DATASET } from "../../services/demoData";
import {
  deleteAccount,
  fetchDemoReadinessSummary,
  fetchEmailConnectionState,
  fetchRestaurantOpsProfile,
  fetchSuppliers,
  leaveMyRestaurantMembership
} from "../../services/miseService";
import { canLeaveRestaurantMembership, TeamMembershipError } from "../../services/domain/teamMembership";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
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
    refreshWorkspaceAccess,
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
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leavingRestaurant, setLeavingRestaurant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [switchingRestaurantId, setSwitchingRestaurantId] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [hubLoadError, setHubLoadError] = useState(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setHubLoadError(false);
    setSuppliers([]);
    setOpsProfile(null);
    setEmailConnection(null);
    setReadiness(null);
    setDiagnosticsOpen(false);
    setMessage(null);
    setLeaveConfirmOpen(false);
    setLeavingRestaurant(false);
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
      setSuppliers(nextSuppliers.map((supplier) => supplier.display_name));
      setOpsProfile(nextOpsProfile);
      setEmailConnection(nextEmailConnection);
      setReadiness(nextReadiness);
      setLoadedRestaurantId(restaurantId);
      setHubLoadError(false);
      setMessage((current) => (current?.key === "settings.notice.loadError" ? null : current));
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "settings", operation: "load", restaurant_id: restaurantId });
      setHubLoadError(true);
      setMessage({ key: "settings.notice.loadError", tone: "danger" });
    }
  }, [isDemoMode, restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function reset() {
    const hubReadyForReset =
      resolveRestaurantScopedHubLoadState({
        restaurantId: restaurant?.id,
        loadedRestaurantId,
        loadError: hubLoadError
      }) === "ready";
    if (!hubReadyForReset || loading) return;
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

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: hubLoadError
  });
  const hubReady = hubLoadState === "ready";
  const restaurantActionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: Boolean(restaurant),
    hubReady,
    busy: loading || signingOut || deletingAccount || leavingRestaurant || Boolean(switchingRestaurantId)
  });
  const visibleSuppliers = hubReady ? suppliers : [];
  const visibleOpsProfile = hubReady ? opsProfile : null;
  const visibleEmailConnection = hubReady ? emailConnection : null;
  const visibleReadiness = hubReady ? readiness : null;
  const canLeaveRestaurant = canLeaveRestaurantMembership(role) && !usingLocalDemo;

  async function leaveRestaurantWorkspace() {
    if (leavingRestaurant || !restaurant || !restaurantActionsEditable || !canLeaveRestaurant) return;
    const restaurantId = restaurant.id;
    setLeavingRestaurant(true);
    setMessage(null);
    try {
      await leaveMyRestaurantMembership(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setLeaveConfirmOpen(false);
      await refreshWorkspaceAccess();
    } catch (leaveError) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(leaveError, {
        flow: "settings",
        operation: "leave_restaurant",
        restaurant_id: restaurantId
      });
      const noticeKey =
        leaveError instanceof TeamMembershipError && leaveError.status === "permission_denied"
          ? "settings.notice.leaveRestaurantDenied"
          : "settings.notice.leaveRestaurantError";
      setMessage({ key: noticeKey, tone: "danger" });
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setLeavingRestaurant(false);
    }
  }

  async function removeAccount() {
    if (deletingAccount || !restaurant || !restaurantActionsEditable) return;
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
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
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
            density="menu"
            title={t("settings.account.privacy.title")}
            icon={<ShieldCheck size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings/privacy" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("settings.account.autonomy.title")}
            icon={<Shield size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings/autonomy" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("settings.account.support.title")}
            icon={<LifeBuoy size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings/support" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.restaurant")}>
          <OperationalRow
            density="menu"
            title={restaurant?.name ?? t("settings.profile.noRestaurant")}
            value={localizedRole ?? undefined}
            icon={<Store size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
          />
          {restaurant ? (
            <>
              <OperationalRow
                density="menu"
                title={t("settings.profile.timezone")}
                value={restaurant.timezone}
                icon={<Building2 size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
              />
              <OperationalRow
                density="menu"
                title={t("settings.profile.currency")}
                value={restaurant.currency}
                icon={<Building2 size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
              />
              <OperationalRow
                density="menu"
                title={t("settings.profile.serviceStyle")}
                value={serviceStyleLabel(restaurant.service_style, t)}
                icon={<Store size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
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
                    <Building2 size={icon.row} color={selected ? colors.accentDark : colors.muted} strokeWidth={iconStroke} />
                    <View style={styles.workspaceCopy}>
                      <Text style={styles.workspaceName}>{item.name}</Text>
                      <Text style={styles.workspaceMeta}>{item.cuisine_type ?? t("settings.workspace.metaFallback")}</Text>
                    </View>
                    {selected ? <Check size={icon.row} color={colors.success} strokeWidth={iconStroke} /> : null}
                  </Pressable>
                );
              })
            : null}
        </SettingsSection>

        <SettingsSection title={t("settings.section.preferences")}>
          <OperationalRow
            density="menu"
            title={t("settings.preference.language")}
            value={LANGUAGE_OPTIONS.find((option) => option.locale === locale)?.nativeName ?? locale}
            icon={<Languages size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings/language" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.integrations")}>
          <OperationalRow
            density="menu"
            title={t("settings.integration.pos.title")}
            value={
              isDemoMode
                ? t(posProvider ? "settings.integration.pos.connected" : "settings.integration.pos.notConnected")
                : t("settings.integration.pos.manage")
            }
            icon={<PlugZap size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            disabled={!restaurantActionsEditable}
            onPress={() => router.push("/settings/pos")}
          />
          <OperationalRow
            density="menu"
            title={t("settings.integration.gmail.title")}
            value={gmailConnectionBadge(visibleEmailConnection, t)}
            icon={
              <Mail
                size={icon.emphasis}
                color={gmailConnected ? colors.success : gmailNeedsAttention ? colors.caution : colors.muted}
                strokeWidth={iconStroke}
              />
            }
            disabled={!restaurantActionsEditable}
            onPress={() => router.push("/settings/gmail" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.operations")}>
          <OperationalRow
            density="menu"
            title={t("settings.operations.salesImport.title")}
            icon={<Upload size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            disabled={!restaurantActionsEditable}
            onPress={() => router.push("/settings/sales-import" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("settings.operations.recipes.title")}
            icon={<BookOpen size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            disabled={!restaurantActionsEditable}
            onPress={() => router.push("/settings/recipes" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("settings.operations.suppliers.title")}
            value={formatNumber(visibleSuppliers.length)}
            icon={<Truck size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            disabled={!restaurantActionsEditable}
            onPress={() => router.push("/settings/suppliers" as never)}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.section.data")}>
          <OperationalRow
            density="menu"
            title={t(usingLocalDemo ? "settings.data.local.title" : "settings.data.hosted.title")}
            icon={<Database size={icon.emphasis} color={usingLocalDemo ? colors.muted : colors.success} strokeWidth={iconStroke} />}
          />

          {canExportRestaurant ? (
            <OperationalRow
              density="menu"
              title={t("settings.data.export.title")}
              icon={<Download size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
              disabled={!restaurantActionsEditable}
              onPress={() => router.push("/settings/export" as never)}
            />
          ) : null}

          {isDemoMode ? (
            <View style={styles.sectionAction}>
              <Button
                title={t(loading ? "settings.data.restoring" : "settings.data.restore")}
                variant="secondary"
                icon={<RefreshCw size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
                onPress={reset}
                disabled={!restaurantActionsEditable || loading}
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
                  <ChevronUp size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />
                ) : (
                  <ChevronDown size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />
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
            {canLeaveRestaurant ? (
              <>
                <Text style={styles.rowTitle}>{t("settings.account.leaveTitle")}</Text>
                <Text style={styles.rowBody}>{t("settings.account.leaveBody")}</Text>
                {leaveConfirmOpen ? (
                  <View style={styles.deleteConfirm}>
                    <StatusNotice
                      tone="warning"
                      title={t("settings.account.leaveWarningTitle")}
                      message={t("settings.account.leaveWarningBody", {
                        restaurant: restaurant?.name ?? t("settings.account.operator")
                      })}
                    />
                    <Button
                      title={t(
                        leavingRestaurant
                          ? "settings.account.leaving"
                          : "settings.account.leaveConfirm"
                      )}
                      variant="danger"
                      icon={<LogOut size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
                      onPress={() => void leaveRestaurantWorkspace()}
                      disabled={!restaurantActionsEditable || leavingRestaurant}
                      fullWidth
                    />
                    <Button
                      title={t("common.cancel")}
                      variant="ghost"
                      onPress={() => setLeaveConfirmOpen(false)}
                      disabled={leavingRestaurant}
                      fullWidth
                    />
                  </View>
                ) : (
                  <View style={styles.deleteOpenAction}>
                    <Button
                      title={t("settings.account.leaveTitle")}
                      accessibilityHint={t("settings.account.leaveOpenHint")}
                      variant="secondary"
                      icon={<LogOut size={icon.row} color={colors.danger} strokeWidth={iconStroke} />}
                      onPress={() => setLeaveConfirmOpen(true)}
                      disabled={!restaurantActionsEditable}
                      fullWidth
                    />
                  </View>
                )}
              </>
            ) : null}

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
                  editable={restaurantActionsEditable && !deletingAccount}
                  placeholder={t("settings.account.deleteConfirmWord")}
                  placeholderTextColor={colors.faint}
                  style={styles.deleteConfirmInput}
                />
                <Button
                  title={t(deletingAccount ? "settings.account.deleting" : "settings.account.deleteConfirm")}
                  variant="danger"
                  icon={<Trash2 size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
                  onPress={removeAccount}
                  disabled={
                    !restaurantActionsEditable ||
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
                  icon={<Trash2 size={icon.row} color={colors.danger} strokeWidth={iconStroke} />}
                  onPress={() => setDeleteConfirmOpen(true)}
                  disabled={!restaurantActionsEditable}
                  fullWidth
                />
              </View>
            )}
          </View>
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
      </View>
    </Screen>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {/* Sentence-case ink, not a red uppercase eyebrow. Four red headings down
          one settings page is exactly the "every heading is red" failure the
          brief calls out — red is reserved for the primary action, the active
          tab, and genuinely urgent state. */}
      <SectionHeader title={title} />
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
    minHeight: density.identityRow,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft
  },
  avatarText: {
    color: colors.accentDark,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    lineHeight: 17
  },
  accountHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  accountHeroName: {
    color: colors.text,
    ...conceptTypography.sectionTitle,
    fontFamily: fontFamilies.bold
  },
  accountHeroMeta: {
    color: colors.text,
    ...conceptTypography.body,
    marginTop: 2
  },
  accountHeroEmail: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: fontFamilies.body
  },
  section: {
    gap: 6
  },
  sectionSurface: {
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12
  },
  workspaceRow: {
    minHeight: density.menuRow,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4
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
    ...conceptTypography.rowTitle
  },
  workspaceMeta: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: fontFamilies.body
  },
  rowTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  rowBody: {
    color: colors.muted,
    ...conceptTypography.body,
    marginTop: 2
  },
  sectionAction: {
    paddingVertical: 10
  },
  dangerZone: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: 12,
    gap: 8
  },
  deleteOpenAction: {
    marginTop: 8
  },
  deleteConfirm: {
    marginTop: 10,
    gap: 10
  },
  deleteConfirmLabel: {
    color: colors.text,
    ...conceptTypography.body
  },
  deleteConfirmInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    ...typography.body,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  diagnostics: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  diagnosticsToggle: {
    minHeight: density.menuRow,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8
  },
  diagnosticsCopy: {
    flex: 1
  },
  diagnosticsTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  diagnosticsMeta: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  diagnosticsList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: 12
  },
  diagnosticRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  diagnosticDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  diagnosticLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 18
  },
  diagnosticStatus: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  diagnosticFootnote: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8
  },
  signOutTextButton: {
    minHeight: density.hitTarget,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 4
  },
  signOutText: {
    color: colors.danger,
    ...conceptTypography.rowTitle
  },
  headerBack: {
    width: density.hitTarget,
    height: density.hitTarget,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.68
  }
});

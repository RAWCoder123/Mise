import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle, PlugZap } from "lucide-react-native";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Card } from "../../components/ui/Card";
import { usePressScale } from "../../components/ui/Motion";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import { DEMO_SETUP_POS_SALES_PLACEHOLDER } from "../../services/demo/demoSetupData";
import { importManualPosSalesCsv, previewManualPosSalesCsv } from "../../services/miseService";
import {
  presentPosHubHeroCopy,
  presentPosMutationActionsEditable,
  presentPosMutationBusy,
  presentPosMutationNoticeCopy,
  resolvePosCsvImportNoticeReason,
  resolvePosHubLoadState,
  type PosMutationNoticeReason
} from "../../services/presentation/posHubPresentation";
import { captureMiseError } from "../../services/telemetry";
import type { PosProvider } from "../../types/mise";

const providers: PosProvider[] = ["Toast", "Square", "Clover", "Lightspeed", "Manual CSV Upload"];

interface PosHubNotice {
  title: string;
  message: string;
  tone: StatusNoticeTone;
  restaurantId: string | null;
}

const MUTATION_NOTICE_KEYS: Record<
  PosMutationNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  csvImported: {
    title: "pos.notice.csvImportedTitle",
    message: "pos.message.csvImported"
  },
  csvImportedMapped: {
    title: "pos.notice.csvImportedMappedTitle",
    message: "pos.message.csvImportedMapped"
  },
  csvImportedWithUnmapped: {
    title: "pos.notice.csvImportedWithUnmappedTitle",
    message: "pos.message.csvImportedWithUnmapped"
  },
  csvImportedWithIncompatible: {
    title: "pos.notice.csvImportedWithIncompatibleTitle",
    message: "pos.message.csvImportedWithIncompatible"
  },
  csvImportedWithUnmappedAndIncompatible: {
    title: "pos.notice.csvImportedWithUnmappedAndIncompatibleTitle",
    message: "pos.message.csvImportedWithUnmappedAndIncompatible"
  },
  demoLoaded: {
    title: "pos.notice.demoLoadedTitle",
    message: "pos.message.demoLoaded"
  },
  demoLoadFailed: {
    title: "pos.notice.demoLoadFailedTitle",
    message: "pos.error.demoLoad"
  },
  csvImportFailed: {
    title: "pos.notice.csvImportFailedTitle",
    message: "pos.error.csvImport"
  },
  csvValidationFailed: {
    title: "pos.notice.csvValidationFailedTitle",
    message: "pos.error.csvValidation"
  },
  liveProviderRestricted: {
    title: "pos.notice.liveProviderRestrictedTitle",
    message: "pos.error.liveProviderRestricted"
  },
  loadFailed: {
    title: "pos.notice.loadFailedTitle",
    message: "pos.error.load"
  }
};

export default function POSConnectionScreen() {
  const navigation = useNavigation();
  const { formatNumber, t } = useLocale();
  const { isDemoMode, restaurant, posProvider, connectDemoPOS, refreshPosStatus } = useMiseSession();
  const [loading, setLoading] = useState(Boolean(restaurant));
  const [loadError, setLoadError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<PosProvider | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [notice, setNotice] = useState<PosHubNotice | null>(null);
  const [unmappedAfterImport, setUnmappedAfterImport] = useState(0);
  const [incompatibleAfterImport, setIncompatibleAfterImport] = useState(0);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  const csvPreview = useMemo(() => previewManualPosSalesCsv(csvText), [csvText]);

  function mutationNotice(
    reason: PosMutationNoticeReason,
    restaurantId: string | null = restaurant?.id ?? null,
    params?: Record<string, string>
  ): PosHubNotice {
    const localized = (
      Object.keys(MUTATION_NOTICE_KEYS) as PosMutationNoticeReason[]
    ).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(MUTATION_NOTICE_KEYS[key].title),
          message: t(MUTATION_NOTICE_KEYS[key].message, params)
        };
        return acc;
      },
      {} as Record<PosMutationNoticeReason, { title: string; message: string }>
    );
    return {
      ...presentPosMutationNoticeCopy(reason, localized),
      restaurantId
    };
  }

  useEffect(() => {
    requestIdRef.current += 1;
    loadedRestaurantRef.current = null;
    setLoadedRestaurantId(null);
    setLoadError(false);
    setLoading(Boolean(restaurant));
    setLoadingProvider(null);
    setImportingCsv(false);
    setCsvText("");
    setNotice(null);
    setUnmappedAfterImport(0);
    setIncompatibleAfterImport(0);
  }, [restaurant?.id]);

  const load = useCallback(
    async (showLoading = false) => {
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
        await refreshPosStatus();
        if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
        loadedRestaurantRef.current = restaurantId;
        setLoadedRestaurantId(restaurantId);
      } catch (error) {
        if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
        captureMiseError(error, {
          flow: "settings_pos",
          operation: "load",
          restaurant_id: restaurantId
        });
        setLoadError(true);
      } finally {
        if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
          setLoading(false);
        }
      }
    },
    [refreshPosStatus, restaurant]
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  const hubLoadState = resolvePosHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const mutationBusy = presentPosMutationBusy(loadingProvider, importingCsv);
  const mutationEditable = presentPosMutationActionsEditable(hubReady, mutationBusy);
  const visiblePosProvider = hubReady ? posProvider : null;
  const posProviderLabel =
    visiblePosProvider === "Manual CSV Upload"
      ? t("pos.provider.manualCsv")
      : visiblePosProvider;
  const csvConnected = visiblePosProvider === "Manual CSV Upload";
  const visibleNotice =
    notice && notice.restaurantId === (restaurant?.id ?? null) ? notice : null;
  const hero = presentPosHubHeroCopy(
    hubLoadState,
    {
      providerLabel: posProviderLabel,
      isDemoMode,
      csvConnected
    },
    {
      loadingTitle: t("pos.empty.loadingTitle"),
      loadingBody: t("pos.empty.loadingBody"),
      unavailableTitle: t("pos.empty.unavailableTitle"),
      unavailableBody: t("pos.empty.unavailableBody"),
      connectedTitle: (provider) => t("pos.hero.connected", { provider }),
      connectSourceTitle: t("pos.hero.connectSource"),
      csvReadyTitle: t("pos.hero.csvReady"),
      connectedDemoBody: (provider) => t("pos.status.demoConnected", { provider }),
      connectedCsvBody: t("pos.status.csvConnected"),
      demoModeBody: t("pos.status.demoMode"),
      liveCsvBody: t("pos.status.liveCsv")
    }
  );

  async function connect(provider: PosProvider) {
    if (provider === "Manual CSV Upload") {
      return;
    }
    if (!isDemoMode) {
      setNotice(mutationNotice("liveProviderRestricted"));
      return;
    }
    if (!mutationEditable) return;
    setLoadingProvider(provider);
    setNotice(null);
    try {
      await connectDemoPOS(provider);
      if (restaurant?.id) {
        loadedRestaurantRef.current = restaurant.id;
        setLoadedRestaurantId(restaurant.id);
      }
      setNotice(mutationNotice("demoLoaded", restaurant?.id ?? null, { provider }));
    } catch (error) {
      captureMiseError(error, {
        flow: "settings_pos",
        operation: "connect",
        restaurant_id: restaurant?.id ?? null,
        provider
      });
      setNotice(mutationNotice("demoLoadFailed"));
    } finally {
      setLoadingProvider(null);
    }
  }

  async function importCsv() {
    if (!restaurant?.id) {
      setNotice(mutationNotice("csvImportFailed"));
      return;
    }
    if (csvPreview.status !== "ready" || csvPreview.acceptedRowCount === 0) {
      setNotice(mutationNotice("csvValidationFailed", restaurant.id));
      return;
    }
    if (!mutationEditable) return;
    setImportingCsv(true);
    setNotice(null);
    setUnmappedAfterImport(0);
    setIncompatibleAfterImport(0);
    try {
      const result = await importManualPosSalesCsv(restaurant.id, csvText, "settings_manual_csv.txt");
      await refreshPosStatus();
      if (activeRestaurantIdRef.current !== restaurant.id) return;
      loadedRestaurantRef.current = restaurant.id;
      setLoadedRestaurantId(restaurant.id);
      const unmappedCount = Math.max(0, Math.trunc(result.unmappedSaleCount ?? 0));
      const incompatibleCount = Math.max(0, Math.trunc(result.skippedIncompatibleCount ?? 0));
      setUnmappedAfterImport(unmappedCount);
      setIncompatibleAfterImport(incompatibleCount);
      const reason = resolvePosCsvImportNoticeReason({ unmappedCount, incompatibleCount });
      setNotice(
        mutationNotice(reason, restaurant.id, {
          count: formatNumber(result.posSalesRowsSaved),
          unmapped: formatNumber(unmappedCount),
          incompatible: formatNumber(incompatibleCount)
        })
      );
    } catch (error) {
      if (activeRestaurantIdRef.current === restaurant.id) {
        captureMiseError(error, {
          flow: "settings_pos",
          operation: "import",
          restaurant_id: restaurant.id
        });
        setNotice(mutationNotice("csvImportFailed", restaurant.id));
        setUnmappedAfterImport(0);
        setIncompatibleAfterImport(0);
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurant.id) {
        setImportingCsv(false);
      }
    }
  }

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  return (
    <Screen
      title={t("pos.title")}
      subtitle={isDemoMode ? t("pos.subtitle.demo") : t("pos.subtitle.liveCsv")}
      loading={loading}
      action={
        <ActionIcon accessibilityLabel={t("pos.backToSettings")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        {loadError ? (
          <RetryNotice
            title={t("pos.retry.title")}
            message={t("pos.error.load")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("pos.retry.accessibility")}
            onRetry={() => void load(true)}
          />
        ) : null}

        <OperationalHero
          eyebrow={t("pos.hero.eyebrow")}
          title={hero.title}
          body={hero.body}
          meta={
            hero.metaReady
              ? isDemoMode
                ? posProviderLabel ?? t("common.demo")
                : t("pos.value.beta")
              : hubLoadState === "error"
                ? t("common.retry")
                : t("common.loading")
          }
          tone={hero.tone === "leaf" ? "leaf" : hero.tone === "caution" ? "caution" : "neutral"}
          icon={
            <PlugZap
              size={21}
              color={
                hero.tone === "leaf"
                  ? colors.success
                  : hero.tone === "caution"
                    ? colors.caution
                    : colors.muted
              }
              strokeWidth={2.6}
            />
          }
          stats={[
            {
              label: t("pos.stat.provider"),
              value: !hero.metaReady
                ? hubLoadState === "error"
                  ? t("common.retry")
                  : t("common.loading")
                : visiblePosProvider
                  ? t("common.on")
                  : t("common.none"),
              tone: !hero.metaReady ? "neutral" : visiblePosProvider ? "leaf" : "caution"
            },
            { label: t("pos.stat.mode"), value: isDemoMode ? t("common.demo") : t("common.live"), tone: "neutral" },
            {
              label: t("pos.stat.import"),
              value: !hero.metaReady
                ? hubLoadState === "error"
                  ? t("common.retry")
                  : t("common.loading")
                : csvConnected
                  ? t("common.on")
                  : t("common.ready"),
              tone: !hero.metaReady ? "neutral" : csvConnected ? "leaf" : "neutral"
            }
          ]}
        />

        <View style={styles.demoSafety}>
          <Text style={styles.demoSafetyTitle}>
            {isDemoMode ? t("pos.safety.demoTitle") : t("pos.safety.csvTitle")}
          </Text>
          <Text style={styles.demoSafetyCopy}>
            {isDemoMode ? t("pos.safety.demoBody") : t("pos.safety.csvBody")}
          </Text>
        </View>

        {visibleNotice ? (
          <StatusNotice
            title={visibleNotice.title}
            message={visibleNotice.message}
            tone={visibleNotice.tone}
          />
        ) : null}

        {hubReady && (unmappedAfterImport > 0 || incompatibleAfterImport > 0) ? (
          <Pressable
            onPress={() => router.push("/settings/recipes" as never)}
            accessibilityRole="button"
            accessibilityLabel={t(
              unmappedAfterImport > 0 && incompatibleAfterImport > 0
                ? "pos.action.repairRecipesAccessibility"
                : incompatibleAfterImport > 0
                  ? "pos.action.fixIncompatibleAccessibility"
                  : "pos.action.mapUnmappedAccessibility"
            )}
            style={({ pressed }) => [styles.repairButton, pressed && styles.pressed]}
          >
            <Text style={styles.repairButtonText}>
              {t(
                unmappedAfterImport > 0 && incompatibleAfterImport > 0
                  ? "pos.action.repairRecipes"
                  : incompatibleAfterImport > 0
                    ? "pos.action.fixIncompatible"
                    : "pos.action.mapUnmapped"
              )}
            </Text>
          </Pressable>
        ) : null}

        <SectionHeader
          title={t("pos.csv.title")}
          eyebrow={t("pos.csv.eyebrow")}
          action={
            csvPreview.acceptedRowCount > 0
              ? t("pos.csv.readyCount", { count: formatNumber(csvPreview.acceptedRowCount) })
              : t("common.none")
          }
        />
        <Card>
          <Text style={styles.csvCopy}>{t("pos.csv.body")}</Text>
          <TextInput
            accessibilityLabel={t("pos.csv.accessibility")}
            accessibilityHint={t("pos.csv.hint")}
            value={csvText}
            onChangeText={setCsvText}
            style={styles.textArea}
            multiline
            textAlignVertical="top"
            placeholder={DEMO_SETUP_POS_SALES_PLACEHOLDER}
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            editable={mutationEditable}
          />
          {csvPreview.issues.slice(0, 3).map((issue) => (
            <Text key={`${issue.row}_${issue.field}`} style={styles.issue}>
              {t("pos.csv.issue", { row: formatNumber(issue.row), field: issue.field })}
            </Text>
          ))}
          <Pressable
            onPress={() => void importCsv()}
            disabled={!mutationEditable || csvPreview.status !== "ready"}
            accessibilityRole="button"
            accessibilityLabel={t("pos.csv.importAction")}
            accessibilityState={{
              disabled: !mutationEditable || csvPreview.status !== "ready",
              busy: importingCsv
            }}
            style={({ pressed }) => [
              styles.importButton,
              (!mutationEditable || csvPreview.status !== "ready") && styles.importButtonDisabled,
              pressed && csvPreview.status === "ready" && mutationEditable && styles.pressed
            ]}
          >
            <Text style={styles.importButtonText}>
              {importingCsv ? t("common.loading") : t("pos.csv.importAction")}
            </Text>
          </Pressable>
        </Card>

        {isDemoMode ? (
          <>
            <SectionHeader
              title={t("pos.providers.title")}
              eyebrow={t("pos.providers.eyebrow")}
              action={
                !hubReady
                  ? hubLoadState === "error"
                    ? t("pos.section.action.unavailable")
                    : t("pos.section.action.loading")
                  : posProviderLabel ?? t("common.none")
              }
            />
            <View style={styles.providerList}>
              {providers
                .filter((provider) => provider !== "Manual CSV Upload")
                .map((provider) => {
                  const selected = hubReady && provider === visiblePosProvider;
                  return (
                    <ProviderOption
                      key={provider}
                      provider={provider}
                      selected={selected}
                      loading={loadingProvider === provider}
                      disabled={!mutationEditable}
                      onPress={() => void connect(provider)}
                    />
                  );
                })}
            </View>
          </>
        ) : (
          <Card>
            <Text style={styles.restrictedTitle}>{t("pos.restricted.liveTitle")}</Text>
            <Text style={styles.restrictedCopy}>{t("pos.restricted.liveBody")}</Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

function ProviderOption({
  provider,
  selected,
  loading,
  disabled,
  onPress
}: {
  provider: PosProvider;
  selected: boolean;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useLocale();
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t("pos.provider.accessibilityDemoFeed", { provider })}
      accessibilityHint={selected ? t("pos.provider.hintReload") : t("pos.provider.hintLoad")}
      accessibilityState={{ selected, disabled, busy: loading }}
      style={({ pressed }) => pressed && !disabled && styles.pressed}
    >
      <Animated.View style={[styles.providerRow, selected && styles.providerRowSelected, scaleStyle]}>
        <View style={[styles.providerRail, selected && styles.providerRailSelected]} />
        <View style={[styles.providerIcon, selected && styles.providerIconSelected]}>
          <CheckCircle size={20} color={selected ? colors.surface : colors.text} strokeWidth={2.5} />
        </View>
        <View style={styles.providerText}>
          <Text style={[styles.providerName, selected && styles.providerNameSelected]}>{provider}</Text>
          <Text style={[styles.providerCopy, selected && styles.providerCopySelected]}>
            {selected ? t("pos.provider.copyConnectedDemo") : t("pos.provider.copyDemo")}
          </Text>
        </View>
        <View style={styles.providerTrail}>
          <Text style={[styles.providerStatus, selected && styles.providerStatusSelected]}>
            {selected ? t("common.connected") : t("common.demo")}
          </Text>
          <Text style={styles.providerAction}>
            {loading ? t("common.loading") : selected ? t("common.reload") : t("common.connect")}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  providerList: {
    gap: 8
  },
  demoSafety: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  demoSafetyTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900"
  },
  demoSafetyCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 2
  },
  providerRow: {
    position: "relative",
    overflow: "hidden",
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  providerRowSelected: {
    backgroundColor: colors.text
  },
  providerRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: colors.border
  },
  providerRailSelected: {
    backgroundColor: colors.accent
  },
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center"
  },
  providerIconSelected: {
    backgroundColor: colors.accent
  },
  providerText: {
    flex: 1,
    minWidth: 0
  },
  providerName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  providerCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3
  },
  providerNameSelected: {
    color: colors.surface
  },
  providerCopySelected: {
    color: colors.borderStrong
  },
  providerTrail: {
    alignItems: "flex-end",
    gap: 4
  },
  providerStatus: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  providerStatusSelected: {
    color: colors.surface
  },
  providerAction: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.76
  },
  restrictedTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900"
  },
  restrictedCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8
  },
  csvCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 10
  },
  textArea: {
    minHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "600"
  },
  issue: {
    color: colors.caution,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 8
  },
  importButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  importButtonDisabled: {
    opacity: 0.45
  },
  importButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900"
  },
  repairButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.caution,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  repairButtonText: {
    color: colors.accentDark,
    fontSize: 14,
    fontWeight: "900"
  }
});

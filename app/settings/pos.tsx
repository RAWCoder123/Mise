import { useMemo, useState } from "react";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle, PlugZap } from "lucide-react-native";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Card } from "../../components/ui/Card";
import { usePressScale } from "../../components/ui/Motion";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { colors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { DEMO_SETUP_POS_SALES_PLACEHOLDER } from "../../services/demo/demoSetupData";
import { importManualPosSalesCsv, previewManualPosSalesCsv } from "../../services/miseService";
import type { PosProvider } from "../../types/mise";

const providers: PosProvider[] = ["Toast", "Square", "Clover", "Lightspeed", "Manual CSV Upload"];
type PosMessage =
  | { key: "pos.message.csvImported"; values: { count: string } }
  | { key: "pos.message.demoLoaded"; values: { provider: string } }
  | { key: "pos.error.demoLoad" }
  | { key: "pos.error.csvImport" }
  | { key: "pos.error.csvValidation" };

export default function POSConnectionScreen() {
  const navigation = useNavigation();
  const { formatNumber, t } = useLocale();
  const { isDemoMode, restaurant, posProvider, connectDemoPOS, refreshPosStatus } = useMiseSession();
  const [loadingProvider, setLoadingProvider] = useState<PosProvider | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [message, setMessage] = useState<PosMessage | null>(null);
  const csvPreview = useMemo(() => previewManualPosSalesCsv(csvText), [csvText]);
  const posProviderLabel =
    posProvider === "Manual CSV Upload" ? t("pos.provider.manualCsv") : posProvider;
  const csvConnected = posProvider === "Manual CSV Upload";

  async function connect(provider: PosProvider) {
    if (provider === "Manual CSV Upload") {
      return;
    }
    if (!isDemoMode) {
      setMessage({ key: "pos.error.demoLoad" });
      return;
    }
    setLoadingProvider(provider);
    setMessage(null);
    try {
      await connectDemoPOS(provider);
      setMessage({ key: "pos.message.demoLoaded", values: { provider } });
    } catch {
      setMessage({ key: "pos.error.demoLoad" });
    } finally {
      setLoadingProvider(null);
    }
  }

  async function importCsv() {
    if (!restaurant?.id) {
      setMessage({ key: "pos.error.csvImport" });
      return;
    }
    if (csvPreview.status !== "ready" || csvPreview.acceptedRowCount === 0) {
      setMessage({ key: "pos.error.csvValidation" });
      return;
    }
    setImportingCsv(true);
    setMessage(null);
    try {
      const result = await importManualPosSalesCsv(restaurant.id, csvText, "settings_manual_csv.txt");
      await refreshPosStatus();
      setMessage({
        key: "pos.message.csvImported",
        values: { count: formatNumber(result.posSalesRowsSaved) }
      });
    } catch {
      setMessage({ key: "pos.error.csvImport" });
    } finally {
      setImportingCsv(false);
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
      action={
        <ActionIcon accessibilityLabel={t("pos.backToSettings")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <OperationalHero
          eyebrow={t("pos.hero.eyebrow")}
          title={
            posProviderLabel
              ? t("pos.hero.connected", { provider: posProviderLabel })
              : isDemoMode
                ? t("pos.hero.connectSource")
                : t("pos.hero.csvReady")
          }
          body={
            posProviderLabel
              ? csvConnected
                ? t("pos.status.csvConnected")
                : t("pos.status.demoConnected", { provider: posProviderLabel })
              : isDemoMode
                ? t("pos.status.demoMode")
                : t("pos.status.liveCsv")
          }
          meta={isDemoMode ? posProviderLabel ?? t("common.demo") : t("pos.value.beta")}
          tone={posProvider ? "leaf" : "caution"}
          icon={
            <PlugZap
              size={21}
              color={posProvider ? colors.success : colors.caution}
              strokeWidth={2.6}
            />
          }
          stats={[
            {
              label: t("pos.stat.provider"),
              value: posProvider ? t("common.on") : t("common.none"),
              tone: posProvider ? "leaf" : "caution"
            },
            { label: t("pos.stat.mode"), value: isDemoMode ? t("common.demo") : t("common.live"), tone: "neutral" },
            {
              label: t("pos.stat.import"),
              value: csvConnected ? t("common.on") : t("common.ready"),
              tone: csvConnected ? "leaf" : "neutral"
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

        {message && (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {t(message.key, "values" in message ? message.values : undefined)}
          </Text>
        )}

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
          />
          {csvPreview.issues.slice(0, 3).map((issue) => (
            <Text key={`${issue.row}_${issue.field}`} style={styles.issue}>
              {t("pos.csv.issue", { row: formatNumber(issue.row), field: issue.field })}
            </Text>
          ))}
          <Pressable
            onPress={() => void importCsv()}
            disabled={importingCsv || csvPreview.status !== "ready"}
            accessibilityRole="button"
            accessibilityLabel={t("pos.csv.importAction")}
            accessibilityState={{ disabled: importingCsv || csvPreview.status !== "ready", busy: importingCsv }}
            style={({ pressed }) => [
              styles.importButton,
              (importingCsv || csvPreview.status !== "ready") && styles.importButtonDisabled,
              pressed && csvPreview.status === "ready" && !importingCsv && styles.pressed
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
              action={posProviderLabel ?? t("common.none")}
            />
            <View style={styles.providerList}>
              {providers
                .filter((provider) => provider !== "Manual CSV Upload")
                .map((provider) => {
                  const selected = provider === posProvider;
                  return (
                    <ProviderOption
                      key={provider}
                      provider={provider}
                      selected={selected}
                      loading={loadingProvider === provider}
                      disabled={loadingProvider !== null || importingCsv}
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
  message: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19
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
  }
});

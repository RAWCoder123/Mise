import { useState } from "react";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle, FileText, PlugZap } from "lucide-react-native";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Card } from "../../components/ui/Card";
import { usePressScale } from "../../components/ui/Motion";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { colors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { PosProvider } from "../../types/mise";

const providers: PosProvider[] = ["Toast", "Square", "Clover", "Lightspeed", "Manual CSV Upload"];
type PosMessage =
  | { key: "pos.message.csvUnavailable" }
  | { key: "pos.message.demoLoaded"; values: { provider: string } }
  | { key: "pos.error.demoLoad" };

export default function POSConnectionScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { isDemoMode, posProvider, connectDemoPOS } = useMiseSession();
  const [loadingProvider, setLoadingProvider] = useState<PosProvider | null>(null);
  const [message, setMessage] = useState<PosMessage | null>(null);
  const posProviderLabel = posProvider === "Manual CSV Upload" ? t("pos.provider.manualCsv") : posProvider;

  async function connect(provider: PosProvider) {
    if (provider === "Manual CSV Upload") {
      setMessage({ key: "pos.message.csvUnavailable" });
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

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  return (
    <Screen
      title={t("pos.title")}
      subtitle={isDemoMode ? t("pos.subtitle.demo") : t("pos.subtitle.restricted")}
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
            isDemoMode
              ? posProviderLabel
                ? t("pos.hero.connected", { provider: posProviderLabel })
                : t("pos.hero.connectSource")
              : t("pos.hero.restricted")
          }
          body={
            isDemoMode
              ? posProviderLabel
                ? t("pos.status.demoConnected", { provider: posProviderLabel })
                : t("pos.status.demoMode")
              : t("pos.hero.restrictedBody")
          }
          meta={isDemoMode ? posProviderLabel ?? t("common.demo") : t("pos.value.beta")}
          tone={posProvider ? "leaf" : isDemoMode ? "caution" : "neutral"}
          icon={
            <PlugZap
              size={21}
              color={posProvider ? colors.success : isDemoMode ? colors.caution : colors.muted}
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
            { label: t("pos.stat.import"), value: t("common.soon"), tone: "neutral" }
          ]}
        />

        <View style={styles.demoSafety}>
          <Text style={styles.demoSafetyTitle}>
            {isDemoMode ? t("pos.safety.demoTitle") : t("pos.safety.restrictedTitle")}
          </Text>
          <Text style={styles.demoSafetyCopy}>
            {isDemoMode ? t("pos.safety.demoBody") : t("pos.safety.restrictedBody")}
          </Text>
        </View>

        {message && (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {t(message.key, "values" in message ? message.values : undefined)}
          </Text>
        )}

        {isDemoMode ? (
          <>
            <SectionHeader
              title={t("pos.providers.title")}
              eyebrow={t("pos.providers.eyebrow")}
              action={posProviderLabel ?? t("common.none")}
            />
            <View style={styles.providerList}>
              {providers.map((provider) => {
                const isCsv = provider === "Manual CSV Upload";
                const selected = !isCsv && provider === posProvider;
                return (
                  <ProviderOption
                    key={provider}
                    provider={provider}
                    selected={selected}
                    isCsv={isCsv}
                    loading={loadingProvider === provider}
                    disabled={isCsv || loadingProvider !== null}
                    onPress={() => void connect(provider)}
                  />
                );
              })}
            </View>
          </>
        ) : (
          <Card>
            <Text style={styles.restrictedTitle}>{t("pos.restricted.title")}</Text>
            <Text style={styles.restrictedCopy}>
              {t("pos.restricted.body")}
            </Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

function ProviderOption({
  provider,
  selected,
  isCsv,
  loading,
  disabled,
  onPress
}: {
  provider: PosProvider;
  selected: boolean;
  isCsv: boolean;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useLocale();
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);
  const providerLabel = isCsv ? t("pos.provider.manualCsv") : provider;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        isCsv
          ? t("pos.provider.accessibilityCsv")
          : t("pos.provider.accessibilityDemoFeed", { provider: providerLabel })
      }
      accessibilityHint={
        isCsv
          ? t("pos.provider.hintUnavailable")
          : selected
            ? t("pos.provider.hintReload")
            : t("pos.provider.hintLoad")
      }
      accessibilityState={{ selected, disabled, busy: loading }}
      style={({ pressed }) => pressed && !disabled && styles.pressed}
    >
      <Animated.View style={[styles.providerRow, selected && styles.providerRowSelected, scaleStyle]}>
        <View style={[styles.providerRail, selected && styles.providerRailSelected]} />
        <View style={[styles.providerIcon, selected && styles.providerIconSelected]}>
          {isCsv ? (
            <FileText size={20} color={selected ? colors.surface : colors.text} strokeWidth={2.5} />
          ) : (
            <CheckCircle size={20} color={selected ? colors.surface : colors.text} strokeWidth={2.5} />
          )}
        </View>
        <View style={styles.providerText}>
          <Text style={[styles.providerName, selected && styles.providerNameSelected]}>{providerLabel}</Text>
          <Text style={[styles.providerCopy, selected && styles.providerCopySelected]}>
            {isCsv
              ? t("pos.provider.copyCsv")
              : selected
                ? t("pos.provider.copyConnectedDemo")
                : t("pos.provider.copyDemo")}
          </Text>
        </View>
        <View style={styles.providerTrail}>
          <Text style={[styles.providerStatus, selected && styles.providerStatusSelected]}>
            {selected ? t("common.connected") : isCsv ? t("common.soon") : t("common.demo")}
          </Text>
          <Text style={styles.providerAction}>
            {loading
              ? t("common.loading")
              : selected
                ? t("common.reload")
                : isCsv
                  ? t("common.comingSoon")
                  : t("common.connect")}
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
  }
});

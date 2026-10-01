import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  EyeOff,
  MoonStar,
  Sparkles,
  Sunrise,
  Utensils
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DailyCloseoutCelebration } from "../../components/operations/DailyCloseoutCelebration";
import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import {
  SegmentedControl,
  type SegmentOption
} from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, density, fontFamilies, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  fetchDailyPhaseBriefs,
  type DailyPhaseBriefs
} from "../../services/miseService";
import type {
  DailyBriefPhase,
  DailyPhaseFinding,
  DailyPhaseFindingTone
} from "../../services/domain/dailyPhaseBrief";
import {
  presentDailyPhaseFinding,
  presentUnavailableSignals
} from "../../services/presentation/dailyPhaseBriefPresentation";
import { captureMiseError } from "../../services/telemetry";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function DailyPhaseBriefScreen() {
  const { formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [briefs, setBriefs] = useState<DailyPhaseBriefs | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<DailyBriefPhase | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setBriefs(null);
    setSelectedPhase(null);
    setLoadedRestaurantId(null);
    setError(false);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchDailyPhaseBriefs(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setBriefs(next);
      setSelectedPhase((current) => current ?? next.activePhase);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "daily_phase_brief",
        operation: "load",
        restaurant_id: restaurantId
      });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visible = loadedRestaurantId === restaurant?.id ? briefs : null;
  const phase = selectedPhase ?? visible?.activePhase ?? "morning";
  const phaseBrief = visible?.briefs[phase] ?? null;
  const options = useMemo<readonly SegmentOption<DailyBriefPhase>[]>(
    () => [
      { value: "morning", label: t("dailyPhaseBrief.phase.morning") },
      { value: "pre_service", label: t("dailyPhaseBrief.phase.preService") },
      { value: "closing", label: t("dailyPhaseBrief.phase.closing") }
    ],
    [t]
  );
  const unavailableSignalsLabel = useMemo(
    () =>
      phaseBrief
        ? presentUnavailableSignals(phaseBrief.unavailableSignals, t)
        : "",
    [phaseBrief, t]
  );

  if (!restaurant) {
    return (
      <Screen title={t("dailyPhaseBrief.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState
          title={t("tasks.noRestaurant.title")}
          body={t("dailyPhaseBrief.noRestaurant.body")}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("dailyPhaseBrief.title")}
      subtitle={
        visible
          ? t("dailyPhaseBrief.subtitleDated", { date: visible.operatingDate })
          : t("dailyPhaseBrief.subtitle")
      }
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("dailyPhaseBrief.retry.title")}
            message={t("dailyPhaseBrief.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("dailyPhaseBrief.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        <SegmentedControl
          accessibilityLabel={t("dailyPhaseBrief.phase.accessibility")}
          options={options}
          value={phase}
          onValueChange={setSelectedPhase}
          variant="pills"
        />

        {visible && phaseBrief ? (
          <>
            <Card style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.phaseIcon}>{phaseIcon(phase)}</View>
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>{t(phaseEyebrowKey(phase))}</Text>
                  <Text style={styles.heroTitle}>{t(phaseTitleKey(phase))}</Text>
                </View>
                <Badge
                  label={
                    phase === visible.activePhase
                      ? t("dailyPhaseBrief.current")
                      : t(statusKey(phaseBrief.status))
                  }
                  tone={statusTone(phaseBrief.status)}
                />
              </View>
              <Text style={styles.heroBody}>{t(phaseBodyKey(phase))}</Text>
              <Text style={styles.priorityCount}>
                {t("dailyPhaseBrief.priorityCount", {
                  count: formatNumber(phaseBrief.findings.length)
                })}
              </Text>
            </Card>

            {phase === "closing" ? (
              <DailyCloseoutCelebration
                restaurantId={restaurant.id}
                summary={visible.closeout}
                onOpenReport={() => router.push("/more/daily-report")}
              />
            ) : null}

            <SectionHeader title={t("dailyPhaseBrief.section.priorities")} />
            <View style={styles.findingList}>
              {phaseBrief.findings.map((finding, index) => (
                <FindingRow
                  key={finding.id}
                  finding={finding}
                  index={index + 1}
                  onPress={
                    finding.route
                      ? () => router.push(finding.route as never)
                      : undefined
                  }
                />
              ))}
            </View>

            <View style={styles.boundary}>
              <EyeOff size={icon.row} color={colors.muted} strokeWidth={iconStroke} />
              <View style={styles.boundaryCopy}>
                <Text style={styles.boundaryTitle}>{t("dailyPhaseBrief.boundary.title")}</Text>
                <Text style={styles.boundaryBody}>
                  {t("dailyPhaseBrief.boundary.body", {
                    signals: unavailableSignalsLabel
                  })}
                </Text>
              </View>
            </View>

            {phase === "closing" ? (
              <Button
                title={t("dailyPhaseBrief.action.report")}
                variant="secondary"
                onPress={() => router.push("/more/daily-report")}
                fullWidth
              />
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function FindingRow({
  finding,
  index,
  onPress
}: {
  finding: DailyPhaseFinding;
  index: number;
  onPress?: () => void;
}) {
  const { locale, t } = useLocale();
  const presented = presentDailyPhaseFinding(finding, t, locale);
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${presented.title}. ${presented.interpretation}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.findingRow, pressed && styles.pressed]}
    >
      <View style={[styles.findingIndex, indexToneStyle(finding.tone)]}>
        {finding.tone === "positive" ? (
          <CheckCircle2 size={icon.inline} color={colors.success} strokeWidth={iconStroke} />
        ) : finding.tone === "urgent" ? (
          <Sparkles size={icon.inline} color={colors.danger} strokeWidth={iconStroke} />
        ) : (
          <Text style={styles.findingIndexText}>{index}</Text>
        )}
      </View>
      <View style={styles.findingCopy}>
        <Text style={styles.findingTitle}>{presented.title}</Text>
        <Text style={styles.findingBody}>{presented.interpretation}</Text>
      </View>
      {onPress ? (
        <ChevronRight size={density.chevron} color={colors.faint} strokeWidth={iconStroke} />
      ) : null}
    </Pressable>
  );
}

function phaseIcon(phase: DailyBriefPhase) {
  if (phase === "morning") return <Sunrise size={icon.emphasis} color={colors.accent} strokeWidth={iconStroke} />;
  if (phase === "pre_service") return <Utensils size={icon.emphasis} color={colors.accent} strokeWidth={iconStroke} />;
  return <MoonStar size={icon.emphasis} color={colors.success} strokeWidth={iconStroke} />;
}

function phaseEyebrowKey(phase: DailyBriefPhase) {
  return `dailyPhaseBrief.eyebrow.${phase}` as const;
}

function phaseTitleKey(phase: DailyBriefPhase) {
  return `dailyPhaseBrief.hero.${phase}.title` as const;
}

function phaseBodyKey(phase: DailyBriefPhase) {
  return `dailyPhaseBrief.hero.${phase}.body` as const;
}

function statusKey(status: DailyPhaseBriefs["briefs"][DailyBriefPhase]["status"]) {
  return `dailyPhaseBrief.status.${status}` as const;
}

function statusTone(status: DailyPhaseBriefs["briefs"][DailyBriefPhase]["status"]): BadgeTone {
  return status === "celebrate" ? "success" : status === "attention" ? "danger" : "neutral";
}

function indexToneStyle(tone: DailyPhaseFindingTone) {
  if (tone === "positive") return styles.findingPositive;
  if (tone === "urgent") return styles.findingUrgent;
  if (tone === "attention") return styles.findingAttention;
  return styles.findingNeutral;
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  hero: { gap: 9 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  phaseIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft
  },
  heroCopy: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: {
    color: colors.accent,
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  heroTitle: { color: colors.text, ...conceptTypography.sectionTitle },
  heroBody: { color: colors.muted, ...conceptTypography.body },
  priorityCount: { color: colors.text, ...conceptTypography.caption, fontFamily: fontFamilies.semibold },
  findingList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  findingRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  findingIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  findingNeutral: { backgroundColor: colors.panel },
  findingAttention: { backgroundColor: colors.warningSoft },
  findingUrgent: { backgroundColor: colors.dangerSoft },
  findingPositive: { backgroundColor: colors.successSoft },
  findingIndexText: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: 12, lineHeight: 15 },
  findingCopy: { flex: 1, minWidth: 0, gap: 3 },
  findingTitle: { color: colors.text, ...conceptTypography.rowTitle },
  findingBody: { color: colors.muted, ...conceptTypography.body },
  boundary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 11,
    borderRadius: radii.md,
    backgroundColor: colors.panel
  },
  boundaryCopy: { flex: 1, minWidth: 0, gap: 2 },
  boundaryTitle: { color: colors.text, ...conceptTypography.rowTitle },
  boundaryBody: { color: colors.muted, ...conceptTypography.caption },
  pressed: { opacity: 0.72 }
});

import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CheckCircle2, Sparkles } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { colors, conceptTypography, fontFamilies, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import type { MessageKey } from "../../i18n/catalog";
import type { DailyCloseoutSummary } from "../../services/domain/dailyCloseout";
import { Button } from "../ui/Button";
import { MotionView, StateChangeView } from "../ui/Motion";

interface DailyCloseoutCelebrationProps {
  restaurantId: string;
  summary: DailyCloseoutSummary;
  onOpenReport?: () => void;
}

export function DailyCloseoutCelebration({
  restaurantId,
  summary,
  onOpenReport
}: DailyCloseoutCelebrationProps) {
  const { formatNumber, t } = useLocale();
  const [acknowledged, setAcknowledged] = useState(false);
  const storageKey = useMemo(
    () => `mise.daily-closeout.ack.v1:${restaurantId}:${summary.operatingDate}`,
    [restaurantId, summary.operatingDate]
  );

  useEffect(() => {
    let active = true;
    setAcknowledged(false);
    void AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (active) setAcknowledged(value === "acknowledged");
      })
      .catch(() => {
        // Acknowledgement is optional presentation state; fail open for the session.
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  if (!summary.shouldShow) return null;

  const titleKey: MessageKey = acknowledged
    ? "dailyCloseout.title.acknowledged"
    : summary.phase === "complete"
      ? "dailyCloseout.title.complete"
      : summary.phase === "closing"
        ? "dailyCloseout.title.closing"
        : "dailyCloseout.title.progress";
  const bodyKey = bodyMessageKey(summary);
  const progressLabel = t("dailyCloseout.progress", {
    completed: formatNumber(summary.completedTasks),
    total: formatNumber(summary.totalTasks)
  });
  const progressPercent = `${Math.round(summary.completionRate * 100)}%` as const;

  async function acknowledge() {
    setAcknowledged(true);
    try {
      await AsyncStorage.setItem(storageKey, "acknowledged");
    } catch {
      // Keep the immediate positive interaction even if local persistence is unavailable.
    }
  }

  return (
    <MotionView
      accessibilityLabel={t("dailyCloseout.accessibility", {
        title: t(titleKey),
        progress: progressLabel
      })}
      accessibilityLiveRegion="polite"
      delay={80}
      distance={6}
      style={styles.card}
    >
      <StateChangeView stateKey={acknowledged ? "acknowledged" : summary.phase} style={styles.content}>
        <View style={[styles.icon, acknowledged && styles.iconAcknowledged]}>
          {acknowledged ? (
            <CheckCircle2 size={20} color={colors.success} strokeWidth={2.3} />
          ) : (
            <Sparkles size={20} color={colors.accent} strokeWidth={2.2} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t(titleKey)}</Text>
          <Text style={styles.body}>
            {t(bodyKey, {
              completed: formatNumber(summary.completedTasks),
              remaining: formatNumber(summary.remainingTasks)
            })}
          </Text>
        </View>
      </StateChangeView>

      {summary.totalTasks > 0 ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressPercent }]} />
          </View>
          <Text style={styles.progressLabel}>{progressLabel}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {onOpenReport ? (
          <Button
            title={t("dailyCloseout.action.report")}
            variant="secondary"
            size="compact"
            onPress={onOpenReport}
            style={styles.action}
          />
        ) : null}
        {acknowledged ? (
          <View style={styles.savedState}>
            <CheckCircle2 size={14} color={colors.success} strokeWidth={2.3} />
            <Text style={styles.savedText}>{t("dailyCloseout.action.acknowledged")}</Text>
          </View>
        ) : (
          <Button
            title={t("dailyCloseout.action.acknowledge")}
            size="compact"
            onPress={() => void acknowledge()}
            style={styles.action}
          />
        )}
      </View>
    </MotionView>
  );
}

function bodyMessageKey(summary: DailyCloseoutSummary): MessageKey {
  if (summary.totalTasks === 0) return "dailyCloseout.body.clear";
  if (summary.phase === "complete") {
    return summary.completedTasks === 1
      ? "dailyCloseout.body.complete.one"
      : "dailyCloseout.body.complete.other";
  }
  if (summary.phase === "closing") return "dailyCloseout.body.closing";
  return "dailyCloseout.body.progress";
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 9
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  iconAcknowledged: {
    backgroundColor: colors.surface
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    lineHeight: 18
  },
  body: {
    color: colors.muted,
    ...conceptTypography.body
  },
  progressBlock: {
    gap: 4
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.success
  },
  progressLabel: {
    color: colors.success,
    ...conceptTypography.caption
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8
  },
  action: {
    minWidth: 96
  },
  savedState: {
    minHeight: 32,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  savedText: {
    color: colors.success,
    ...conceptTypography.button
  }
});

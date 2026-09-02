import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, ClipboardCheck, Sunrise } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  fetchOperatingRoutineDefinitions,
  materializeOperatingRoutine,
  type OperatingRoutineId
} from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

function todayOperatingDate(timeZone: string | null | undefined): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // fall through
  }
  return new Date().toISOString().slice(0, 10);
}

const routineTitleKeys: Record<OperatingRoutineId, MessageKey> = {
  opening: "routines.opening.title",
  closing: "routines.closing.title",
  food_safety: "routines.foodSafety.title"
};

const routineSummaryKeys: Record<OperatingRoutineId, MessageKey> = {
  opening: "routines.opening.summary",
  closing: "routines.closing.summary",
  food_safety: "routines.foodSafety.summary"
};

export default function OperatingRoutinesScreen() {
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const routines = useMemo(() => fetchOperatingRoutineDefinitions(), []);
  const [busyRoutineId, setBusyRoutineId] = useState<OperatingRoutineId | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger" | "neutral"; title: string; message: string } | null>(
    null
  );
  const actionLocksRef = useRef(new Set<string>());

  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const operatingDate = todayOperatingDate(restaurant?.timezone);

  useFocusEffect(
    useCallback(() => {
      setNotice(null);
      setBusyRoutineId(null);
    }, [restaurant?.id])
  );

  const onMaterialize = async (routineId: OperatingRoutineId) => {
    if (!restaurant || !canManage) return;
    if (actionLocksRef.current.has(routineId) || busyRoutineId) return;
    actionLocksRef.current.add(routineId);
    setBusyRoutineId(routineId);
    setNotice(null);
    try {
      const result = await materializeOperatingRoutine({
        restaurantId: restaurant.id,
        routineId,
        operatingDate,
        memberships
      });
      const createdCount = result.created.length;
      const skippedCount = result.skippedExisting;
      if (createdCount === 0 && skippedCount > 0) {
        setNotice({
          tone: "neutral",
          title: t("routines.notice.already.title"),
          message: t("routines.notice.already.body", {
            count: formatNumber(skippedCount),
            date: operatingDate
          })
        });
      } else {
        setNotice({
          tone: "success",
          title: t("routines.notice.created.title"),
          message: t("routines.notice.created.body", {
            created: formatNumber(createdCount),
            skipped: formatNumber(skippedCount),
            date: operatingDate
          })
        });
      }
    } catch (error) {
      captureMiseError(error, {
        flow: "operating_routines",
        operation: "materialize",
        restaurant_id: restaurant.id,
        routine_id: routineId
      });
      setNotice({
        tone: "danger",
        title: t("routines.notice.error.title"),
        message: t("routines.notice.error.body")
      });
    } finally {
      actionLocksRef.current.delete(routineId);
      setBusyRoutineId(null);
    }
  };

  return (
    <Screen
      title={t("routines.title")}
      titleAlign="left"
      leadingAction={<BackAction />}
    >
      <View style={styles.stack}>
        <Text style={styles.subtitle}>
          {restaurant
            ? t("routines.subtitle", { restaurant: restaurant.name, date: operatingDate })
            : t("routines.subtitle.none")}
        </Text>

        {notice ? (
          <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
        ) : null}

        {!restaurant ? (
          <EmptyState
            illustration={<Sunrise size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
            title={t("routines.empty.workspace.title")}
            body={t("routines.empty.workspace.body")}
          />
        ) : !canManage ? (
          <EmptyState
            illustration={<ClipboardCheck size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
            title={t("routines.empty.permission.title")}
            body={t("routines.empty.permission.body")}
          />
        ) : (
          routines.map((routine) => (
            <SectionSurface key={routine.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <SectionHeader title={t(routineTitleKeys[routine.id])} />
                <Badge label={t("routines.stepsBadge", { count: formatNumber(routine.steps.length) })} tone="neutral" />
              </View>
              <Text style={styles.cardBody}>{t(routineSummaryKeys[routine.id])}</Text>
              <View style={styles.stepList}>
                {routine.steps.map((step) => (
                  <Text key={step.key} style={styles.stepLine}>
                    • {step.title}
                  </Text>
                ))}
              </View>
              <Button
                title={
                  busyRoutineId === routine.id
                    ? t("routines.action.adding")
                    : t("routines.action.addToday")
                }
                onPress={() => void onMaterialize(routine.id)}
                disabled={busyRoutineId !== null}
                accessibilityLabel={t("routines.action.addTodayAccessibility", {
                  routine: t(routineTitleKeys[routine.id])
                })}
              />
            </SectionSurface>
          ))
        )}

        {restaurant && canManage ? (
          <Button
            title={t("routines.action.openTasks")}
            variant="secondary"
            onPress={() => router.push("/more/create-task")}
            accessibilityLabel={t("routines.action.openTasksHint")}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  subtitle: {
    color: colors.muted,
    ...conceptTypography.body
  },
  card: {
    gap: 10,
    padding: 14,
    borderRadius: radii.md
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8
  },
  cardBody: {
    color: colors.muted,
    ...conceptTypography.body
  },
  stepList: {
    gap: 4
  },
  stepLine: {
    color: colors.text,
    ...typography.body
  }
});

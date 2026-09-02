import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { AlertTriangle, ArrowLeft, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  OPERATIONAL_ISSUE_STATUS_FILTERS,
  type OperationalIssue,
  type OperationalIssueSeverity,
  type OperationalIssueStatusFilter
} from "../../services/domain/operationalIssues";
import { fetchOperationalIssues } from "../../services/miseService";
import { captureMiseError } from "../../services/telemetry";

function severityTone(severity: OperationalIssueSeverity): BadgeTone {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  if (severity === "watch") return "caution";
  return "neutral";
}

function relatedRoute(issue: OperationalIssue): string | null {
  if (issue.relatedEntityType === "inventory_item" && issue.relatedEntityId) {
    return `/inventory/${issue.relatedEntityId}`;
  }
  if (issue.relatedEntityType === "purchase_recommendation") {
    return "/orders";
  }
  return null;
}

export default function OperationalIssuesScreen() {
  const { formatDate, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [filter, setFilter] = useState<OperationalIssueStatusFilter>("open");
  const [issues, setIssues] = useState<OperationalIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const filterOptions = useMemo<readonly SegmentOption<OperationalIssueStatusFilter>[]>(
    () =>
      OPERATIONAL_ISSUE_STATUS_FILTERS.map((value) => ({
        value,
        label: t(`issues.filter.${value}` as MessageKey),
        tone: value === "open" ? "brand" : "neutral"
      })),
    [t]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setIssues([]);
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
      const next = await fetchOperationalIssues(restaurantId, { status: filter, limit: 80 });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setIssues(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, {
        flow: "operational_issues",
        operation: "load",
        restaurant_id: restaurantId
      });
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [filter, restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visible = loadedRestaurantId === restaurant?.id ? issues : [];

  return (
    <Screen
      title={t("issues.title")}
      subtitle={
        restaurant ? t("issues.subtitle", { restaurant: restaurant.name }) : t("issues.subtitle.none")
      }
      loading={loading}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <SegmentedControl
          accessibilityLabel={t("issues.filter.accessibility")}
          options={filterOptions}
          value={filter}
          onChange={setFilter}
        />

        {error ? (
          <RetryNotice
            title={t("issues.error.title")}
            message={t("issues.error.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("issues.error.retry")}
            onRetry={() => void load()}
          />
        ) : null}

        {!error && visible.length === 0 ? (
          <EmptyState
            title={t("issues.empty.title")}
            body={t("issues.empty.body")}
            illustration={
              <AlertTriangle size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />
            }
          />
        ) : null}

        {visible.map((issue) => {
          const route = relatedRoute(issue);
          const content = (
            <>
              <View style={styles.badges}>
                <Badge
                  label={t(`issues.severity.${issue.severity}` as MessageKey)}
                  tone={severityTone(issue.severity)}
                  uppercase
                />
                <Badge
                  label={t(`issues.status.${issue.status}` as MessageKey)}
                  tone="neutral"
                  uppercase
                />
                <Badge
                  label={t(`issues.category.${issue.category}` as MessageKey)}
                  tone="neutral"
                />
              </View>
              <Text style={styles.title}>{issue.title}</Text>
              <Text style={styles.explanation}>{issue.explanation}</Text>
              <Text style={styles.meta}>
                {t("issues.detected", {
                  date: formatDate(issue.lastDetectedAt, { dateStyle: "medium", timeStyle: "short" })
                })}
              </Text>
              {route ? (
                <View style={styles.openRow}>
                  <Text style={styles.openLabel}>{t("issues.openRelated")}</Text>
                  <ChevronRight size={18} color={colors.faint} strokeWidth={iconStroke} />
                </View>
              ) : null}
            </>
          );

          if (!route) {
            return (
              <View key={issue.id} style={styles.card}>
                {content}
              </View>
            );
          }

          return (
            <Pressable
              key={issue.id}
              accessibilityRole="button"
              accessibilityLabel={t("issues.openRelated.accessibility", { title: issue.title })}
              onPress={() => router.push(route as never)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {content}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  card: {
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  title: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  explanation: {
    color: colors.muted,
    ...conceptTypography.body
  },
  meta: {
    color: colors.faint,
    ...conceptTypography.caption
  },
  openRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  openLabel: {
    color: colors.text,
    ...conceptTypography.caption,
    fontFamily: conceptTypography.rowTitle.fontFamily
  },
  pressed: {
    opacity: 0.72
  }
});

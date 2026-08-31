import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  ACTIVITY_FEED_FILTERS,
  activityDateRangeBounds,
  type ActivityDateRange,
  type ActivityEvent,
  type ActivityFeedFilter
} from "../../services/domain/activityEvents";
import { fetchActivityEvents } from "../../services/miseService";
import { resolveActivityRelatedEntityHref } from "../../services/presentation/activityRelatedEntityPresentation";
import { captureMiseError } from "../../services/telemetry";

const dateRanges: ActivityDateRange[] = ["all", "today", "yesterday", "this_week"];

export default function ActivityHistoryScreen() {
  const { t } = useLocale();
  const { restaurant } = useMiseSession();
  const [filter, setFilter] = useState<ActivityFeedFilter>("all");
  const [range, setRange] = useState<ActivityDateRange>("all");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const filterOptions = useMemo<readonly SegmentOption<ActivityFeedFilter>[]>(
    () =>
      ACTIVITY_FEED_FILTERS.map((value) => ({
        value,
        label: t(`activity.filter.${value}` as MessageKey),
        tone:
          value === "needs_attention" || value === "approvals" || value === "errors"
            ? "brand"
            : "neutral"
      })),
    [t]
  );

  const rangeOptions = useMemo<readonly SegmentOption<ActivityDateRange>[]>(
    () =>
      dateRanges.map((value) => ({
        value,
        label: t(`activity.range.${value}` as MessageKey),
        tone: "neutral"
      })),
    [t]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setEvents([]);
    setLoadedRestaurantId(null);
    setError(false);
    setExpandedIds({});
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
      const bounds = activityDateRangeBounds(range);
      const next = await fetchActivityEvents(restaurantId, {
        limit: 160,
        filter,
        since: bounds.since,
        until: bounds.until,
        attentionOnly: filter === "needs_attention" ? true : undefined
      });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setEvents(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "activity", operation: "load", restaurant_id: restaurantId });
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [filter, range, restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visible = loadedRestaurantId === restaurant?.id ? events : [];

  return (
    <Screen
      title={t("activity.title")}
      subtitle={restaurant ? t("activity.subtitle", { restaurant: restaurant.name }) : t("activity.subtitle.none")}
      loading={loading}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <SegmentedControl
          accessibilityLabel={t("activity.range.accessibility")}
          options={rangeOptions}
          value={range}
          onValueChange={setRange}
          scrollable
          variant="pills"
        />
        <SegmentedControl
          accessibilityLabel={t("activity.filter.accessibility")}
          options={filterOptions}
          value={filter}
          onValueChange={setFilter}
          scrollable
          variant="pills"
        />

        {error ? (
          <RetryNotice
            title={t("activity.error.title")}
            message={t("activity.error.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("activity.error.retry")}
            onRetry={() => void load()}
          />
        ) : null}

        {!error && visible.length === 0 ? (
          <EmptyState title={t("activity.empty.title")} body={t("activity.empty.body")} />
        ) : null}

        {visible.map((event) => {
          const expanded = Boolean(expandedIds[event.id]);
          const relatedHref = resolveActivityRelatedEntityHref({
            relatedEntityType: event.relatedEntityType,
            relatedEntityId: event.relatedEntityId
          });
          const relatedTypeLabel = event.relatedEntityType
            ? event.relatedEntityType.replace(/_/g, " ")
            : "";
          return (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={t("activity.expand.accessibility", { title: event.title })}
              onPress={() =>
                setExpandedIds((current) => ({ ...current, [event.id]: !current[event.id] }))
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.time}>{formatActivityWhen(event.occurredAt)}</Text>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={expanded ? undefined : 2}>
                    {event.title}
                  </Text>
                  {event.requiresAttention ? (
                    <Badge tone="danger" label={t("activity.attention")} />
                  ) : null}
                  {expanded ? (
                    <ChevronUp size={icon.inline} color={colors.muted} strokeWidth={iconStroke} />
                  ) : (
                    <ChevronDown size={icon.inline} color={colors.muted} strokeWidth={iconStroke} />
                  )}
                </View>
                <Text style={styles.summary} numberOfLines={expanded ? undefined : 3}>
                  {event.summary}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {event.category}
                  {` · ${event.status.replace(/_/g, " ")}`}
                </Text>
                {expanded ? (
                  <View style={styles.details}>
                    <Text style={styles.detailLine}>
                      {t("activity.detail.trigger")}: {event.triggerType}
                      {event.triggerReference ? ` · ${event.triggerReference}` : ""}
                    </Text>
                    {event.relatedEntityType ? (
                      <View style={styles.relatedBlock}>
                        <Text style={styles.detailLine}>
                          {t("activity.detail.related")}: {relatedTypeLabel}
                          {event.relatedEntityId ? ` · ${event.relatedEntityId}` : ""}
                        </Text>
                        {relatedHref ? (
                          <Pressable
                            accessibilityRole="link"
                            accessibilityLabel={t("activity.detail.openRelated.accessibility", {
                              type: relatedTypeLabel
                            })}
                            onPress={() => router.push(relatedHref as never)}
                            style={({ pressed }) => [
                              styles.relatedLink,
                              pressed && styles.pressed
                            ]}
                          >
                            <Text style={styles.relatedLinkText}>{t("activity.detail.openRelated")}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                    {event.actionId ? (
                      <Text style={styles.detailLine}>
                        {t("activity.detail.action")}: {event.actionId}
                      </Text>
                    ) : null}
                    {event.evidenceReferences.length > 0 ? (
                      <View style={styles.evidenceBlock}>
                        <Text style={styles.detailLine}>{t("activity.detail.evidence")}</Text>
                        {event.evidenceReferences.slice(0, 4).map((evidence) => (
                          <Text key={`${evidence.type}:${evidence.id}`} style={styles.evidenceLine}>
                            {evidence.type.replace(/_/g, " ")} — {evidence.summary}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {Object.keys(event.metadata).length > 0 ? (
                      <Text style={styles.detailLine}>
                        {t("activity.detail.metadata")}: {summarizeMetadata(event.metadata)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

function formatActivityWhen(iso: string) {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  try {
    return new Date(parsed).toLocaleString();
  } catch {
    return iso;
  }
}

function summarizeMetadata(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === "string" || typeof value === "number" ? value : "…"}`)
    .join(" · ");
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    paddingBottom: 24
  },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border
  },
  pressed: {
    opacity: 0.88
  },
  time: {
    ...conceptTypography.caption,
    color: colors.muted,
    width: 88
  },
  copy: {
    flex: 1,
    gap: 4
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  title: {
    ...conceptTypography.rowTitle,
    color: colors.text,
    flex: 1
  },
  summary: {
    ...conceptTypography.body,
    color: colors.muted
  },
  meta: {
    ...conceptTypography.caption,
    color: colors.faint,
    textTransform: "capitalize"
  },
  details: {
    marginTop: 6,
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  detailLine: {
    ...conceptTypography.caption,
    color: colors.muted
  },
  relatedBlock: {
    gap: 6
  },
  relatedLink: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 2
  },
  relatedLinkText: {
    ...conceptTypography.caption,
    color: colors.text,
    fontWeight: "600",
    textDecorationLine: "underline"
  },
  evidenceBlock: {
    gap: 2
  },
  evidenceLine: {
    ...conceptTypography.caption,
    color: colors.faint,
    paddingLeft: 8
  }
});

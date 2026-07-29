import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, CheckSquare, Send } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { EmptyState } from "../components/ui/EmptyState";
import { MiseMark } from "../components/ui/BrandLockup";
import { Screen } from "../components/ui/Screen";
import { RetryNotice } from "../components/ui/StatusNotice";
import { colors, radii, typography } from "../constants/theme";
import { useLocale } from "../contexts/LocaleContext";
import { useMiseSession } from "../contexts/MiseSessionContext";
import type { MessageKey, MessageValues } from "../i18n/catalog";
import { fetchInsights, fetchTodaySummary, type TodayCommandCenterSummary } from "../services/miseService";
import { presentInsight, presentOperationalTodayTask } from "../services/presentation/operationsPresentation";
import { captureMiseError } from "../services/telemetry";
import type { Insight } from "../types/mise";
import type { OperationalTodayTask } from "../services/domain/todayTasks";

type ChatMessage = {
  id: string;
  role: "user" | "mise";
  text: string;
  priorities?: OperationalTodayTask[];
};
type Translator = (key: MessageKey, values?: MessageValues) => string;

function BackAction() {
  const { t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={8}
      onPress={() => router.back()}
      style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.55 }]}
    >
      <ArrowLeft size={20} color={colors.text} strokeWidth={2.1} />
    </Pressable>
  );
}

export default function AskMiseScreen() {
  const navigation = useNavigation();
  const { formatCompactCurrency, formatDueTime, formatNumber, locale, t } = useLocale();
  const { restaurant, user } = useMiseSession();
  const [summary, setSummary] = useState<TodayCommandCenterSummary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    navigation.setOptions({ title: t("ask.title") });
  }, [navigation, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    setSummary(null);
    setInsights([]);
    setLoadedRestaurantId(null);
    setError(null);
    setMessages([]);
    seededRef.current = false;
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
    setError(null);
    try {
      const [nextSummary, nextInsights] = await Promise.all([
        fetchTodaySummary(restaurantId),
        fetchInsights(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSummary(nextSummary);
      setInsights(nextInsights);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "ask_mise", operation: "load", restaurant_id: restaurantId });
      setError(t("ask.error"));
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [restaurant?.id, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visibleSummary = loadedRestaurantId === restaurant?.id ? summary : null;
  const visibleInsights = loadedRestaurantId === restaurant?.id ? insights : [];
  const topPriorityTasks = useMemo(
    () => (visibleSummary?.operationalTasks.filter((task) => task.status === "open").slice(0, 3) ?? []),
    [visibleSummary]
  );

  useEffect(() => {
    if (!visibleSummary || seededRef.current) return;
    seededRef.current = true;
    const greetingName = user?.name?.trim().split(/\s+/)[0] || t("ask.greeting.fallbackName");
    const priorities = topPriorityTasks;
    setMessages([
      {
        id: "welcome",
        role: "mise",
        text: t("ask.greeting.hi", { name: greetingName })
      },
      {
        id: "seed-user",
        role: "user",
        text: t("ask.suggestion.priorities")
      },
      {
        id: "seed-priorities",
        role: "mise",
        text: t("ask.answer.prioritiesLead"),
        priorities
      }
    ]);
  }, [t, topPriorityTasks, user?.name, visibleSummary]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || !visibleSummary) return;
    const priorities = priorityKeywords.test(trimmed.toLowerCase())
      ? visibleSummary.operationalTasks.filter((task) => task.status === "open").slice(0, 3)
      : undefined;
    const response = scriptedAnswer(trimmed, visibleSummary, visibleInsights, {
      formatCompactCurrency,
      formatNumber,
      locale,
      t
    });
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", text: trimmed },
      {
        id: `m-${Date.now()}`,
        role: "mise",
        text: priorities ? t("ask.answer.prioritiesLead") : response,
        priorities
      }
    ]);
    setInput("");
  }

  if (!restaurant) {
    return (
      <Screen title={t("ask.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("ask.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen title={t("ask.title")} titleAlign="center" leadingAction={<BackAction />} loading={loading}>
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("ask.retry.title")}
            message={error}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("ask.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        <View style={styles.chat}>
          {messages.map((message) =>
            message.role === "user" ? (
              <View key={message.id} style={[styles.bubble, styles.userBubble]}>
                <Text style={[styles.bubbleText, styles.userBubbleText]}>{message.text}</Text>
              </View>
            ) : (
              <View key={message.id} style={styles.miseRow}>
                <MiseMark size={16} />
                <View style={styles.miseCopy}>
                  <Text style={styles.bubbleText}>{message.text}</Text>
                  {message.priorities && message.priorities.length > 0 ? (
                    <View style={styles.priorityList}>
                      {message.priorities.map((task) => {
                        const presentation = presentOperationalTodayTask(locale, task);
                        const high = task.priority === "urgent" || task.priority === "high";
                        const due = task.dueAt && visibleSummary
                          ? formatDueTime(task.dueAt, { timeZone: visibleSummary.restaurantTimeZone })
                          : t("task.timing.noTime");
                        return (
                          <Pressable
                            key={task.id}
                            accessibilityRole="button"
                            onPress={() => router.push(`/tasks/${task.id}`)}
                            style={({ pressed }) => [styles.priorityRow, pressed && styles.pressed]}
                          >
                            <CheckSquare size={14} color={colors.muted} strokeWidth={2.2} />
                            <View style={styles.priorityCopy}>
                              <Text numberOfLines={1} style={styles.priorityTitle}>{presentation.title}</Text>
                              <Text numberOfLines={1} style={styles.priorityDue}>{due}</Text>
                            </View>
                            <View style={[styles.priorityChip, high && styles.priorityChipHigh]}>
                              <Text style={[styles.priorityChipText, high && styles.priorityChipTextHigh]}>
                                {t(high ? "task.badge.high" : "task.badge.normal")}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            )
          )}
        </View>

        {visibleSummary ? (
          <View style={styles.suggestions}>
            {[t("ask.suggestion.priorities"), t("ask.suggestion.stock"), t("ask.suggestion.orders")].map((question) => (
              <Pressable
                key={question}
                accessibilityRole="button"
                onPress={() => ask(question)}
                style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
              >
                <Text style={styles.suggestionText}>{question}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel={t("ask.input.accessibility")}
            value={input}
            onChangeText={setInput}
            placeholder={t("ask.input.placeholder")}
            placeholderTextColor={colors.faint}
            style={styles.input}
            onSubmitEditing={() => ask(input)}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("ask.send.accessibility")}
            onPress={() => ask(input)}
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
          >
            <Send size={18} color={colors.surface} strokeWidth={2.25} />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const stockKeywords = /stock|low|inventory|inventario|existencias|bajo|库存|盘点/;
const orderKeywords = /order|supplier|pedido|proveedor|订单|订货|供应商/;
const salesKeywords = /sales|revenue|venta|ingreso|销售|营收/;
const priorityKeywords = /priorit|prioridad|优先/;

function scriptedAnswer(
  question: string,
  summary: TodayCommandCenterSummary,
  insights: Insight[],
  helpers: {
    formatCompactCurrency: (value: number, currency?: string) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    locale: Parameters<typeof presentInsight>[0];
    t: Translator;
  }
) {
  const { t } = helpers;
  const normalized = question.toLowerCase();
  const openTasks = summary.operationalTasks.filter((task) => task.status === "open");
  const topTasks = openTasks.slice(0, 3).map((task) => presentOperationalTodayTask(helpers.locale, task).title);
  const stockRisk = summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const topInsight = insights[0] ? presentInsight(helpers.locale, insights[0]) : null;

  if (stockKeywords.test(normalized)) {
    return stockRisk > 0
      ? t(stockRisk === 1 ? "ask.answer.stock.one" : "ask.answer.stock.other", {
          count: helpers.formatNumber(stockRisk)
        })
      : t("ask.answer.stockClear");
  }

  if (orderKeywords.test(normalized)) {
    return summary.pendingRecommendations > 0
      ? t(summary.pendingRecommendations === 1 ? "ask.answer.orders.one" : "ask.answer.orders.other", {
          count: helpers.formatNumber(summary.pendingRecommendations)
        })
      : t("ask.answer.ordersClear");
  }

  if (salesKeywords.test(normalized)) {
    return t("ask.answer.sales", {
      sales: helpers.formatCompactCurrency(summary.salesToday, summary.restaurantCurrency),
      count: helpers.formatNumber(summary.itemsSold)
    });
  }

  if (topTasks.length > 0) {
    const lead = t("ask.answer.priorities", { tasks: topTasks.join("; ") });
    const tail = topInsight
      ? t("ask.answer.prioritiesInsight", { insight: topInsight.title })
      : t("ask.answer.prioritiesNoInsight");
    return `${lead} ${tail}`;
  }

  return t("ask.answer.fallback");
}

const styles = StyleSheet.create({
  stack: {
    flex: 1,
    gap: 10
  },
  chat: {
    gap: 12,
    flexGrow: 1
  },
  miseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    maxWidth: "94%"
  },
  miseCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.panelStrong
  },
  bubbleText: {
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 18
  },
  userBubbleText: {
    color: colors.text
  },
  priorityList: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  priorityRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  priorityCopy: {
    flex: 1,
    minWidth: 0
  },
  priorityTitle: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 15
  },
  priorityDue: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1
  },
  priorityChip: {
    borderRadius: radii.xl,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.panelStrong
  },
  priorityChipHigh: {
    backgroundColor: colors.dangerSoft
  },
  priorityChipText: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 10,
    lineHeight: 12
  },
  priorityChipTextHigh: {
    color: colors.danger
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  suggestion: {
    minHeight: 28,
    height: 28,
    justifyContent: "center",
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    paddingHorizontal: 10
  },
  suggestionText: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 14
  },
  pressed: {
    opacity: 0.7
  },
  inputRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 14
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  }
});

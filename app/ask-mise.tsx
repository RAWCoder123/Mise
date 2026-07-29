import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Send, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { IconBadge } from "../components/ui/IconBadge";
import { Screen } from "../components/ui/Screen";
import { RetryNotice } from "../components/ui/StatusNotice";
import { colors, radii, shadows, typography } from "../constants/theme";
import { useLocale } from "../contexts/LocaleContext";
import { useMiseSession } from "../contexts/MiseSessionContext";
import type { MessageKey, MessageValues } from "../i18n/catalog";
import { fetchInsights, fetchTodaySummary, type TodayCommandCenterSummary } from "../services/miseService";
import { presentInsight, presentOperationalTodayTask } from "../services/presentation/operationsPresentation";
import { captureMiseError } from "../services/telemetry";
import type { Insight } from "../types/mise";

type ChatMessage = { id: string; role: "user" | "mise"; text: string };
type Translator = (key: MessageKey, values?: MessageValues) => string;

export default function AskMiseScreen() {
  const navigation = useNavigation();
  const { formatCompactCurrency, formatNumber, locale, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [summary, setSummary] = useState<TodayCommandCenterSummary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "welcome", role: "mise", text: t("ask.welcome") }
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || !visibleSummary) return;
    const response = scriptedAnswer(trimmed, visibleSummary, visibleInsights, {
      formatCompactCurrency,
      formatNumber,
      locale,
      t
    });
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", text: trimmed },
      { id: `m-${Date.now()}`, role: "mise", text: response }
    ]);
    setInput("");
  }

  if (!restaurant) {
    return (
      <Screen title={t("ask.title")} subtitle={t("workspace.none.title")}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("ask.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen title={t("ask.title")} subtitle={restaurant.name} loading={loading}>
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

        <View style={styles.hero}>
          <IconBadge tone="brand">
            <Sparkles size={20} color={colors.accentDark} strokeWidth={2.25} />
          </IconBadge>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t("ask.hero.title")}</Text>
            <Text style={styles.heroBody}>{t("ask.hero.body")}</Text>
          </View>
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

        <View style={styles.chat}>
          {messages.map((message) => (
            <View key={message.id} style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.miseBubble]}>
              <Text style={[styles.bubbleText, message.role === "user" && styles.userBubbleText]}>{message.text}</Text>
            </View>
          ))}
        </View>

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
            <Send size={20} color={colors.surface} strokeWidth={2.25} />
          </Pressable>
        </View>

        <Button title={t("ask.back")} variant="secondary" onPress={() => router.replace("/more")} fullWidth />
      </View>
    </Screen>
  );
}

const stockKeywords = /stock|low|inventory|inventario|existencias|bajo|库存|盘点/;
const orderKeywords = /order|supplier|pedido|proveedor|订单|订货|供应商/;
const salesKeywords = /sales|revenue|venta|ingreso|销售|营收/;

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
    gap: 14
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    ...shadows.card
  },
  heroCopy: {
    flex: 1,
    minWidth: 0
  },
  heroTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  heroBody: {
    color: colors.muted,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  suggestion: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 13
  },
  suggestionText: {
    color: colors.accentDark,
    ...typography.caption
  },
  pressed: {
    opacity: 0.7
  },
  chat: {
    gap: 10
  },
  bubble: {
    maxWidth: "86%",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  miseBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent
  },
  bubbleText: {
    color: colors.text,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  userBubbleText: {
    color: colors.accentDark
  },
  inputRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  }
});

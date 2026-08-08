import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, CheckSquare, Send } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ThinkingBubble } from "../components/ask/ThinkingBubble";
import { ActionIcon } from "../components/ui/ActionIcon";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { MiseMark } from "../components/ui/BrandLockup";
import { Screen } from "../components/ui/Screen";
import { RetryNotice } from "../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii, typography } from "../constants/theme";
import { useLocale } from "../contexts/LocaleContext";
import { useMiseSession } from "../contexts/MiseSessionContext";
import {
  answerAskMise,
  fetchInsights,
  fetchTodaySummary,
  type TodayCommandCenterSummary
} from "../services/miseService";
import { presentOperationalTodayTask } from "../services/presentation/operationsPresentation";
import { captureMiseError } from "../services/telemetry";
import type { Insight } from "../types/mise";
import type { OperationalTodayTask } from "../services/domain/todayTasks";

type ChatMessage = {
  id: string;
  role: "user" | "mise";
  text: string;
  priorities?: OperationalTodayTask[];
};

type ThinkingState = {
  steps: string[];
  revealedCount: number;
};

const THINK_STEP_MS = 420;
const THINK_HOLD_MS = 280;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
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
  const [thinking, setThinking] = useState<ThinkingState | null>(null);
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);
  const requestIdRef = useRef(0);
  const askGenerationRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    navigation.setOptions({ title: t("ask.title") });
  }, [navigation, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    askGenerationRef.current += 1;
    setSummary(null);
    setInsights([]);
    setLoadedRestaurantId(null);
    setError(null);
    setMessages([]);
    setThinking(null);
    setAsking(false);
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

  useEffect(() => {
    if (!visibleSummary || !restaurant || seededRef.current) return;
    seededRef.current = true;
    const greetingName = user?.name?.trim().split(/\s+/)[0] || t("ask.greeting.fallbackName");
    setMessages([
      {
        id: "welcome",
        role: "mise",
        text: `${t("ask.greeting.hi", { name: greetingName })} ${t("ask.greeting.body", {
          restaurant: restaurant.name
        })}`
      }
    ]);
  }, [restaurant, t, user?.name, visibleSummary]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || !visibleSummary || !restaurant || asking) return;

      const generation = ++askGenerationRef.current;
      const restaurantId = restaurant.id;
      setAsking(true);
      setInput("");
      setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);

      try {
        const reply = answerAskMise({
          question: trimmed,
          restaurant,
          summary: visibleSummary,
          insights: visibleInsights,
          helpers: {
            formatCompactCurrency,
            formatNumber,
            locale,
            t
          }
        });

        if (generation !== askGenerationRef.current || activeRestaurantIdRef.current !== restaurantId) return;

        setThinking({ steps: reply.thinkingSteps, revealedCount: 0 });
        for (let index = 0; index < reply.thinkingSteps.length; index += 1) {
          await delay(THINK_STEP_MS);
          if (generation !== askGenerationRef.current || activeRestaurantIdRef.current !== restaurantId) return;
          setThinking({ steps: reply.thinkingSteps, revealedCount: index + 1 });
        }

        await delay(THINK_HOLD_MS);
        if (generation !== askGenerationRef.current || activeRestaurantIdRef.current !== restaurantId) return;

        setThinking(null);
        setMessages((current) => [
          ...current,
          {
            id: `m-${Date.now()}`,
            role: "mise",
            text: reply.answer,
            priorities: reply.showPriorities ? reply.priorities : undefined
          }
        ]);
      } catch (askError) {
        if (generation !== askGenerationRef.current || activeRestaurantIdRef.current !== restaurantId) return;
        captureMiseError(askError, { flow: "ask_mise", operation: "ask", restaurant_id: restaurantId });
        setThinking(null);
        setMessages((current) => [
          ...current,
          {
            id: `m-error-${Date.now()}`,
            role: "mise",
            text: t("ask.answer.error")
          }
        ]);
      } finally {
        if (generation === askGenerationRef.current) setAsking(false);
      }
    },
    [
      asking,
      formatCompactCurrency,
      formatNumber,
      locale,
      restaurant,
      t,
      visibleInsights,
      visibleSummary
    ]
  );

  if (!restaurant) {
    return (
      <Screen title={t("ask.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("ask.noRestaurant.body")} />
      </Screen>
    );
  }

  const suggestions = [
    t("ask.suggestion.priorities"),
    t("ask.suggestion.prep"),
    t("ask.suggestion.waste"),
    t("ask.suggestion.stock"),
    t("ask.suggestion.orders"),
    t("ask.suggestion.briefing")
  ];

  return (
    <Screen
      title={t("ask.title")}
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
      keyboardAware
    >
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
                <MiseMark size={icon.emphasis} />
                <View style={styles.miseCopy}>
                  <Text style={styles.bubbleText}>{message.text}</Text>
                  {message.priorities && message.priorities.length > 0 ? (
                    <View style={styles.priorityList}>
                      {message.priorities.map((task) => {
                        const presentation = presentOperationalTodayTask(locale, task);
                        const high = task.priority === "urgent" || task.priority === "high";
                        const due =
                          task.dueAt && visibleSummary
                            ? formatDueTime(task.dueAt, { timeZone: visibleSummary.restaurantTimeZone })
                            : t("task.timing.noTime");
                        return (
                          <Pressable
                            key={task.id}
                            accessibilityRole="button"
                            onPress={() => router.push(`/tasks/${task.id}`)}
                            style={({ pressed }) => [styles.priorityRow, pressed && styles.pressed]}
                          >
                            <CheckSquare size={icon.inline} color={colors.muted} strokeWidth={iconStroke} />
                            <View style={styles.priorityCopy}>
                              <Text numberOfLines={1} style={styles.priorityTitle}>
                                {presentation.title}
                              </Text>
                              <Text numberOfLines={1} style={styles.priorityDue}>
                                {due}
                              </Text>
                            </View>
                            <Badge
                              label={t(high ? "task.badge.high" : "task.badge.normal")}
                              tone={high ? "danger" : "neutral"}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            )
          )}

          {thinking ? (
            <ThinkingBubble
              label={t("ask.thinking.label")}
              steps={thinking.steps}
              revealedCount={thinking.revealedCount}
            />
          ) : null}
        </View>

        {visibleSummary && !asking ? (
          <View style={styles.suggestions}>
            {suggestions.map((question) => (
              <Pressable
                key={question}
                accessibilityRole="button"
                onPress={() => void ask(question)}
                style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
              >
                <Text style={styles.suggestionText}>{question}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={[styles.composer, asking && styles.composerDisabled]}>
          <TextInput
            accessibilityLabel={t("ask.input.accessibility")}
            value={input}
            onChangeText={setInput}
            placeholder={t("ask.input.placeholder")}
            placeholderTextColor={colors.faint}
            style={styles.input}
            editable={!asking}
            onSubmitEditing={() => void ask(input)}
            returnKeyType="send"
          />
          <ActionIcon
            tone={asking || !input.trim() ? "default" : "brand"}
            accessibilityLabel={t("ask.send.accessibility")}
            accessibilityState={{ disabled: asking || !input.trim() }}
            disabled={asking || !input.trim()}
            onPress={() => void ask(input)}
            style={styles.sendButton}
          >
            <Send
              size={icon.row}
              color={asking || !input.trim() ? colors.faint : colors.accentDark}
              strokeWidth={iconStroke}
            />
          </ActionIcon>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    flex: 1,
    gap: 10
  },
  chat: {
    gap: 9,
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
    maxWidth: "82%",
    borderRadius: radii.lg,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.panelStrong
  },
  bubbleText: {
    color: colors.text,
    ...conceptTypography.body
  },
  userBubbleText: {
    color: colors.text
  },
  priorityList: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  priorityRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  priorityCopy: {
    flex: 1,
    minWidth: 0
  },
  priorityTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  priorityDue: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: typography.families.body,
    marginTop: 2
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  suggestion: {
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  suggestionText: {
    color: colors.accentDark,
    ...conceptTypography.caption,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 17
  },
  pressed: {
    opacity: 0.7
  },
  composer: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: 14,
    paddingRight: 6,
    gap: 8
  },
  composerDisabled: {
    opacity: 0.72
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20
  }
});

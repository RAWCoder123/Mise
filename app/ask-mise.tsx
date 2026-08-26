import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, Circle, Send } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ThinkingBubble } from "../components/ask/ThinkingBubble";
import { ActionIcon } from "../components/ui/ActionIcon";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { MiseMark } from "../components/ui/BrandLockup";
import { Screen } from "../components/ui/Screen";
import { RetryNotice } from "../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii, typography } from "../constants/theme";
import { useLocale } from "../contexts/LocaleContext";
import { useMiseSession } from "../contexts/MiseSessionContext";
import { DEMO_DATASET } from "../services/demoData";
import {
  answerAskMise,
  fetchInsights,
  fetchTodaySummary,
  type TodayCommandCenterSummary
} from "../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../services/presentation/hubLoadState";
import { presentOperationalTodayTask } from "../services/presentation/operationsPresentation";
import { captureMiseError } from "../services/telemetry";
import type { Insight } from "../types/mise";
import type { OperationalTodayTask } from "../services/domain/todayTasks";

type ChatMessage = {
  id: string;
  role: "user" | "mise";
  title?: string;
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
  const { canUseDemoMode, continueWithDemo, restaurant, user } = useMiseSession();
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
  const chatRef = useRef<ScrollView>(null);
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

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: Boolean(error)
  });
  const hubReady = hubLoadState === "ready";
  const askEditable = presentRestaurantScopedHubActionsEditable({
    hubReady,
    allowed: true,
    busy: asking
  });
  // Soft-refresh may keep last-known summary/insights in state, but loadError must
  // never keep Ask Mise answerable from stale operational evidence.
  const visibleSummary = hubReady ? summary : null;
  const visibleInsights = hubReady ? insights : [];
  const visibleMessages = hubReady ? messages : [];

  const revealLatestMessage = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      chatRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (!visibleSummary || !restaurant || seededRef.current) return;
    seededRef.current = true;
    const greetingName = user?.name?.trim().split(/\s+/)[0] || t("ask.greeting.fallbackName");
    const question = t("ask.suggestion.priorities");
    const reply = answerAskMise({
      question,
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
    setMessages([
      {
        id: "welcome",
        role: "mise",
        title: t("ask.greeting.hi", { name: greetingName }),
        text: t("ask.greeting.body", {
          restaurant: restaurant.name
        })
      },
      {
        id: "seed-question",
        role: "user",
        text: question
      },
      {
        id: "seed-answer",
        role: "mise",
        text: reply.answer,
        priorities: reply.showPriorities ? reply.priorities : undefined
      }
    ]);
    revealLatestMessage(false);
  }, [
    formatCompactCurrency,
    formatNumber,
    locale,
    restaurant,
    revealLatestMessage,
    t,
    user?.name,
    visibleInsights,
    visibleSummary
  ]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || !visibleSummary || !restaurant || asking || !hubReady) return;

      const generation = ++askGenerationRef.current;
      const restaurantId = restaurant.id;
      setAsking(true);
      setInput("");
      setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);
      revealLatestMessage();

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
        revealLatestMessage();
        for (let index = 0; index < reply.thinkingSteps.length; index += 1) {
          await delay(THINK_STEP_MS);
          if (generation !== askGenerationRef.current || activeRestaurantIdRef.current !== restaurantId) return;
          setThinking({ steps: reply.thinkingSteps, revealedCount: index + 1 });
          revealLatestMessage();
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
        revealLatestMessage();
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
        revealLatestMessage();
      } finally {
        if (generation === askGenerationRef.current) setAsking(false);
      }
    },
    [
      asking,
      formatCompactCurrency,
      formatNumber,
      hubReady,
      locale,
      restaurant,
      revealLatestMessage,
      t,
      visibleInsights,
      visibleSummary
    ]
  );

  const openWorkspace = useCallback(async () => {
    if (!canUseDemoMode) {
      router.replace("/setup");
      return;
    }
    await continueWithDemo({
      preset: DEMO_DATASET.id,
      name: DEMO_DATASET.restaurant.name,
      cuisine_type: DEMO_DATASET.restaurant.cuisineType,
      posProvider: DEMO_DATASET.defaultPosProvider
    });
    router.replace("/ask-mise");
  }, [canUseDemoMode, continueWithDemo]);

  if (!restaurant) {
    return (
      <Screen title={t("ask.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("ask.noRestaurant.body")} />
        <Button
          title={t(canUseDemoMode ? "workspace.none.demoAction" : "workspace.none.setupAction")}
          onPress={() => void openWorkspace()}
          fullWidth
          style={styles.emptyButton}
        />
      </Screen>
    );
  }

  // The first three are shown; they are the terse ones, per the reference.
  const suggestions = [
    t("ask.suggestion.stock"),
    t("ask.suggestion.priorities"),
    t("ask.suggestion.orders"),
    t("ask.suggestion.prep"),
    t("ask.suggestion.waste"),
    t("ask.suggestion.briefing")
  ];

  return (
    <Screen
      title={t("ask.title")}
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
      keyboardAware
      scroll={false}
      contentStyle={styles.screenContent}
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

        <ScrollView
          ref={chatRef}
          contentContainerStyle={styles.chatContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => revealLatestMessage(messages.length > 3 || Boolean(thinking))}
          showsVerticalScrollIndicator={false}
          style={styles.chat}
        >
          {visibleMessages.map((message) =>
            message.role === "user" ? (
              <View key={message.id} style={[styles.bubble, styles.userBubble]}>
                <Text style={[styles.bubbleText, styles.userBubbleText]}>{message.text}</Text>
              </View>
            ) : (
              <View key={message.id} style={styles.miseRow}>
                <MiseMark size={28} />
                <View style={styles.miseCopy}>
                  {message.title ? <Text style={styles.miseTitle}>{message.title}</Text> : null}
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
                            <Circle size={icon.inline} color={colors.borderStrong} strokeWidth={iconStroke} />
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

          {hubReady && thinking ? (
            <ThinkingBubble
              label={t("ask.thinking.label")}
              steps={thinking.steps}
              revealedCount={thinking.revealedCount}
            />
          ) : null}
        </ScrollView>

        {visibleSummary && askEditable ? (
          <View style={styles.suggestions}>
            {suggestions.slice(0, 3).map((question) => (
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

        <View style={[styles.composer, !askEditable && styles.composerDisabled]}>
          <TextInput
            accessibilityLabel={t("ask.input.accessibility")}
            value={input}
            onChangeText={setInput}
            placeholder={t("ask.input.placeholder")}
            placeholderTextColor={colors.faint}
            style={styles.input}
            editable={askEditable}
            onSubmitEditing={() => {
              if (askEditable) void ask(input);
            }}
            returnKeyType="send"
          />
          <ActionIcon
            accessibilityLabel={t("ask.send.accessibility")}
            accessibilityState={{ disabled: !askEditable || !input.trim() }}
            disabled={!askEditable || !input.trim()}
            onPress={() => void ask(input)}
            style={[styles.sendButton, askEditable && input.trim() ? styles.sendButtonReady : null]}
          >
            <Send
              size={icon.row}
              color={!askEditable ? colors.faint : input.trim() ? colors.surface : colors.accent}
              strokeWidth={iconStroke}
            />
          </ActionIcon>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1
  },
  stack: {
    flex: 1,
    gap: 10,
    paddingBottom: 12
  },
  chat: {
    flex: 1
  },
  chatContent: {
    gap: 9,
    paddingBottom: 4
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
  miseTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle,
    marginBottom: -5
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: radii.lg,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 10
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
  suggestionsPinned: {
    paddingTop: 2
  },
  suggestion: {
    minHeight: 34,
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  suggestionText: {
    color: colors.text,
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
    width: 36,
    height: 36,
    borderRadius: 18
  },
  sendButtonReady: {
    backgroundColor: colors.accent
  },
  emptyButton: {
    marginTop: 12
  }
});

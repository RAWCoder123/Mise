import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Brain } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { RestaurantMemory } from "../../services/domain/restaurantMemory";
import {
  convertRestaurantMemoryToSafeRule,
  fetchRestaurantMemories,
  updateRestaurantMemoryDecision
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

export default function RestaurantMemoryScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [memories, setMemories] = useState<RestaurantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  const canManage = canManageRestaurantData(memberships, restaurant?.id);

  useEffect(() => {
    requestIdRef.current += 1;
    setMemories([]);
    setLoadedRestaurantId(null);
    setError(false);
    setNotice(null);
    setBusyId(null);
    setCorrectionDrafts({});
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
      const next = await fetchRestaurantMemories(restaurantId, { status: "actionable", limit: 80 });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setMemories(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "restaurant_memory", operation: "load", restaurant_id: restaurantId });
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

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: error
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: Boolean(busyId)
  });

  async function decide(
    memory: RestaurantMemory,
    decision: "confirmed" | "corrected" | "dismissed" | "forgotten" | "disabled"
  ) {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    setBusyId(memory.id);
    setNotice(null);
    try {
      const correction =
        decision === "corrected" ? (correctionDrafts[memory.id] ?? memory.statement).trim() : null;
      if (decision === "corrected" && !correction) {
        setNotice(t("memory.notice.correctionRequired"));
        return;
      }
      await updateRestaurantMemoryDecision(restaurantId, memory.id, decision, correction);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(t("memory.notice.saved"));
      await load();
    } catch (decideError) {
      captureMiseError(decideError, {
        flow: "restaurant_memory",
        operation: "decide",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(t("memory.notice.error"));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyId(null);
    }
  }

  async function convertToRule(memory: RestaurantMemory) {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    setBusyId(memory.id);
    setNotice(null);
    try {
      await convertRestaurantMemoryToSafeRule(restaurantId, memory.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(t("memory.notice.ruleCreated"));
    } catch (convertError) {
      captureMiseError(convertError, {
        flow: "restaurant_memory",
        operation: "convert_rule",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(t("memory.notice.ruleError"));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyId(null);
    }
  }

  const visible = hubReady ? memories : [];

  return (
    <Screen
      title={t("memory.title")}
      subtitle={restaurant ? t("memory.subtitle", { restaurant: restaurant.name }) : t("memory.subtitle.none")}
      loading={loading}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        {!canManage ? <StatusNotice tone="neutral" title={t("memory.viewOnly.title")} message={t("memory.viewOnly.body")} /> : null}
        {notice ? <StatusNotice tone="success" title={notice} /> : null}
        {error ? (
          <StatusNotice
            tone="danger"
            title={t("memory.error.title")}
            message={t("memory.error.body")}
            actionLabel={t("common.retry")}
            onAction={() => void load()}
          />
        ) : null}

        {!error && visible.length === 0 ? (
          <EmptyState
            title={t("memory.empty.title")}
            body={t("memory.empty.body")}
            illustration={<Brain size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
          />
        ) : null}

        {visible.map((memory) => (
          <View key={memory.id} style={styles.card}>
            <Text style={styles.type}>{memory.memoryType.replace(/_/g, " ")}</Text>
            <Text style={styles.statement}>{memory.statement}</Text>
            <Text style={styles.meta}>
              {t("memory.confidence", {
                score: formatNumber(memory.confidence, { style: "percent", maximumFractionDigits: 0 })
              })}
              {" · "}
              {memory.status}
              {" · "}
              {t("memory.updated", {
                date: formatDate(memory.lastUpdatedAt, { dateStyle: "medium", timeStyle: "short" })
              })}
            </Text>
            {memory.evidence.length > 0 ? (
              <View style={styles.evidence}>
                <Text style={styles.evidenceTitle}>{t("memory.evidence.title")}</Text>
                {memory.evidence.slice(0, 4).map((entry) => (
                  <Text key={`${entry.type}:${entry.id}`} style={styles.evidenceLine}>
                    {entry.summary}
                    {" · "}
                    {formatDate(entry.observedAt, { dateStyle: "medium" })}
                  </Text>
                ))}
              </View>
            ) : null}
            {actionsEditable ? (
              <>
                <TextInput
                  accessibilityLabel={t("memory.correction.label")}
                  value={correctionDrafts[memory.id] ?? memory.statement}
                  onChangeText={(value) =>
                    setCorrectionDrafts((current) => ({ ...current, [memory.id]: value }))
                  }
                  multiline
                  style={styles.input}
                  editable={actionsEditable && busyId !== memory.id}
                />
                <View style={styles.actions}>
                  <Button
                    title={t("memory.action.confirm")}
                    variant="secondary"
                    disabled={!actionsEditable || busyId === memory.id}
                    onPress={() => void decide(memory, "confirmed")}
                    style={styles.action}
                  />
                  <Button
                    title={t("memory.action.correct")}
                    disabled={!actionsEditable || busyId === memory.id}
                    onPress={() => void decide(memory, "corrected")}
                    style={styles.action}
                  />
                  <Button
                    title={t("memory.action.dismiss")}
                    variant="secondary"
                    disabled={!actionsEditable || busyId === memory.id}
                    onPress={() => void decide(memory, "dismissed")}
                    style={styles.action}
                  />
                  <Button
                    title={t("memory.action.disable")}
                    variant="secondary"
                    disabled={!actionsEditable || busyId === memory.id}
                    onPress={() => void decide(memory, "disabled")}
                    style={styles.action}
                  />
                  <Button
                    title={t("memory.action.forget")}
                    variant="secondary"
                    disabled={!actionsEditable || busyId === memory.id}
                    onPress={() => void decide(memory, "forgotten")}
                    style={styles.action}
                  />
                  <Button
                    title={t("memory.action.convertRule")}
                    disabled={!actionsEditable || busyId === memory.id}
                    onPress={() => void convertToRule(memory)}
                    style={styles.action}
                  />
                </View>
              </>
            ) : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    paddingBottom: 24
  },
  card: {
    gap: 8,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border
  },
  type: {
    ...conceptTypography.caption,
    color: colors.muted,
    textTransform: "capitalize"
  },
  statement: {
    ...conceptTypography.rowTitle,
    color: colors.text
  },
  meta: {
    ...conceptTypography.caption,
    color: colors.faint
  },
  evidence: {
    gap: 2
  },
  evidenceTitle: {
    ...conceptTypography.caption,
    color: colors.muted
  },
  evidenceLine: {
    ...conceptTypography.caption,
    color: colors.faint,
    paddingLeft: 4
  },
  input: {
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...conceptTypography.body,
    color: colors.text,
    backgroundColor: colors.surface
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  action: {
    flexGrow: 1
  }
});

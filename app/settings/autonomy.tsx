import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Shield } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { RestaurantAutonomyRule } from "../../services/domain/restaurantAutonomy";
import {
  createSafeDefaultAutonomyRules,
  fetchAutonomyRules,
  saveAutonomyRule
} from "../../services/miseService";
import {
  presentAutonomyActionTypeLabel,
  presentAutonomyCategoryLabel,
  presentAutonomyLevelLabel
} from "../../services/presentation/autonomyLabels";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canDeleteRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

type DraftFields = {
  spendLimitText: string;
  communicationType: string;
  allowedStartTime: string;
  allowedEndTime: string;
};

export default function AutonomySettingsScreen() {
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [rules, setRules] = useState<RestaurantAutonomyRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftFields>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  const canEdit = canDeleteRestaurantData(memberships, restaurant?.id);

  useEffect(() => {
    requestIdRef.current += 1;
    setRules([]);
    setDrafts({});
    setLoadedRestaurantId(null);
    setError(false);
    setNotice(null);
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
      const next = await fetchAutonomyRules(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setRules(next);
      setDrafts(Object.fromEntries(next.map((rule) => [rule.id, draftFromRule(rule)])));
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "autonomy", operation: "load", restaurant_id: restaurantId });
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
    allowed: canEdit,
    hubReady,
    busy: Boolean(busyKey)
  });

  async function persist(
    rule: RestaurantAutonomyRule,
    patch: Partial<{
      enabled: boolean;
      requiresApproval: boolean;
      maximumAutonomyLevel: 1 | 2 | 3 | 4 | 5;
    }> = {}
  ) {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    const draft = drafts[rule.id] ?? draftFromRule(rule);
    const spendParsed = draft.spendLimitText.trim()
      ? Math.round(Number(draft.spendLimitText) * 100)
      : null;
    if (draft.spendLimitText.trim() && (!Number.isFinite(spendParsed) || (spendParsed ?? 0) < 0)) {
      setNotice(t("autonomy.notice.spendInvalid"));
      return;
    }
    setBusyKey(rule.id);
    setNotice(null);
    try {
      await saveAutonomyRule(restaurantId, {
        actionType: String(rule.actionType),
        operationalCategory: rule.operationalCategory,
        maximumAutonomyLevel: patch.maximumAutonomyLevel ?? rule.maximumAutonomyLevel,
        requiresApproval: patch.requiresApproval ?? rule.requiresApproval,
        enabled: patch.enabled ?? rule.enabled,
        spendLimitCents: spendParsed,
        supplierId: rule.supplierId,
        communicationType: draft.communicationType.trim() || null,
        allowedStartTime: normalizeTime(draft.allowedStartTime),
        allowedEndTime: normalizeTime(draft.allowedEndTime)
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(t("autonomy.notice.saved"));
      await load();
    } catch (saveError) {
      captureMiseError(saveError, { flow: "autonomy", operation: "save", restaurant_id: restaurantId });
      if (activeRestaurantIdRef.current === restaurantId) setNotice(t("autonomy.notice.error"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyKey(null);
    }
  }

  async function createDefaults() {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    setBusyKey("defaults");
    setNotice(null);
    try {
      await createSafeDefaultAutonomyRules(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(t("autonomy.notice.defaultsCreated"));
      await load();
    } catch (createError) {
      captureMiseError(createError, {
        flow: "autonomy",
        operation: "create_defaults",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) setNotice(t("autonomy.notice.error"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyKey(null);
    }
  }

  const visible = hubReady ? rules : [];

  return (
    <Screen
      title={t("autonomy.title")}
      subtitle={restaurant ? t("autonomy.subtitle", { restaurant: restaurant.name }) : t("autonomy.subtitle.none")}
      loading={loading}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <StatusNotice tone="caution" title={t("autonomy.guard.title")} message={t("autonomy.guard.body")} />
        {!canEdit ? (
          <StatusNotice tone="neutral" title={t("autonomy.viewOnly.title")} message={t("autonomy.viewOnly.body")} />
        ) : null}
        {notice ? <StatusNotice tone="success" title={notice} /> : null}
        {error ? (
          <StatusNotice
            tone="danger"
            title={t("autonomy.error.title")}
            message={t("autonomy.error.body")}
            actionLabel={t("common.retry")}
            onAction={() => void load()}
          />
        ) : null}

        {!error && visible.length === 0 ? (
          <EmptyState
            title={t("autonomy.empty.title")}
            body={t("autonomy.empty.body")}
            illustration={<Shield size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
          />
        ) : null}

        {!error && visible.length === 0 && actionsEditable ? (
          <Button
            title={busyKey === "defaults" ? t("autonomy.action.creatingDefaults") : t("autonomy.action.createDefaults")}
            onPress={() => void createDefaults()}
            disabled={!actionsEditable}
            fullWidth
          />
        ) : null}

        {visible.map((rule) => {
          const draft = drafts[rule.id] ?? draftFromRule(rule);
          const isSend = rule.actionType === "send_supplier_order";
          return (
            <View key={rule.id} style={styles.card}>
              <Text style={styles.title}>{presentAutonomyActionTypeLabel(String(rule.actionType), t)}</Text>
              <Text style={styles.meta}>
                {presentAutonomyCategoryLabel(rule.operationalCategory, t)}
                {" · "}
                {t("autonomy.level", {
                  level: `${formatNumber(rule.maximumAutonomyLevel)} (${presentAutonomyLevelLabel(rule.maximumAutonomyLevel, t)})`
                })}
              </Text>
              <Text style={styles.status}>
                {rule.enabled ? t("autonomy.enabled") : t("autonomy.disabled")}
                {" · "}
                {rule.requiresApproval || isSend
                  ? t("autonomy.requiresApproval")
                  : t("autonomy.noApproval")}
              </Text>

              {actionsEditable ? (
                <>
                  <View style={styles.fieldGrid}>
                    <Field
                      label={t("autonomy.field.spend")}
                      value={draft.spendLimitText}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [rule.id]: { ...draft, spendLimitText: value }
                        }))
                      }
                      placeholder="0"
                    />
                    <ReadOnlyField
                      label={t("autonomy.field.supplier")}
                      value={rule.supplierName ?? "—"}
                    />
                    <Field
                      label={t("autonomy.field.communication")}
                      value={draft.communicationType}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [rule.id]: { ...draft, communicationType: value }
                        }))
                      }
                      placeholder="email"
                    />
                    <Field
                      label={t("autonomy.field.start")}
                      value={draft.allowedStartTime}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [rule.id]: { ...draft, allowedStartTime: value }
                        }))
                      }
                      placeholder="09:00"
                    />
                    <Field
                      label={t("autonomy.field.end")}
                      value={draft.allowedEndTime}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [rule.id]: { ...draft, allowedEndTime: value }
                        }))
                      }
                      placeholder="17:00"
                    />
                  </View>

                  <View style={styles.actions}>
                    <Chip
                      label={rule.enabled ? t("autonomy.action.disable") : t("autonomy.action.enable")}
                      disabled={!actionsEditable || busyKey === rule.id}
                      onPress={() => void persist(rule, { enabled: !rule.enabled })}
                    />
                    {!isSend ? (
                      <Chip
                        label={
                          rule.requiresApproval
                            ? t("autonomy.action.allowWithoutApproval")
                            : t("autonomy.action.requireApproval")
                        }
                        disabled={!actionsEditable || busyKey === rule.id}
                        onPress={() => void persist(rule, { requiresApproval: !rule.requiresApproval })}
                      />
                    ) : (
                      <Text style={styles.locked}>{t("autonomy.sendLocked")}</Text>
                    )}
                    <Chip
                      label={t("autonomy.action.levelDown")}
                      disabled={!actionsEditable || busyKey === rule.id || rule.maximumAutonomyLevel <= 1}
                      onPress={() =>
                        void persist(rule, {
                          maximumAutonomyLevel: Math.max(1, rule.maximumAutonomyLevel - 1) as 1 | 2 | 3 | 4 | 5
                        })
                      }
                    />
                    <Chip
                      label={t("autonomy.action.levelUp")}
                      disabled={!actionsEditable || busyKey === rule.id || rule.maximumAutonomyLevel >= 5}
                      onPress={() =>
                        void persist(rule, {
                          maximumAutonomyLevel: Math.min(5, rule.maximumAutonomyLevel + 1) as 1 | 2 | 3 | 4 | 5
                        })
                      }
                    />
                    <Chip
                      label={t("autonomy.action.saveScope")}
                      disabled={!actionsEditable || busyKey === rule.id}
                      onPress={() => void persist(rule)}
                    />
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function draftFromRule(rule: RestaurantAutonomyRule): DraftFields {
  return {
    spendLimitText:
      rule.spendLimitCents == null ? "" : String(Math.round(rule.spendLimitCents) / 100),
    communicationType: rule.communicationType ?? "",
    allowedStartTime: rule.allowedStartTime ?? "",
    allowedEndTime: rule.allowedEndTime ?? ""
  };
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.readOnlyInput}>
        <Text style={styles.readOnlyValue}>{value}</Text>
      </View>
    </View>
  );
}

function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return null;
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        style={styles.input}
      />
    </View>
  );
}

function Chip({
  label,
  onPress,
  disabled
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
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
  title: {
    ...conceptTypography.rowTitle,
    color: colors.text,
    textTransform: "capitalize"
  },
  meta: {
    ...conceptTypography.body,
    color: colors.muted,
    textTransform: "capitalize"
  },
  status: {
    ...conceptTypography.caption,
    color: colors.faint
  },
  fieldGrid: {
    gap: 8
  },
  field: {
    gap: 4
  },
  fieldLabel: {
    ...conceptTypography.caption,
    color: colors.muted
  },
  input: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    ...conceptTypography.body,
    color: colors.text,
    backgroundColor: colors.surface
  },
  readOnlyInput: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm
  },
  readOnlyValue: {
    ...conceptTypography.body,
    color: colors.text
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center"
  },
  chipText: {
    ...conceptTypography.caption,
    color: colors.text
  },
  locked: {
    ...conceptTypography.caption,
    color: colors.muted,
    alignSelf: "center"
  },
  pressed: {
    opacity: 0.85
  },
  disabled: {
    opacity: 0.45
  }
});

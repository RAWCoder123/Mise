import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import { AlertTriangle, ArrowLeft, BookOpen, ListChecks, PlugZap } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii, spacing } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  type PosDepletionDiagnostics,
  type PosDepletionSkipReason
} from "../../services/domain/posDepletionDiagnostics";
import { fetchPosDepletionDiagnostics } from "../../services/miseService";
import { resolveRestaurantScopedHubLoadState } from "../../services/presentation/hubLoadState";
import { captureMiseError } from "../../services/telemetry";

const REASON_KEYS: Record<PosDepletionSkipReason, MessageKey> = {
  unverified_provider_mapping: "posDepletion.reason.unverified",
  unmapped_recipe: "posDepletion.reason.unmapped",
  incompatible_recipe_units: "posDepletion.reason.incompatible",
  missing_inventory_item: "posDepletion.reason.missingInventory"
};

export default function PosDepletionDiagnosticsScreen() {
  const { formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [diagnostics, setDiagnostics] = useState<PosDepletionDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setDiagnostics(null);
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
      const next = await fetchPosDepletionDiagnostics(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setDiagnostics(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, {
        flow: "pos_depletion_diagnostics",
        operation: "load",
        restaurant_id: restaurantId
      });
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
  const visible = hubReady ? diagnostics : null;
  const needsAttention =
    (visible?.skippedSaleCount ?? 0) > 0 || (visible?.partialAttentionSaleCount ?? 0) > 0;

  return (
    <Screen
      title={t("posDepletion.title")}
      subtitle={
        restaurant
          ? t("posDepletion.subtitle", { restaurant: restaurant.name })
          : t("posDepletion.subtitle.none")
      }
      action={
        <ActionIcon accessibilityLabel={t("posDepletion.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        {hubLoadState === "error" ? (
          <RetryNotice
            title={t("posDepletion.error.title")}
            message={t("posDepletion.error.body")}
            onRetry={() => void load()}
          />
        ) : null}

        {loading && !visible ? (
          <StatusNotice
            tone="neutral"
            title={t("posDepletion.loading.title")}
            message={t("posDepletion.loading.body")}
          />
        ) : null}

        {!restaurant ? (
          <EmptyState
            title={t("posDepletion.empty.restaurantTitle")}
            body={t("posDepletion.empty.restaurantBody")}
            illustration={<PlugZap size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
          />
        ) : null}

        {hubReady && visible ? (
          <>
            <StatusNotice
              tone={needsAttention ? "warning" : "success"}
              title={
                needsAttention
                  ? t("posDepletion.summary.attentionTitle")
                  : t("posDepletion.summary.readyTitle")
              }
              message={
                needsAttention
                  ? t("posDepletion.summary.attentionBody", {
                      skipped: formatNumber(visible.skippedSaleCount),
                      partial: formatNumber(visible.partialAttentionSaleCount),
                      date: visible.operatingDate
                    })
                  : t("posDepletion.summary.readyBody", {
                      depleting: formatNumber(visible.depletingSaleCount),
                      date: visible.operatingDate
                    })
              }
            />

            <View style={styles.statRow}>
              <StatChip
                label={t("posDepletion.stat.today")}
                value={formatNumber(visible.todaySaleCount)}
              />
              <StatChip
                label={t("posDepletion.stat.depleting")}
                value={formatNumber(visible.depletingSaleCount)}
                tone="leaf"
              />
              <StatChip
                label={t("posDepletion.stat.skipped")}
                value={formatNumber(visible.skippedSaleCount)}
                tone={visible.skippedSaleCount > 0 ? "caution" : "neutral"}
              />
            </View>

            <SectionHeader title={t("posDepletion.reasons.title")} />
            <Card style={styles.card}>
              {(Object.keys(REASON_KEYS) as PosDepletionSkipReason[]).map((reason) => (
                <View key={reason} style={styles.reasonRow}>
                  <Text style={styles.reasonLabel}>{t(REASON_KEYS[reason])}</Text>
                  <Badge
                    label={formatNumber(visible.countsByReason[reason])}
                    tone={visible.countsByReason[reason] > 0 ? "warning" : "neutral"}
                  />
                </View>
              ))}
            </Card>

            {visible.samples.length > 0 ? (
              <>
                <SectionHeader title={t("posDepletion.samples.title")} />
                <View style={styles.list}>
                  {visible.samples.map((sample, index) => (
                    <Card key={`${sample.sourceRecordId ?? sample.itemName}-${index}`} style={styles.sampleCard}>
                      <View style={styles.sampleHeader}>
                        <AlertTriangle size={icon.row} color={colors.caution} strokeWidth={iconStroke} />
                        <Text style={styles.sampleTitle}>{sample.itemName}</Text>
                      </View>
                      <Text style={styles.sampleBody}>
                        {t("posDepletion.samples.body", {
                          quantity: formatNumber(sample.quantitySold),
                          reason: t(REASON_KEYS[sample.reason])
                        })}
                      </Text>
                    </Card>
                  ))}
                </View>
              </>
            ) : (
              <EmptyState
                title={t("posDepletion.empty.samplesTitle")}
                body={t("posDepletion.empty.samplesBody")}
                illustration={<ListChecks size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
              />
            )}

            <SectionHeader title={t("posDepletion.repair.title")} />
            <View style={styles.list}>
              <RepairRow
                title={t("posDepletion.repair.mappings")}
                body={t("posDepletion.repair.mappingsBody", {
                  count: formatNumber(visible.uniqueUnverifiedItemNames.length)
                })}
                icon={<ListChecks size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/settings/pos-mappings" as never)}
              />
              <RepairRow
                title={t("posDepletion.repair.recipes")}
                body={t("posDepletion.repair.recipesBody", {
                  unmapped: formatNumber(visible.uniqueUnmappedItemNames.length),
                  incompatible: formatNumber(visible.uniqueIncompatibleItemNames.length)
                })}
                icon={<BookOpen size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/settings/recipes" as never)}
              />
              <RepairRow
                title={t("posDepletion.repair.pos")}
                body={t("posDepletion.repair.posBody")}
                icon={<PlugZap size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/settings/pos" as never)}
              />
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function StatChip({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "leaf" | "caution";
}) {
  return (
    <View
      style={[
        styles.statChip,
        tone === "leaf" && styles.statChipLeaf,
        tone === "caution" && styles.statChipCaution
      ]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RepairRow({
  title,
  body,
  icon,
  onPress
}: {
  title: string;
  body: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.repairRow, pressed && styles.pressed]}
    >
      <View style={styles.repairIcon}>{icon}</View>
      <View style={styles.repairCopy}>
        <Text style={styles.repairTitle}>{title}</Text>
        <Text style={styles.repairBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  statChip: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2
  },
  statChipLeaf: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  statChipCaution: {
    backgroundColor: colors.cautionSoft,
    borderColor: colors.caution
  },
  statValue: {
    ...conceptTypography.metricValue,
    color: colors.text
  },
  statLabel: {
    ...conceptTypography.caption,
    color: colors.muted
  },
  card: {
    gap: spacing.sm
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  reasonLabel: {
    ...conceptTypography.body,
    color: colors.text,
    flex: 1
  },
  list: {
    gap: spacing.sm
  },
  sampleCard: {
    gap: spacing.xs
  },
  sampleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  sampleTitle: {
    ...conceptTypography.subtitle,
    color: colors.text,
    flex: 1
  },
  sampleBody: {
    ...conceptTypography.body,
    color: colors.muted
  },
  repairRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  repairIcon: {
    marginTop: 2
  },
  repairCopy: {
    flex: 1,
    gap: 2
  },
  repairTitle: {
    ...conceptTypography.subtitle,
    color: colors.text
  },
  repairBody: {
    ...conceptTypography.body,
    color: colors.muted
  },
  pressed: {
    opacity: 0.88
  }
});

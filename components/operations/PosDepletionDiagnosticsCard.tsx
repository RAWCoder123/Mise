import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { AlertTriangle, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, conceptTypography, icon, iconStroke, radii, spacing } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { PosDepletionDiagnostics } from "../../services/domain/posDepletionDiagnostics";
import { fetchPosDepletionDiagnostics } from "../../services/miseService";
import { captureMiseError } from "../../services/telemetry";

/**
 * Compact attention card for POS and Recipes. Fail-closed: hide on load error
 * rather than claiming a clean depletion path.
 */
export function PosDepletionDiagnosticsCard() {
  const { formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [diagnostics, setDiagnostics] = useState<PosDepletionDiagnostics | null>(null);
  const [loadError, setLoadError] = useState(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const load = useCallback(async () => {
    if (!restaurant) {
      setDiagnostics(null);
      setLoadError(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    try {
      const next = await fetchPosDepletionDiagnostics(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setDiagnostics(next);
      setLoadError(false);
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "pos_depletion_diagnostics_card",
        operation: "load",
        restaurant_id: restaurantId
      });
      setDiagnostics(null);
      setLoadError(true);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    setDiagnostics(null);
    setLoadError(false);
    void load();
  }, [load, restaurant?.id]);

  if (loadError || !diagnostics) return null;

  const needsAttention =
    diagnostics.skippedSaleCount > 0 || diagnostics.partialAttentionSaleCount > 0;
  if (!needsAttention && diagnostics.todaySaleCount === 0) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("posDepletion.card.accessibility")}
      accessibilityHint={t("posDepletion.card.hint")}
      onPress={() => router.push("/more/pos-depletion" as never)}
      style={({ pressed }) => [styles.card, needsAttention ? styles.cardAttention : styles.cardReady, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <AlertTriangle
          size={icon.row}
          color={needsAttention ? colors.caution : colors.success}
          strokeWidth={iconStroke}
        />
        <Text style={styles.title}>
          {needsAttention
            ? t("posDepletion.card.attentionTitle")
            : t("posDepletion.card.readyTitle")}
        </Text>
        <ChevronRight size={icon.row} color={colors.faint} strokeWidth={iconStroke} />
      </View>
      <Text style={styles.body}>
        {needsAttention
          ? t("posDepletion.card.attentionBody", {
              skipped: formatNumber(diagnostics.skippedSaleCount),
              partial: formatNumber(diagnostics.partialAttentionSaleCount)
            })
          : t("posDepletion.card.readyBody", {
              depleting: formatNumber(diagnostics.depletingSaleCount)
            })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs
  },
  cardAttention: {
    backgroundColor: colors.cautionSoft,
    borderColor: colors.caution
  },
  cardReady: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  title: {
    ...conceptTypography.rowTitle,
    color: colors.text,
    flex: 1
  },
  body: {
    ...conceptTypography.body,
    color: colors.muted
  },
  pressed: {
    opacity: 0.9
  }
});

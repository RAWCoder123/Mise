import { useState } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, icon, iconStroke, radii, typography } from "../constants/theme";
import { useLocale } from "../contexts/LocaleContext";
import { presentSupportedRecommendationStatus } from "../services/domain/operationalStatus";
import type { PurchaseRecommendation } from "../types/mise";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

interface RecommendationDecisionRowProps {
  recommendation: PurchaseRecommendation;
  quantity: string;
  onQuantityChange: (value: string) => void;
  onApprove: () => void;
  onDismiss: () => void;
  action?: "approve" | "dismiss";
  error?: string;
  showDivider?: boolean;
  readOnly?: boolean;
}

export function RecommendationDecisionRow({
  recommendation,
  quantity,
  onQuantityChange,
  onApprove,
  onDismiss,
  action,
  error,
  showDivider,
  readOnly = false
}: RecommendationDecisionRowProps) {
  const { formatNumber, t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const busy = Boolean(action);
  const suggestedQuantity = formatNumber(recommendation.recommended_quantity, {
    maximumFractionDigits: 3
  });
  const urgencyLabel =
    recommendation.urgency === "high"
      ? t("orders.recommendation.urgency.high")
      : recommendation.urgency === "medium"
        ? t("orders.recommendation.urgency.medium")
        : t("orders.recommendation.urgency.low");
  const operationalStatus = presentSupportedRecommendationStatus(recommendation.status);
  const operationalLabel =
    operationalStatus === "WaitingForApproval"
      ? t("orders.ops.WaitingForApproval")
      : operationalStatus === "Approved"
        ? t("orders.ops.Approved")
        : operationalStatus === "Sent"
          ? t("orders.ops.Sent")
          : operationalStatus === "Cancelled"
            ? t("orders.ops.Cancelled")
            : t("orders.ops.Unverified");

  return (
    <View style={[styles.row, showDivider && styles.rowDivider, busy && styles.rowBusy]}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.itemName}>{recommendation.item_name}</Text>
          <View style={styles.statusLine}>
            <Badge label={operationalLabel} tone="caution" />
            <Text
              style={[
                styles.urgency,
                recommendation.urgency === "high" && styles.urgencyHigh,
                recommendation.urgency === "medium" && styles.urgencyMedium
              ]}
            >
              {urgencyLabel}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            t(
              expanded
                ? "orders.recommendation.reason.hideAccessibility"
                : "orders.recommendation.reason.showAccessibility",
              { item: recommendation.item_name }
            )
          }
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.whyButton, pressed && styles.pressed]}
        >
          <Text style={styles.whyText}>{t("orders.recommendation.why")}</Text>
          {expanded ? (
            <ChevronUp size={icon.inline} color={colors.text} strokeWidth={iconStroke} />
          ) : (
            <ChevronDown size={icon.inline} color={colors.text} strokeWidth={iconStroke} />
          )}
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.reasonPanel}>
          <Text style={styles.reason}>{recommendation.reason}</Text>
          <Text style={styles.reasonMeta}>
            {t("orders.recommendation.suggested", {
              quantity: suggestedQuantity,
              unit: recommendation.unit
            })}
          </Text>
        </View>
      ) : null}

      <View style={styles.quantityRow}>
        <View style={styles.quantityCopy}>
          <Text style={styles.quantityLabel}>{t("orders.recommendation.quantity")}</Text>
          <Text style={styles.quantityHint}>
            {t("orders.recommendation.suggested", {
              quantity: suggestedQuantity,
              unit: recommendation.unit
            })}
          </Text>
        </View>
        {readOnly ? (
          <View
            accessible
            accessibilityLabel={t("orders.recommendation.quantityReadOnlyAccessibility", {
              item: recommendation.item_name,
              quantity,
              unit: recommendation.unit
            })}
            accessibilityState={{ disabled: true }}
            style={styles.readOnlyQuantity}
          >
            <Text style={styles.readOnlyQuantityValue}>{quantity}</Text>
            <Text style={styles.unit}>{recommendation.unit}</Text>
          </View>
        ) : (
          <View style={[styles.inputWrap, error && styles.inputWrapError]}>
            <TextInput
              accessibilityLabel={t("orders.recommendation.quantityAccessibility", {
                item: recommendation.item_name
              })}
              accessibilityState={{ disabled: busy }}
              value={quantity}
              onChangeText={onQuantityChange}
              keyboardType="decimal-pad"
              editable={!busy}
              selectTextOnFocus
              style={styles.quantityInput}
            />
            <Text style={styles.unit}>{recommendation.unit}</Text>
          </View>
        )}
      </View>

      {!readOnly && error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {!readOnly ? (
        <View style={styles.actions}>
          <Button
            title={t(action === "approve" ? "orders.recommendation.approving" : "orders.recommendation.approve")}
            accessibilityLabel={t("orders.recommendation.approveAccessibility", {
              item: recommendation.item_name
            })}
            accessibilityState={{ disabled: busy }}
            icon={<Check size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
            onPress={onApprove}
            disabled={busy}
            style={styles.actionButton}
          />
          <Button
            title={t(action === "dismiss" ? "orders.recommendation.dismissing" : "orders.recommendation.dismiss")}
            accessibilityLabel={t("orders.recommendation.dismissAccessibility", {
              item: recommendation.item_name
            })}
            accessibilityState={{ disabled: busy }}
            variant="secondary"
            icon={<X size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
            onPress={onDismiss}
            disabled={busy}
            style={styles.actionButton}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: colors.surface
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  rowBusy: {
    opacity: 0.66
  },
  heading: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headingCopy: {
    flex: 1,
    minWidth: 0
  },
  statusLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 4
  },
  itemName: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 16,
    lineHeight: 21
  },
  urgency: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 0
  },
  urgencyHigh: {
    color: colors.warning,
    fontWeight: "600"
  },
  urgencyMedium: {
    color: colors.caution,
    fontWeight: "600"
  },
  whyButton: {
    minWidth: 64,
    minHeight: 44,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  whyText: {
    color: colors.text,
    ...typography.caption
  },
  pressed: {
    opacity: 0.62
  },
  reasonPanel: {
    borderLeftWidth: 2,
    borderLeftColor: colors.caution,
    paddingLeft: 10,
    gap: 3
  },
  reason: {
    color: colors.text,
    ...typography.body
  },
  reasonMeta: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "500"
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  quantityCopy: {
    flex: 1,
    minWidth: 0
  },
  quantityLabel: {
    color: colors.text,
    ...typography.caption
  },
  quantityHint: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 1
  },
  inputWrap: {
    width: 142,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6
  },
  inputWrapError: {
    borderColor: colors.danger
  },
  readOnlyQuantity: {
    width: 142,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6
  },
  readOnlyQuantityValue: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 18,
    lineHeight: 22
  },
  quantityInput: {
    width: 64,
    minHeight: 44,
    padding: 0,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "right"
  },
  unit: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "500"
  },
  error: {
    color: colors.danger,
    ...typography.caption,
    fontWeight: "600"
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    flex: 1
  }
});

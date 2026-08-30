import { CheckCircle2, LockKeyhole, Send } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, conceptTypography, icon, iconStroke, radii } from "../constants/theme";
import { useLocale } from "../contexts/LocaleContext";
import type { MessageKey } from "../i18n/catalog";
import { presentSupportedSupplierOrderStatus } from "../services/domain/operationalStatus";
import {
  supplierOrderLaneDeliveryAttentionStatus,
  type SupplierOrderDeliveryEvidence
} from "../services/domain/supplierReliability";
import type { SupplierOrder } from "../types/mise";
import { buildSupplierDraftPresentation } from "../utils/orderPresentation";
import { Badge, type BadgeTone } from "./ui/Badge";
import { Button } from "./ui/Button";

interface SupplierDraftCardProps {
  order: SupplierOrder;
  onCopy: () => void;
  onOpen: () => void;
  onSend?: () => void;
  onMarkSent?: () => void;
  showSend?: boolean;
  canSend?: boolean;
  canMarkSent?: boolean;
  sendLabel?: string;
  busyLabel?: string;
  sendAccessibilityLabel?: string;
  sendDisabledHint?: string;
  busy?: boolean;
  /** Latest receipt evidence; attention statuses surface on sent/history cards. */
  deliveryEvidence?: SupplierOrderDeliveryEvidence | null;
}

export function SupplierDraftCard({
  order,
  onCopy,
  onOpen,
  onSend,
  onMarkSent,
  showSend,
  canSend,
  canMarkSent = true,
  sendLabel,
  busyLabel,
  sendAccessibilityLabel,
  sendDisabledHint,
  busy,
  deliveryEvidence
}: SupplierDraftCardProps) {
  const { formatCurrency, formatDate, formatNumber, t } = useLocale();
  const isDraft = order.status === "draft";
  const sendAction = onSend ?? onMarkSent;
  const sendIsAvailable = canSend ?? canMarkSent;
  const sendIsVisible = showSend ?? sendIsAvailable;
  const sendIsDisabled = Boolean(busy || !sendIsAvailable);
  const resolvedSendLabel = sendLabel ?? t("orders.card.action.markSent");
  const resolvedBusyLabel = busyLabel ?? t("orders.card.action.markingSent");
  const presentation = buildSupplierDraftPresentation(order);
  const operationalStatus = presentSupportedSupplierOrderStatus(order.status);
  const orderStatusLabel =
    operationalStatus === "DraftedByMise"
      ? t("orders.card.status.draft")
      : operationalStatus === "Sent"
        ? t("orders.ops.Sent")
        : t("orders.ops.Received");
  const attentionStatus = supplierOrderLaneDeliveryAttentionStatus(deliveryEvidence);
  const attentionLabel = attentionStatus
    ? t(`orders.detail.deliveryEvidence.status.${attentionStatus}` as MessageKey)
    : null;
  const statusLabel = attentionLabel ?? orderStatusLabel;
  const statusTone: BadgeTone = attentionStatus
    ? deliveryEvidenceTone(attentionStatus)
    : order.status === "sent"
      ? "success"
      : "neutral";
  const deliveryLabel = order.delivery_date
    ? formatDate(`${order.delivery_date}T12:00:00.000Z`, {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      })
    : t("orders.card.delivery.pending");
  const totalLabel = presentation.estimatedTotalCents > 0
    ? formatCurrency(presentation.estimatedTotalCents / 100)
    : null;
  const showSendButton = Boolean(isDraft && sendIsVisible && sendAction);
  const openAccessibilityLabel = attentionLabel
    ? t("orders.card.openWithDeliveryAccessibility", {
        supplier: order.supplier_name,
        status: orderStatusLabel,
        delivery: attentionLabel
      })
    : t("orders.card.openAccessibility", {
        supplier: order.supplier_name,
        status: statusLabel
      });

  return (
    <View style={[styles.card, isDraft && styles.cardDraft]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={openAccessibilityLabel}
        onPress={onOpen}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.supplierLine}>
          <Text style={styles.supplierName} numberOfLines={1}>
            {order.supplier_name}
          </Text>
          <Badge label={statusLabel} tone={statusTone} uppercase />
        </View>
        <View style={styles.metaLine}>
          <Text style={styles.status}>{deliveryLabel}</Text>
          {totalLabel ? <Text style={styles.total}>{totalLabel}</Text> : null}
        </View>
        {attentionStatus && deliveryEvidence && deliveryEvidence.discrepancyLineCount > 0 ? (
          <Text style={styles.attentionMeta} numberOfLines={1}>
            {t(
              deliveryEvidence.discrepancyLineCount === 1
                ? "orders.card.deliveryAttention.one"
                : "orders.card.deliveryAttention.other",
              { count: formatNumber(deliveryEvidence.discrepancyLineCount) }
            )}
          </Text>
        ) : null}
      </Pressable>

      {presentation.lines.length > 0 ? (
        <View style={styles.lines}>
          <Text style={styles.linesLabel}>
            {t(
              presentation.itemCount === 1
                ? "orders.card.recommended.one"
                : "orders.card.recommended.other",
              { count: formatNumber(presentation.itemCount) }
            )}
          </Text>
          {presentation.lines.map((line, index) => (
            <View
              key={line.itemName + "-" + line.quantityLabel + "-" + index}
              style={styles.line}
            >
              <Text style={styles.lineName} numberOfLines={1}>
                {line.itemName}
              </Text>
              <Text style={styles.lineQuantity} numberOfLines={1}>
                {line.quantityLabel}
              </Text>
              <Text style={styles.linePrice} numberOfLines={1}>
                {line.estimatedCents > 0 ? formatCurrency(line.estimatedCents / 100) : "—"}
              </Text>
            </View>
          ))}
          {presentation.hiddenLineCount > 0 ? (
            <Text style={styles.moreLines}>
              {t(
                presentation.hiddenLineCount === 1
                  ? "orders.card.more.one"
                  : "orders.card.more.other",
                { count: formatNumber(presentation.hiddenLineCount) }
              )}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.noteReady}>{t("orders.card.noteReady")}</Text>
      )}

      <View style={styles.actions}>
        <Button
          title={isDraft ? t("orders.card.action.editDraft") : t("orders.card.action.open")}
          accessibilityLabel={openAccessibilityLabel}
          variant="secondary"
          onPress={onOpen}
          style={styles.actionButton}
        />
        {showSendButton && sendIsAvailable ? (
          <Button
            title={busy ? resolvedBusyLabel : resolvedSendLabel}
            accessibilityLabel={sendAccessibilityLabel ?? t("orders.card.markSentAccessibility", {
              supplier: order.supplier_name
            })}
            accessibilityHint={!sendIsAvailable ? sendDisabledHint : undefined}
            accessibilityState={{ disabled: sendIsDisabled }}
            variant={busy || sendIsAvailable ? "primary" : "soft"}
            icon={
              busy ? (
                <CheckCircle2 size={icon.inline} color={colors.surface} strokeWidth={iconStroke} />
              ) : !sendIsAvailable ? (
                <LockKeyhole size={icon.inline} color={colors.accentDark} strokeWidth={iconStroke} />
              ) : (
                <Send size={icon.inline} color={colors.surface} strokeWidth={iconStroke} />
              )
            }
            onPress={sendAction}
            disabled={sendIsDisabled}
            style={styles.actionButton}
          />
        ) : (
          <Button
            title={isDraft ? t("orders.card.action.review") : t("orders.card.copy")}
            accessibilityLabel={
              isDraft
                ? t("orders.card.reviewAccessibility", { supplier: order.supplier_name })
                : t("orders.card.copyAccessibility", { supplier: order.supplier_name })
            }
            variant={isDraft ? "primary" : "soft"}
            onPress={isDraft ? onOpen : onCopy}
            style={styles.actionButton}
          />
        )}
      </View>
    </View>
  );
}

function deliveryEvidenceTone(
  status: Extract<
    NonNullable<ReturnType<typeof supplierOrderLaneDeliveryAttentionStatus>>,
    string
  >
): BadgeTone {
  if (status === "failed" || status === "discrepancy") return "danger";
  return "warning";
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 8
  },
  cardDraft: {
    borderColor: colors.redBorder
  },
  header: {
    minHeight: 40,
    gap: 3
  },
  pressed: {
    opacity: 0.66
  },
  supplierLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8
  },
  supplierName: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    ...conceptTypography.cardTitle
  },
  status: {
    flex: 1,
    color: colors.muted,
    ...conceptTypography.subtitle,
    marginTop: 1
  },
  total: {
    color: colors.text,
    ...conceptTypography.metricValue,
    textAlign: "right"
  },
  attentionMeta: {
    color: colors.caution,
    ...conceptTypography.caption,
    marginTop: 1
  },
  lines: {
    gap: 2
  },
  linesLabel: {
    color: colors.text,
    ...conceptTypography.caption,
    marginBottom: 2
  },
  line: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  lineName: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    ...conceptTypography.body
  },
  lineQuantity: {
    width: 58,
    color: colors.muted,
    ...conceptTypography.caption,
    textAlign: "right"
  },
  linePrice: {
    width: 56,
    color: colors.text,
    ...conceptTypography.caption,
    textAlign: "right"
  },
  moreLines: {
    color: colors.muted,
    ...conceptTypography.caption,
    paddingTop: 2
  },
  noteReady: {
    color: colors.muted,
    ...conceptTypography.body
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 2
  },
  actionButton: {
    flex: 1,
    minHeight: 36
  },
});

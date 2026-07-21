import { CheckCircle2, Copy, LockKeyhole, Send } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, typography } from "../constants/theme";
import { useLocale } from "../contexts/LocaleContext";
import type { SupplierOrder } from "../types/mise";
import { buildSupplierDraftPresentation } from "../utils/orderPresentation";
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
  busy
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
  const statusLabel =
    order.status === "draft"
      ? t("orders.card.status.draft")
      : order.status === "sent"
        ? t("orders.card.status.sent")
        : t("orders.card.status.completed");
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

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("orders.card.openAccessibility", {
          supplier: order.supplier_name,
          status: statusLabel
        })}
        onPress={onOpen}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={[styles.supplierSeal, !isDraft && styles.supplierSealSent]}>
          {isDraft ? (
            <Text style={styles.supplierSealText}>{t("orders.card.fresh")}</Text>
          ) : (
            <CheckCircle2 size={20} color={colors.surface} strokeWidth={2.25} />
          )}
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.supplierName} numberOfLines={1}>
            {order.supplier_name}
          </Text>
          <Text style={[styles.status, !isDraft && styles.statusSent]}>
            {t("orders.card.statusDate", { status: statusLabel, date: deliveryLabel })}
          </Text>
        </View>
        {totalLabel ? <Text style={styles.total}>{totalLabel}</Text> : null}
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
        {isDraft && sendIsVisible && sendAction ? (
          <Button
            title={busy ? resolvedBusyLabel : resolvedSendLabel}
            accessibilityLabel={sendAccessibilityLabel ?? t("orders.card.markSentAccessibility", {
              supplier: order.supplier_name
            })}
            accessibilityHint={!sendIsAvailable ? sendDisabledHint : undefined}
            accessibilityState={{ disabled: sendIsDisabled }}
            icon={
              busy ? (
                <CheckCircle2 size={17} color={colors.surface} strokeWidth={2.25} />
              ) : !sendIsAvailable ? (
                <LockKeyhole size={16} color={colors.surface} strokeWidth={2.25} />
              ) : (
                <Send size={17} color={colors.surface} strokeWidth={2.25} />
              )
            }
            onPress={sendAction}
            disabled={sendIsDisabled}
            style={styles.actionButton}
          />
        ) : null}
        <Button
          title={t("orders.card.copy")}
          accessibilityLabel={t("orders.card.copyAccessibility", { supplier: order.supplier_name })}
          variant="secondary"
          icon={<Copy size={17} color={colors.text} strokeWidth={2.25} />}
          onPress={onCopy}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 10
  },
  header: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  pressed: {
    opacity: 0.66
  },
  supplierSeal: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center"
  },
  supplierSealSent: {
    backgroundColor: colors.success
  },
  supplierSealText: {
    color: colors.surface,
    fontFamily: typography.families.bold,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0.4
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  supplierName: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 15,
    lineHeight: 20
  },
  status: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 1
  },
  statusSent: {
    color: colors.success,
    fontWeight: "600"
  },
  total: {
    color: colors.text,
    ...typography.caption,
    fontSize: 12
  },
  lines: {
    gap: 1
  },
  linesLabel: {
    color: colors.text,
    ...typography.caption,
    marginBottom: 5
  },
  line: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  lineName: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 11.5,
    lineHeight: 16
  },
  lineQuantity: {
    width: 82,
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "right"
  },
  linePrice: {
    width: 54,
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "right"
  },
  moreLines: {
    color: colors.muted,
    ...typography.caption,
    paddingTop: 10
  },
  noteReady: {
    color: colors.muted,
    ...typography.body
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    flex: 1
  }
});

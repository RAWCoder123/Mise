import { useCallback, useEffect, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle2, Copy, FileText, Save, Send } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  fetchEmailConnectionState,
  fetchSupplierOrder,
  isGmailIntegrationError,
  sendSupplierOrderEmail,
  updateSupplierOrder
} from "../../services/miseService";
import { canDeleteRestaurantData, canManageRestaurantData } from "../../services/tenantAccess";
import { SUPPLIER_NOTE_MAX_CHARACTERS } from "../../services/miseValidation";
import type { RestaurantEmailConnection, SupplierOrder } from "../../types/mise";

type Translate = ReturnType<typeof useLocale>["t"];

interface OrderNotice {
  title: string;
  message: string;
  tone: StatusNoticeTone;
  recovery?: "gmail" | "supplier";
}

export default function OrderDraftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { formatDate, formatNumber, t } = useLocale();
  const { memberships, restaurant, usingLocalDemo } = useMiseSession();
  const [order, setOrder] = useState<SupplierOrder | null>(null);
  const [emailConnection, setEmailConnection] = useState<RestaurantEmailConnection | null>(null);
  const [operatorNote, setOperatorNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<OrderNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const actionLockRef = useRef(false);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const load = useCallback(async (showLoading = true) => {
    if (!restaurant || !id) {
      setLoading(false);
      setNotice({
        title: t("orders.detail.noRestaurant.title"),
        message: t("orders.detail.noRestaurant.body"),
        tone: "warning"
      });
      return;
    }

    const restaurantId = restaurant.id;
    const orderId = id;
    const requestId = ++requestIdRef.current;
    if (showLoading) setLoading(true);
    setNotice(null);
    try {
      const [nextOrder, nextEmailConnection] = await Promise.all([
        fetchSupplierOrder(restaurantId, orderId),
        fetchEmailConnectionState(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEmailConnection && nextEmailConnection.restaurant_id !== restaurantId) {
        throw new Error(t("orders.detail.connectionMismatch"));
      }
      setOrder(nextOrder);
      setEmailConnection(nextEmailConnection);
      setLoadedRestaurantId(restaurantId);
      setOperatorNote(nextOrder.operator_note ?? "");
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOrder(null);
      setNotice({
        title: t("orders.detail.load.title"),
        message:
          error instanceof Error && error.message === t("orders.detail.connectionMismatch")
            ? error.message
            : t("orders.detail.load.body"),
        tone: "danger"
      });
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [id, restaurant?.id, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    actionLockRef.current = false;
    setLoadedRestaurantId(null);
    setOrder(null);
    setEmailConnection(null);
    setOperatorNote("");
    setBusy(false);
    setNotice(null);
    setLoading(Boolean(restaurant && id));
    void load();
  }, [id, load, restaurant?.id]);

  async function persistNote(): Promise<SupplierOrder> {
    if (!restaurant || !order) throw new Error(t("orders.detail.unavailable"));
    if (!canManage) return order;
    if (order.status !== "draft") return order;
    if (operatorNote.trim() === (order.operator_note ?? "").trim()) return order;

    const updated = await updateSupplierOrder(restaurant.id, order.id, {
      operator_note: operatorNote.trim() || null
    });
    if (activeRestaurantIdRef.current === restaurant.id) {
      setOrder(updated);
      setOperatorNote(updated.operator_note ?? "");
    }
    return updated;
  }

  async function saveNote() {
    if (!restaurant || !order || actionLockRef.current) return;
    if (!canManage) {
      setNotice(viewOnlyNotice(t));
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await persistNote();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        title: t("orders.detail.notice.noteSavedTitle"),
        message: t("orders.detail.notice.noteSavedBody"),
        tone: "success"
      });
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice({
          title: t("orders.detail.notice.noteSaveFailedTitle"),
          message: t("orders.detail.notice.noteSaveFailedBody"),
          tone: "danger"
        });
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  async function copyOrder() {
    if (!restaurant || !order || actionLockRef.current) return;
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const savedOrder = await persistNote();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await Clipboard.setStringAsync(savedOrder.order_message);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        title: t("orders.detail.notice.copiedTitle"),
        message: t("orders.detail.notice.copiedBody"),
        tone: "success"
      });
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice({
          title: t("orders.detail.notice.copyFailedTitle"),
          message: t("orders.detail.notice.copyFailedBody"),
          tone: "danger"
        });
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  async function sendOrder() {
    if (!restaurant || !order || order.status !== "draft" || actionLockRef.current) return;
    if (!canManage) {
      setNotice(viewOnlyNotice(t));
      return;
    }
    if (emailConnection?.status !== "connected") {
      setNotice(gmailConnectionRequiredNotice(emailConnection?.status ?? "not_connected", t));
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const savedOrder = await persistNote();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const result = await sendSupplierOrderEmail(restaurantId, savedOrder.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setOrder(result.order);
      setOperatorNote(result.order.operator_note ?? "");
      setNotice({
        title: usingLocalDemo
          ? t("orders.detail.notice.demoSentTitle")
          : result.outcome === "already_sent"
            ? t("orders.detail.notice.alreadySentTitle")
            : t("orders.detail.notice.acceptedTitle"),
        message: usingLocalDemo
          ? t("orders.detail.notice.demoSentBody")
          : t("orders.detail.notice.acceptedBody"),
        tone: "success"
      });
    } catch (error) {
      if (activeRestaurantIdRef.current === restaurantId) {
        await load(false);
        if (activeRestaurantIdRef.current === restaurantId) setNotice(orderSendErrorNotice(error, t));
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  const visibleOrder = loadedRestaurantId === restaurant?.id ? order : null;
  const isDraft = visibleOrder?.status === "draft";
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const canManageGmail = canDeleteRestaurantData(memberships, restaurant?.id);
  const canEditDraft = Boolean(isDraft && canManage);
  const visibleEmailConnection = loadedRestaurantId === restaurant?.id ? emailConnection : null;
  const gmailReady = visibleEmailConnection?.status === "connected";
  const generatedMessage = visibleOrder ? generatedOrderMessage(visibleOrder) : "";

  function goBackToOrders() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/orders");
  }

  return (
    <Screen
      title={visibleOrder?.supplier_name ?? t("orders.detail.title")}
      subtitle={
        visibleOrder
          ? (canEditDraft
              ? t("orders.detail.subtitle.editable")
              : isDraft
                ? t("orders.detail.subtitle.readOnlyDraft")
                : t("orders.detail.subtitle.sent"))
          : t("orders.detail.subtitle.default")
      }
      loading={loading}
      keyboardAware
      action={
        <ActionIcon
          accessibilityLabel={t("orders.detail.back")}
          onPress={goBackToOrders}
        >
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.25} />
        </ActionIcon>
      }
    >
      {visibleOrder ? (
        <View style={styles.stack}>
          {!canManage ? (
            <StatusNotice
              title={t("orders.detail.viewOnly.title")}
              message={t("orders.detail.viewOnly.body")}
            />
          ) : null}

          {canEditDraft && !gmailReady ? (
            <StatusNotice
              tone="warning"
              title={visibleEmailConnection?.status === "needs_reauth"
                ? t("orders.detail.connection.reconnectTitle")
                : t("orders.detail.connection.connectTitle")}
              message={
                canManageGmail
                  ? t("orders.detail.connection.manageBody")
                  : t("orders.detail.connection.managerBody")
              }
              actionLabel={canManageGmail
                ? (visibleEmailConnection?.status === "needs_reauth"
                    ? t("orders.detail.gmail.reconnect")
                    : t("orders.detail.gmail.connect"))
                : undefined}
              onAction={canManageGmail ? () => router.push("/settings/gmail" as never) : undefined}
            />
          ) : null}

          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, !isDraft && styles.statusIconSent]}>
              {isDraft ? (
                <FileText size={20} color={colors.text} strokeWidth={2.25} />
              ) : (
                <CheckCircle2 size={20} color={colors.success} strokeWidth={2.25} />
              )}
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>
                {isDraft ? t("orders.detail.status.draft") : t("orders.detail.status.sent")}
              </Text>
              <Text style={styles.statusMeta}>
                {visibleOrder.delivery_date
                  ? t("orders.detail.delivery.date", {
                      date: formatDate(`${visibleOrder.delivery_date}T12:00:00.000Z`, {
                        dateStyle: "medium",
                        timeZone: "UTC"
                      })
                    })
                  : t("orders.detail.delivery.none")}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("orders.detail.generated.title")}</Text>
            <Text style={styles.sectionBody}>
              {t("orders.detail.generated.body")}
            </Text>
            <View style={styles.messagePanel}>
              <Text selectable style={styles.orderMessage}>
                {generatedMessage}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("orders.detail.note.title")}</Text>
            <Text style={styles.sectionBody}>
              {t("orders.detail.note.body")}
            </Text>
            {canEditDraft ? (
              <TextInput
                accessibilityLabel={t("orders.detail.note.label")}
                accessibilityHint={t("orders.detail.note.hint", {
                  count: formatNumber(SUPPLIER_NOTE_MAX_CHARACTERS)
                })}
                accessibilityState={{ disabled: busy }}
                value={operatorNote}
                onChangeText={setOperatorNote}
                maxLength={SUPPLIER_NOTE_MAX_CHARACTERS}
                editable={!busy}
                multiline
                textAlignVertical="top"
                placeholder={t("orders.detail.note.placeholder")}
                placeholderTextColor={colors.faint}
                style={styles.noteInput}
              />
            ) : (
              <View style={styles.sentNote}>
                <Text style={styles.sentNoteText}>
                  {visibleOrder.operator_note || t("orders.detail.note.none")}
                </Text>
              </View>
            )}
          </View>

          {notice ? (
            <StatusNotice
              tone={notice.tone}
              title={notice.title}
              message={notice.message}
              actionLabel={notice.recovery === "gmail"
                ? t("orders.detail.recovery.gmail")
                : notice.recovery === "supplier"
                  ? t("orders.detail.recovery.supplier")
                  : undefined}
              onAction={
                notice.recovery === "gmail"
                  ? () => router.push("/settings/gmail" as never)
                  : notice.recovery === "supplier"
                    ? () => router.push("/settings/suppliers" as never)
                    : undefined
              }
            />
          ) : null}

          <View style={styles.actions}>
            <Button
              title={t("orders.detail.action.copy")}
              accessibilityLabel={t("orders.detail.action.copyAccessibility", {
                supplier: visibleOrder.supplier_name
              })}
              variant="secondary"
              icon={<Copy size={17} color={colors.text} strokeWidth={2.25} />}
              onPress={() => void copyOrder()}
              disabled={busy}
              style={styles.actionButton}
            />
            {canEditDraft ? (
              <Button
                title={busy ? t("orders.detail.action.saving") : t("orders.detail.action.save")}
                accessibilityLabel={t("orders.detail.action.saveAccessibility")}
                variant="secondary"
                icon={<Save size={17} color={colors.text} strokeWidth={2.25} />}
                onPress={() => void saveNote()}
                disabled={busy}
                style={styles.actionButton}
              />
            ) : null}
          </View>

          {canEditDraft && gmailReady ? (
            <Button
              title={busy
                ? (usingLocalDemo
                    ? t("orders.detail.action.simulating")
                    : t("orders.detail.gmail.sending"))
                : usingLocalDemo
                  ? t("orders.detail.action.simulate")
                  : t("orders.detail.gmail.send")}
              accessibilityLabel={usingLocalDemo
                ? t("orders.detail.action.simulateAccessibility", { supplier: visibleOrder.supplier_name })
                : t("orders.detail.action.sendAccessibility", { supplier: visibleOrder.supplier_name })}
              icon={<Send size={17} color={colors.surface} strokeWidth={2.25} />}
              onPress={() => void sendOrder()}
              disabled={busy}
              fullWidth
            />
          ) : null}
        </View>
      ) : (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice?.message ?? t("orders.detail.notFound")}
        </Text>
      )}
    </Screen>
  );
}

function viewOnlyNotice(t: Translate): OrderNotice {
  return {
    title: t("orders.detail.viewOnly.title"),
    message: t("orders.detail.viewOnly.actionBody"),
    tone: "neutral"
  };
}

function gmailConnectionRequiredNotice(
  status: RestaurantEmailConnection["status"],
  t: Translate
): OrderNotice {
  return {
    title: status === "needs_reauth"
      ? t("orders.detail.connection.reconnectTitle")
      : t("orders.detail.connection.connectTitle"),
    message: t("orders.detail.gmail.notConnected"),
    tone: "warning",
    recovery: "gmail"
  };
}

function orderSendErrorNotice(error: unknown, t: Translate): OrderNotice {
  if (!isGmailIntegrationError(error)) {
    return {
      title: t("orders.detail.error.sendTitle"),
      message: t("orders.detail.error.sendBody"),
      tone: "danger"
    };
  }
  if (error.status === "gmail_not_connected" || error.status === "needs_reauth") {
    return {
      title: error.status === "needs_reauth"
        ? t("orders.detail.connection.reconnectTitle")
        : t("orders.detail.connection.connectTitle"),
      message: t("orders.detail.gmail.notConnected"),
      tone: "warning",
      recovery: "gmail"
    };
  }
  if (error.status === "supplier_email_missing" || error.status === "supplier_email_invalid") {
    return {
      title: t("orders.detail.error.supplierEmailTitle"),
      message: t("orders.detail.error.supplierEmailBody"),
      tone: "warning",
      recovery: "supplier"
    };
  }
  if (error.status === "delivery_requires_review" || error.status === "in_progress") {
    return {
      title: t("settings.gmail.error.reviewTitle"),
      message: t("orders.detail.gmail.review"),
      tone: "warning"
    };
  }
  if (error.status === "live_sending_disabled" || error.status === "server_configuration_missing") {
    return {
      title: t("orders.detail.error.sendingDisabledTitle"),
      message: t("orders.detail.error.sendingDisabledBody"),
      tone: "warning"
    };
  }
  return {
    title: t("orders.detail.error.sendTitle"),
    message: t("orders.detail.gmail.failed"),
    tone: "danger"
  };
}

function generatedOrderMessage(order: SupplierOrder) {
  const note = order.operator_note?.trim();
  if (!note) return order.order_message;
  const suffix = "\n\nNotes:\n" + note;
  return order.order_message.endsWith(suffix)
    ? order.order_message.slice(0, -suffix.length)
    : order.order_message;
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
    paddingBottom: 24
  },
  statusRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center"
  },
  statusIconSent: {
    backgroundColor: colors.successSoft
  },
  statusCopy: {
    flex: 1,
    minWidth: 0
  },
  statusTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  statusMeta: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 2
  },
  section: {
    gap: 6
  },
  sectionTitle: {
    color: colors.text,
    ...typography.sectionTitle,
    fontSize: 18,
    lineHeight: 23
  },
  sectionBody: {
    color: colors.muted,
    ...typography.body
  },
  messagePanel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    marginTop: 6
  },
  orderMessage: {
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400"
  },
  noteInput: {
    minHeight: 112,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 21,
    padding: 13,
    marginTop: 6
  },
  sentNote: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWarm,
    padding: 13,
    marginTop: 6,
    justifyContent: "center"
  },
  sentNoteText: {
    color: colors.muted,
    ...typography.body
  },
  notice: {
    color: colors.text,
    ...typography.caption,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: 10
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    flex: 1
  }
});

import { useCallback, useEffect, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle2, Copy, FileText, Save, Send } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  fetchEmailConnectionState,
  fetchSupplierSendAction,
  fetchSupplierOrderOperationalDetail,
  fetchSupplierEmailDeliveryReview,
  isGmailIntegrationError,
  approveSupplierSendContent,
  prepareSupplierEmailPayload,
  receiveSupplierOrderDelivery,
  resolveSupplierEmailDelivery,
  sendSupplierOrderEmail,
  updateSupplierOrder
} from "../../services/miseService";
import type {
  SupplierDeliveryStatus,
  SupplierOrderDeliveryEvidence
} from "../../services/domain/supplierReliability";
import type { MiseAction } from "../../services/domain/miseActions";
import {
  supplierEmailDeliveryRequiresReview,
  type SupplierEmailDeliveryReview
} from "../../services/domain/supplierEmailDeliveryReview";
import { isSupplierSendVerificationRace } from "../../services/domain/supplierSendErrors";
import {
  PURCHASE_AUTHORITY_BLOCKER_CODES,
  purchaseAuthorityBlockerMessageKey,
  type PurchaseAuthorityBlockerCode
} from "../../services/domain/purchaseAuthority";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canDeleteRestaurantData, canManageRestaurantData } from "../../services/tenantAccess";
import { SUPPLIER_NOTE_MAX_CHARACTERS } from "../../services/miseValidation";
import type {
  RestaurantEmailConnection,
  SupplierEmailPayload,
  SupplierOrder
} from "../../types/mise";

type Translate = ReturnType<typeof useLocale>["t"];

interface OrderNotice {
  title: string;
  message: string;
  tone: StatusNoticeTone;
  recovery?: "gmail" | "supplier" | "retry";
}

export default function OrderDraftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { formatDate, formatNumber, t } = useLocale();
  const { memberships, restaurant, usingLocalDemo } = useMiseSession();
  const [order, setOrder] = useState<SupplierOrder | null>(null);
  const [emailConnection, setEmailConnection] = useState<RestaurantEmailConnection | null>(null);
  const [emailPayload, setEmailPayload] = useState<SupplierEmailPayload | null>(null);
  const [supplierSendAction, setSupplierSendAction] = useState<MiseAction | null>(null);
  const [deliveryReview, setDeliveryReview] = useState<SupplierEmailDeliveryReview | null>(null);
  const [deliveryEvidence, setDeliveryEvidence] = useState<SupplierOrderDeliveryEvidence[]>([]);
  const [operatorNote, setOperatorNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<OrderNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [hubLoadError, setHubLoadError] = useState(false);
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
    setHubLoadError(false);
    try {
      const [nextDetail, nextEmailConnection, nextEmailPayload, nextSendAction, nextDeliveryReview] =
        await Promise.all([
          fetchSupplierOrderOperationalDetail(restaurantId, orderId),
          fetchEmailConnectionState(restaurantId),
          prepareSupplierEmailPayload(restaurantId, orderId),
          fetchSupplierSendAction(restaurantId, orderId),
          fetchSupplierEmailDeliveryReview(restaurantId, orderId).catch(() => null)
        ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEmailConnection && nextEmailConnection.restaurant_id !== restaurantId) {
        throw new Error(t("orders.detail.connectionMismatch"));
      }
      if (nextEmailPayload.orderId !== orderId) {
        throw new Error(t("orders.detail.orderMismatch"));
      }
      if (nextEmailPayload.supplierId !== nextDetail.order.supplier_id) {
        throw new Error(t("orders.detail.orderMismatch"));
      }
      setOrder(nextDetail.order);
      setDeliveryEvidence(nextDetail.deliveryEvidence);
      setEmailConnection(nextEmailConnection);
      setEmailPayload(nextEmailPayload);
      setSupplierSendAction(nextSendAction);
      setDeliveryReview(nextDeliveryReview);
      setLoadedRestaurantId(restaurantId);
      setHubLoadError(false);
      setOperatorNote(nextDetail.order.operator_note ?? "");
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOrder(null);
      setDeliveryEvidence([]);
      setEmailPayload(null);
      setSupplierSendAction(null);
      setDeliveryReview(null);
      setHubLoadError(true);
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
    setHubLoadError(false);
    setOrder(null);
    setDeliveryEvidence([]);
    setEmailConnection(null);
    setEmailPayload(null);
    setSupplierSendAction(null);
    setDeliveryReview(null);
    setOperatorNote("");
    setBusy(false);
    setNotice(null);
    setLoading(Boolean(restaurant && id));
    void load();
  }, [id, load, restaurant?.id]);

  async function refreshEmailPreview(
    restaurantId: string,
    orderId: string
  ): Promise<SupplierEmailPayload> {
    const preview = await prepareSupplierEmailPayload(restaurantId, orderId);
    if (preview.orderId !== orderId) {
      throw new Error(t("orders.detail.orderMismatch"));
    }
    if (activeRestaurantIdRef.current === restaurantId) setEmailPayload(preview);
    return preview;
  }

  async function persistNote(): Promise<{
    order: SupplierOrder;
    preview: SupplierEmailPayload;
  }> {
    if (!restaurant || !order) throw new Error(t("orders.detail.unavailable"));
    let updated = order;
    if (
      actionsEditable &&
      order.status === "draft" &&
      operatorNote.trim() !== (order.operator_note ?? "").trim()
    ) {
      updated = await updateSupplierOrder(restaurant.id, order.id, {
        operator_note: operatorNote.trim() || null
      });
    }
    const preview = await refreshEmailPreview(restaurant.id, updated.id);
    if (activeRestaurantIdRef.current === restaurant.id) {
      setOrder(updated);
      setOperatorNote(updated.operator_note ?? "");
    }
    return { order: updated, preview };
  }

  async function saveNote() {
    if (!restaurant || !order || actionLockRef.current) return;
    if (!actionsEditable) {
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
      const { order: savedOrder } = await persistNote();
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
    if (!actionsEditable) {
      setNotice(viewOnlyNotice(t));
      return;
    }
    if (emailConnection?.status !== "connected") {
      setNotice(gmailConnectionRequiredNotice(emailConnection?.status ?? "not_connected", t));
      return;
    }
    if (!emailPayload?.ready || !emailPayload.contentFingerprint) {
      setNotice(supplierSendBlockerNotice(emailPayload?.blockerCodes ?? [], t));
      return;
    }
    if (!supplierSendAction || !canApproveSupplierSendAction(supplierSendAction)) {
      setNotice({
        title: t("orders.detail.approvalMissing.title"),
        message: t("orders.detail.approvalMissing.body"),
        tone: "warning"
      });
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const reviewedPayload = emailPayload;
      const { order: savedOrder, preview: refreshedPayload } = await persistNote();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      if (!sameReviewedSendContent(reviewedPayload, refreshedPayload)) {
        setNotice({
          title: t("orders.detail.review.changedTitle"),
          message: t("orders.detail.review.changedBody"),
          tone: "warning"
        });
        return;
      }
      if (!refreshedPayload.ready || !refreshedPayload.contentFingerprint) {
        setNotice(supplierSendBlockerNotice(refreshedPayload.blockerCodes, t));
        return;
      }
      if (!refreshedPayload.from || !refreshedPayload.to) {
        throw new Error(t("orders.detail.approvalMissing.body"));
      }
      const approval = await approveSupplierSendContent(
        restaurantId,
        supplierSendAction.id,
        savedOrder.id,
        refreshedPayload.contentFingerprint
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      if (
        approval.outcome === "send_content_changed" ||
        approval.outcome === "send_content_unapproved"
      ) {
        const approvalBlockers = [approval.outcome, ...approval.blockerCodes];
        await refreshEmailPreview(restaurantId, savedOrder.id);
        if (activeRestaurantIdRef.current !== restaurantId) return;
        setNotice(supplierSendBlockerNotice(approvalBlockers, t));
        return;
      }
      if (approval.outcome !== "applied" && approval.outcome !== "already_applied") {
        setNotice(supplierSendBlockerNotice(
          [approval.outcome, ...approval.blockerCodes],
          t
        ));
        return;
      }
      const approvedAction = approval.action;
      setSupplierSendAction(approvedAction);
      if (approvedAction.status !== "approved") {
        throw new Error(t("orders.detail.approvalMissing.body"));
      }
      const result = await sendSupplierOrderEmail(restaurantId, savedOrder.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setOrder(result.order);
      setOperatorNote(result.order.operator_note ?? "");
      setNotice({
        title: usingLocalDemo
          ? t("orders.detail.notice.demoSentTitle")
          : result.sentToPreviouslyClaimedRecipient
            ? t("orders.detail.notice.claimedRecipientTitle")
            : result.outcome === "already_sent"
              ? t("orders.detail.notice.alreadySentTitle")
              : t("orders.detail.notice.acceptedTitle"),
        message: usingLocalDemo
          ? t("orders.detail.notice.demoSentBody")
          : result.sentToPreviouslyClaimedRecipient
            ? t("orders.detail.notice.claimedRecipientBody")
            : t("orders.detail.notice.acceptedBody"),
        tone: result.sentToPreviouslyClaimedRecipient ? "warning" : "success"
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

  async function markReceived() {
    if (!restaurant || !order || order.status !== "sent" || actionLockRef.current) return;
    if (!actionsEditable) {
      setNotice(viewOnlyNotice(t));
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await receiveSupplierOrderDelivery(restaurantId, order.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await load(false);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        title:
          result.outcome === "already_applied"
            ? t("orders.detail.notice.alreadyReceivedTitle")
            : t("orders.detail.notice.receivedTitle"),
        message:
          result.status === "discrepancy"
            ? t("orders.detail.notice.receivedDiscrepancyBody")
            : t("orders.detail.notice.receivedBody"),
        tone: result.status === "discrepancy" ? "warning" : "success"
      });
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice({
          title: t("orders.detail.notice.receiveFailedTitle"),
          message: t("orders.detail.notice.receiveFailedBody"),
          tone: "danger"
        });
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  async function resolveDeliveryReview(resolution: "confirm_sent" | "allow_retry") {
    if (!restaurant || !order || order.status !== "draft" || actionLockRef.current) return;
    if (!actionsEditable) {
      setNotice(viewOnlyNotice(t));
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await resolveSupplierEmailDelivery(restaurantId, order.id, resolution);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await load(false);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        title:
          resolution === "confirm_sent"
            ? t("orders.detail.reviewResolution.confirmedTitle")
            : t("orders.detail.reviewResolution.retryTitle"),
        message:
          resolution === "confirm_sent"
            ? t("orders.detail.reviewResolution.confirmedBody")
            : t("orders.detail.reviewResolution.retryBody"),
        tone: "success"
      });
      if (result.order) setOrder(result.order);
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice({
          title: t("orders.detail.reviewResolution.failedTitle"),
          message: t("orders.detail.reviewResolution.failedBody"),
          tone: "danger"
        });
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const canManageGmail = canDeleteRestaurantData(memberships, restaurant?.id);
  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: hubLoadError
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy
  });
  const visibleOrder = hubReady ? order : null;
  const isDraft = visibleOrder?.status === "draft";
  const isSent = visibleOrder?.status === "sent";
  const canEditDraft = Boolean(isDraft && actionsEditable);
  const visibleEmailConnection = hubReady ? emailConnection : null;
  const visibleEmailPayload = hubReady ? emailPayload : null;
  const visibleSupplierSendAction = hubReady ? supplierSendAction : null;
  const visibleDeliveryReview = hubReady ? deliveryReview : null;
  const needsDeliveryReview = supplierEmailDeliveryRequiresReview(
    visibleDeliveryReview,
    visibleSupplierSendAction?.status
  );
  const visibleDeliveryEvidence =
    hubReady ? deliveryEvidence : [];
  const gmailReady = Boolean(
    visibleEmailConnection?.status === "connected" &&
    visibleEmailPayload?.ready &&
    visibleEmailPayload.contentFingerprint &&
    visibleSupplierSendAction &&
    canApproveSupplierSendAction(visibleSupplierSendAction) &&
    !needsDeliveryReview
  );
  const generatedMessage = visibleOrder ? generatedOrderMessage(visibleOrder) : "";
  const noteNeedsPreviewRefresh = Boolean(
    isDraft && operatorNote.trim() !== (visibleOrder?.operator_note ?? "").trim()
  );
  const previewBlockerNotice = visibleEmailPayload && !visibleEmailPayload.ready
    ? supplierSendBlockerNotice(visibleEmailPayload.blockerCodes, t)
    : null;

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
                : visibleOrder.status === "completed"
                  ? t("orders.detail.subtitle.received")
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
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
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

          {canEditDraft && visibleEmailConnection?.status !== "connected" ? (
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
                <FileText size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
              ) : (
                <CheckCircle2 size={icon.emphasis} color={colors.success} strokeWidth={iconStroke} />
              )}
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>
                {isDraft
                  ? t("orders.ops.DraftedByMise")
                  : visibleOrder.status === "completed"
                    ? t("orders.ops.Received")
                    : t("orders.ops.Sent")}
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

          {visibleDeliveryEvidence.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("orders.detail.deliveryEvidence.title")}</Text>
              <Text style={styles.sectionBody}>{t("orders.detail.deliveryEvidence.body")}</Text>
              {visibleDeliveryEvidence.map((evidence) => (
                <View key={evidence.deliveryId} style={styles.deliveryEvidencePanel}>
                  <View style={styles.deliveryEvidenceHeader}>
                    <Badge
                      label={t(`orders.detail.deliveryEvidence.status.${evidence.status}` as MessageKey)}
                      tone={deliveryEvidenceTone(evidence.status)}
                    />
                    <Text style={styles.deliveryEvidenceMeta}>
                      {t("orders.detail.deliveryEvidence.meta", {
                        date: formatDate(evidence.receivedAt, {
                          dateStyle: "medium",
                          timeZone: restaurant?.timezone ?? "UTC"
                        }),
                        timing: t(
                          `orders.detail.deliveryEvidence.timing.${evidence.timing}` as MessageKey
                        )
                      })}
                    </Text>
                  </View>
                  <Text style={styles.deliveryEvidenceLine}>
                    {evidence.discrepancyLineCount > 0
                      ? t(
                          evidence.lineCount === 1
                            ? "orders.detail.deliveryEvidence.lines.attention.one"
                            : "orders.detail.deliveryEvidence.lines.attention.other",
                          {
                            count: formatNumber(evidence.lineCount),
                            issues: formatNumber(evidence.discrepancyLineCount)
                          }
                        )
                      : t(
                          evidence.lineCount === 1
                            ? "orders.detail.deliveryEvidence.lines.clear.one"
                            : "orders.detail.deliveryEvidence.lines.clear.other",
                          { count: formatNumber(evidence.lineCount) }
                        )}
                  </Text>
                  {evidence.notes ? (
                    <Text style={styles.deliveryEvidenceNote}>{evidence.notes}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

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

          {isDraft ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("orders.detail.review.title")}</Text>
              <Text style={styles.sectionBody}>{t("orders.detail.review.body")}</Text>
              <View style={styles.emailReviewPanel}>
                <EmailReviewRow
                  label={t("orders.detail.review.from")}
                  value={visibleEmailPayload?.from ?? t("orders.detail.review.unavailable")}
                />
                <EmailReviewRow
                  label={t("orders.detail.review.to")}
                  value={visibleEmailPayload?.to ?? t("orders.detail.review.unavailable")}
                />
                <EmailReviewRow
                  label={t("orders.detail.review.subject")}
                  value={visibleEmailPayload?.subject ?? t("orders.detail.review.unavailable")}
                />
                <View style={styles.emailReviewBodyBlock}>
                  <View style={styles.emailReviewBodyHeader}>
                    <Text style={styles.emailReviewBodyLabel}>
                      {t("orders.detail.review.emailBody")}
                    </Text>
                    {visibleEmailPayload ? (
                      <Text style={styles.emailReviewLineCount}>
                        {t(
                          visibleEmailPayload.lineCount === 1
                            ? "orders.detail.review.lines.one"
                            : "orders.detail.review.lines.other",
                          { count: formatNumber(visibleEmailPayload.lineCount) }
                        )}
                      </Text>
                    ) : null}
                  </View>
                  <Text selectable style={styles.orderMessage}>
                    {visibleEmailPayload?.body || t("orders.detail.review.unavailable")}
                  </Text>
                </View>
              </View>
              {noteNeedsPreviewRefresh ? (
                <StatusNotice
                  tone="warning"
                  title={t("orders.detail.review.pendingTitle")}
                  message={t("orders.detail.review.pendingBody")}
                />
              ) : null}
              {previewBlockerNotice ? (
                <StatusNotice
                  tone={previewBlockerNotice.tone}
                  title={previewBlockerNotice.title}
                  message={previewBlockerNotice.message}
                  actionLabel={previewBlockerNotice.recovery === "gmail"
                    ? t("orders.detail.recovery.gmail")
                    : previewBlockerNotice.recovery === "supplier"
                      ? t("orders.detail.recovery.supplier")
                      : previewBlockerNotice.recovery === "retry"
                        ? t("orders.detail.recovery.retry")
                      : undefined}
                  onAction={previewBlockerNotice.recovery === "gmail"
                    ? () => router.push("/settings/gmail" as never)
                    : previewBlockerNotice.recovery === "supplier"
                      ? () => router.push("/settings/suppliers" as never)
                      : previewBlockerNotice.recovery === "retry"
                        ? () => void load(false)
                      : undefined}
                />
              ) : null}
              {needsDeliveryReview ? (
                <View style={styles.reviewResolutionPanel}>
                  <StatusNotice
                    tone="warning"
                    title={t("orders.detail.reviewResolution.title")}
                    message={t("orders.detail.reviewResolution.body")}
                  />
                  {actionsEditable ? (
                    <View style={styles.reviewResolutionActions}>
                      <Button
                        title={busy
                          ? t("orders.detail.reviewResolution.working")
                          : t("orders.detail.reviewResolution.confirmSent")}
                        accessibilityLabel={t("orders.detail.reviewResolution.confirmSentAccessibility")}
                        variant="secondary"
                        onPress={() => void resolveDeliveryReview("confirm_sent")}
                        disabled={busy}
                        style={styles.actionButton}
                      />
                      <Button
                        title={busy
                          ? t("orders.detail.reviewResolution.working")
                          : t("orders.detail.reviewResolution.allowRetry")}
                        accessibilityLabel={t("orders.detail.reviewResolution.allowRetryAccessibility")}
                        onPress={() => void resolveDeliveryReview("allow_retry")}
                        disabled={busy}
                        style={styles.actionButton}
                      />
                    </View>
                  ) : null}
                </View>
              ) : visibleSupplierSendAction?.status === "executing" ? (
                <StatusNotice
                  tone="warning"
                  title={t("orders.detail.gmail.inProgressTitle")}
                  message={t("orders.detail.gmail.inProgressBody")}
                />
              ) : null}
              {!visibleSupplierSendAction && !needsDeliveryReview ? (
                <StatusNotice
                  tone="warning"
                  title={t("orders.detail.approvalMissing.title")}
                  message={t("orders.detail.approvalMissing.body")}
                />
              ) : null}
            </View>
          ) : null}

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
                  : notice.recovery === "retry"
                    ? t("orders.detail.recovery.retry")
                  : undefined}
              onAction={
                notice.recovery === "gmail"
                  ? () => router.push("/settings/gmail" as never)
                  : notice.recovery === "supplier"
                    ? () => router.push("/settings/suppliers" as never)
                    : notice.recovery === "retry"
                      ? () => void load(false)
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
              icon={<Copy size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
              onPress={() => void copyOrder()}
              disabled={busy}
              style={styles.actionButton}
            />
            {canEditDraft ? (
              <Button
                title={busy ? t("orders.detail.action.saving") : t("orders.detail.action.save")}
                accessibilityLabel={t("orders.detail.action.saveAccessibility")}
                variant="secondary"
                icon={<Save size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
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
                  : t("orders.detail.gmail.approveAndSend")}
              accessibilityLabel={usingLocalDemo
                ? t("orders.detail.action.simulateAccessibility", { supplier: visibleOrder.supplier_name })
                : t("orders.detail.action.approveAndSendAccessibility", {
                    supplier: visibleOrder.supplier_name,
                    recipient: visibleEmailPayload?.to ?? ""
                  })}
              icon={<Send size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
              onPress={() => void sendOrder()}
              disabled={busy}
              fullWidth
            />
          ) : null}

          {isSent && actionsEditable ? (
            <Button
              title={busy ? t("orders.detail.action.receiving") : t("orders.detail.action.markReceived")}
              accessibilityLabel={t("orders.detail.action.markReceivedAccessibility", {
                supplier: visibleOrder.supplier_name
              })}
              icon={<CheckCircle2 size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
              onPress={() => void markReceived()}
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

function EmailReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.emailReviewRow}>
      <Text style={styles.emailReviewLabel}>{label}</Text>
      <Text selectable style={styles.emailReviewValue}>{value}</Text>
    </View>
  );
}

function canApproveSupplierSendAction(action: MiseAction) {
  return ["prepared", "waiting_for_approval", "approved", "failed"].includes(
    action.status
  );
}

function sameReviewedSendContent(left: SupplierEmailPayload, right: SupplierEmailPayload) {
  return left.orderId === right.orderId &&
    left.supplierId === right.supplierId &&
    left.contentVersion === right.contentVersion &&
    Boolean(left.contentFingerprint) &&
    left.contentFingerprint === right.contentFingerprint;
}

function deliveryEvidenceTone(status: SupplierDeliveryStatus): BadgeTone {
  if (status === "received") return "success";
  if (status === "discrepancy" || status === "failed") return "danger";
  if (status === "partially_received") return "warning";
  return "neutral";
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
  if (isSupplierSendVerificationRace(error)) {
    return {
      title: t("orders.detail.error.verificationRaceTitle"),
      message: t("orders.detail.error.verificationRaceBody"),
      tone: "warning",
      recovery: "retry"
    };
  }
  const fallback: OrderNotice = {
    title: t("orders.detail.error.sendTitle"),
    message: isGmailIntegrationError(error)
      ? t("orders.detail.gmail.failed")
      : t("orders.detail.error.sendBody"),
    tone: "danger"
  };
  if (!isGmailIntegrationError(error)) return fallback;
  return supplierSendBlockerNotice(
    [String(error.status), ...safeBlockerCodes(error)],
    t,
    fallback
  );
}

function supplierSendBlockerNotice(
  blockerCodes: readonly string[],
  t: Translate,
  fallback?: OrderNotice
): OrderNotice {
  if (blockerCodes.includes("send_verification_race")) {
    return {
      title: t("orders.detail.error.verificationRaceTitle"),
      message: t("orders.detail.error.verificationRaceBody"),
      tone: "warning",
      recovery: "retry"
    };
  }
  if (blockerCodes.includes("send_content_changed") || blockerCodes.includes("content_changed")) {
    return {
      title: t("orders.detail.review.changedTitle"),
      message: t("orders.detail.review.changedBody"),
      tone: "warning"
    };
  }
  if (blockerCodes.includes("delivery_requires_review")) {
    return {
      title: t("settings.gmail.error.reviewTitle"),
      message: t("orders.detail.gmail.review"),
      tone: "warning"
    };
  }
  if (
    blockerCodes.includes("purchase_authority_stale") ||
    blockerCodes.includes("draft_authority_incomplete") ||
    blockerCodes.some(isPurchaseEvidenceBlockerCode)
  ) {
    return purchaseAuthoritySendNotice(blockerCodes, t);
  }
  if (blockerCodes.includes("send_in_progress") || blockerCodes.includes("in_progress")) {
    return {
      title: t("orders.detail.gmail.inProgressTitle"),
      message: t("orders.detail.gmail.inProgressBody"),
      tone: "warning"
    };
  }
  if (
    blockerCodes.includes("gmail_not_connected") ||
    blockerCodes.includes("needs_reauth")
  ) {
    return {
      title: blockerCodes.includes("needs_reauth")
        ? t("orders.detail.connection.reconnectTitle")
        : t("orders.detail.connection.connectTitle"),
      message: t("orders.detail.gmail.notConnected"),
      tone: "warning",
      recovery: "gmail"
    };
  }
  if (
    blockerCodes.includes("supplier_email_missing") ||
    blockerCodes.includes("supplier_email_invalid")
  ) {
    return {
      title: t("orders.detail.error.supplierEmailTitle"),
      message: t("orders.detail.error.supplierEmailBody"),
      tone: "warning",
      recovery: "supplier"
    };
  }
  if (
    blockerCodes.includes("provider_not_enabled") ||
    blockerCodes.includes("live_sending_disabled") ||
    blockerCodes.includes("server_configuration_missing")
  ) {
    return {
      title: t("orders.detail.error.sendingDisabledTitle"),
      message: t("orders.detail.error.sendingDisabledBody"),
      tone: "warning"
    };
  }
  if (
    blockerCodes.includes("order_lines_missing") ||
    blockerCodes.includes("order_not_draft") ||
    blockerCodes.includes("send_content_invalid") ||
    blockerCodes.includes("send_content_too_large") ||
    blockerCodes.includes("send_subject_invalid")
  ) {
    return {
      title: t("orders.detail.content.invalidTitle"),
      message: t("orders.detail.content.invalidBody"),
      tone: "warning"
    };
  }
  if (
    blockerCodes.includes("send_content_unapproved") ||
    blockerCodes.includes("approval_required")
  ) {
    return {
      title: t("orders.detail.content.approvalTitle"),
      message: t("orders.detail.content.approvalBody"),
      tone: "warning"
    };
  }
  return fallback ?? {
    title: t("orders.detail.error.previewUnavailableTitle"),
    message: t("orders.detail.error.previewUnavailableBody"),
    tone: "warning"
  };
}

function purchaseAuthoritySendNotice(
  blockerCodes: readonly string[],
  t: Translate
): OrderNotice {
  const purchaseBlocker = blockerCodes.find(isPurchaseEvidenceBlockerCode);
  return {
    title: t("orders.detail.authority.changedTitle"),
    message: purchaseBlocker
      ? `${t("orders.detail.authority.changedBody")} ${t(purchaseAuthorityBlockerMessageKey(purchaseBlocker) as MessageKey)}`
      : t("orders.detail.authority.changedBody"),
    tone: "warning"
  };
}

function safeBlockerCodes(error: unknown): string[] {
  const value = error && typeof error === "object"
    ? (error as { blockerCodes?: unknown }).blockerCodes
    : null;
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function isPurchaseAuthorityBlockerCode(code: string): code is PurchaseAuthorityBlockerCode {
  return (PURCHASE_AUTHORITY_BLOCKER_CODES as readonly string[]).includes(code);
}

function isPurchaseEvidenceBlockerCode(code: string): code is PurchaseAuthorityBlockerCode {
  return code !== "send_in_progress" &&
    code !== "delivery_requires_review" &&
    isPurchaseAuthorityBlockerCode(code);
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
  deliveryEvidencePanel: {
    marginTop: 4,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    padding: 12,
    gap: 7
  },
  deliveryEvidenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  deliveryEvidenceMeta: {
    flex: 1,
    textAlign: "right",
    color: colors.muted,
    ...typography.caption
  },
  deliveryEvidenceLine: {
    color: colors.text,
    ...typography.body
  },
  deliveryEvidenceNote: {
    color: colors.muted,
    ...typography.caption
  },
  messagePanel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    marginTop: 6
  },
  emailReviewPanel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 14,
    marginTop: 6,
    gap: 10
  },
  emailReviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  emailReviewLabel: {
    width: 58,
    color: colors.muted,
    ...typography.caption,
    fontWeight: "700"
  },
  emailReviewValue: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    ...typography.body
  },
  emailReviewBodyBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 8
  },
  emailReviewBodyHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12
  },
  emailReviewBodyLabel: {
    flex: 1,
    color: colors.muted,
    ...typography.caption,
    fontWeight: "700"
  },
  emailReviewLineCount: {
    color: colors.muted,
    ...typography.caption
  },
  orderMessage: {
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400"
  },
  reviewResolutionPanel: {
    gap: 12,
    marginTop: 12
  },
  reviewResolutionActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
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

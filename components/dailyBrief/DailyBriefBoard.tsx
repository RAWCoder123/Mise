import { useMemo, useState } from "react";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Badge, type BadgeTone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SectionSurface } from "../ui/SectionSurface";
import { StatusNotice } from "../ui/StatusNotice";
import { colors, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import type { FindingDecisionOutboxEntry } from "../../services/domain/findingDecisionOutbox";
import type {
  DailyOperationalBrief,
  OperationalFinding
} from "../../services/domain/operationalFindings";
import type { OperationalFindingDecisionType } from "../../services/domain/operationalFindingDecisions";
import {
  formatFindingMissingDataLabels,
  presentFindingRecoveryActions
} from "../../services/presentation/findingRecoveryPresentation";
import { latestMatchingQueueEntry } from "./findingQueueMatch";

export { latestMatchingQueueEntry, queuedFindingMatchesCurrent } from "./findingQueueMatch";

type FeedbackHandler = (
  finding: OperationalFinding,
  decisionType: OperationalFindingDecisionType,
  editedRecommendedAction?: string
) => Promise<void>;

export function DailyBriefBoard({
  brief,
  queue,
  canManage,
  busyFindingId,
  message,
  messageIsError,
  onSubmitFeedback,
  compact = false,
  onOpen
}: {
  brief: DailyOperationalBrief | null;
  queue: readonly FindingDecisionOutboxEntry[];
  canManage: boolean;
  busyFindingId: string | null;
  message: string | null;
  messageIsError: boolean;
  onSubmitFeedback: FeedbackHandler;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { formatNumber, t } = useLocale();
  const sections = useMemo(() => {
    if (!brief) return [];
    const byId = new Map(brief.findings.map((finding) => [finding.id, finding]));
    return (
      [
        { key: "now" as const, titleKey: "dailyBrief.section.now" as const, ids: brief.priorities.now },
        { key: "upNext" as const, titleKey: "dailyBrief.section.upNext" as const, ids: brief.priorities.upNext },
        { key: "later" as const, titleKey: "dailyBrief.section.later" as const, ids: brief.priorities.later }
      ] as const
    )
      .map((section) => ({
        ...section,
        findings: section.ids
          .map((id) => byId.get(id))
          .filter((finding): finding is OperationalFinding => Boolean(finding))
      }))
      .filter((section) => section.findings.length > 0);
  }, [brief]);

  const freshnessWarning = useMemo(() => {
    if (!brief) return null;
    if (brief.findings.some((finding) => finding.freshness.state === "incomplete")) {
      return { title: t("dailyBrief.incomplete.title"), tone: "warning" as const };
    }
    if (brief.findings.some((finding) => finding.freshness.state === "stale")) {
      return { title: t("dailyBrief.stale.title"), tone: "caution" as const };
    }
    return null;
  }, [brief, t]);

  if (compact) {
    const priorityIds = brief
      ? [...brief.priorities.now, ...brief.priorities.upNext, ...brief.priorities.later]
      : [];
    const firstFinding = priorityIds
      .map((id) => brief?.findings.find((finding) => finding.id === id))
      .find((finding): finding is OperationalFinding => Boolean(finding));
    const signalCount = brief?.findings.length ?? 0;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("dailyBrief.title")}
        disabled={!onOpen}
        onPress={onOpen}
        style={({ pressed }) => [styles.preview, pressed && styles.previewPressed]}
      >
        <View style={styles.previewCopy}>
          <View style={styles.previewHeading}>
            <Text style={styles.previewTitle}>{t("dailyBrief.title")}</Text>
            <Text style={styles.previewCount}>{formatNumber(signalCount)}</Text>
          </View>
          {firstFinding ? (
            <>
              <Text numberOfLines={1} style={styles.previewFinding}>
                {firstFinding.title}
              </Text>
              <Text numberOfLines={1} style={styles.previewBody}>
                {firstFinding.explanation}
              </Text>
            </>
          ) : (
            <Text numberOfLines={1} style={styles.previewBody}>
              {t("dailyBrief.empty.body")}
            </Text>
          )}
        </View>
        <ChevronRight size={icon.inline} color={colors.faint} strokeWidth={iconStroke} />
      </Pressable>
    );
  }

  return (
    <SectionSurface title={t("dailyBrief.title")} subtitle={t("dailyBrief.subtitle")} padding="none">
      <View style={styles.board}>
        {!canManage ? (
          <StatusNotice tone="caution" title={t("dailyBrief.viewOnly.title")} message={t("dailyBrief.viewOnly.body")} />
        ) : null}
        {freshnessWarning ? <StatusNotice tone={freshnessWarning.tone} title={freshnessWarning.title} /> : null}
        {message ? (
          <Text style={[styles.message, messageIsError && styles.messageError]} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
        <Text style={styles.disclaimer}>{t("dailyBrief.feedbackDisclaimer")}</Text>

        {!brief || brief.findings.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("dailyBrief.empty.title")}</Text>
            <Text style={styles.emptyBody}>{t("dailyBrief.empty.body")}</Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t(section.titleKey)} · {formatNumber(section.findings.length)}
              </Text>
              {section.findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  queueEntry={latestMatchingQueueEntry(finding, queue)}
                  canManage={canManage}
                  busy={busyFindingId === finding.id}
                  disabled={Boolean(busyFindingId)}
                  onSubmitFeedback={onSubmitFeedback}
                />
              ))}
            </View>
          ))
        )}
      </View>
    </SectionSurface>
  );
}

function FindingCard({
  finding,
  queueEntry,
  canManage,
  busy,
  disabled,
  onSubmitFeedback
}: {
  finding: OperationalFinding;
  queueEntry: FindingDecisionOutboxEntry | null;
  canManage: boolean;
  busy: boolean;
  disabled: boolean;
  onSubmitFeedback: FeedbackHandler;
}) {
  const { formatNumber, t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(finding.recommendedAction);
  const [editError, setEditError] = useState<string | undefined>();

  const severityTone: BadgeTone =
    finding.severity === "urgent" ? "danger" : finding.severity === "warning" ? "warning" : "neutral";
  const freshnessTone: BadgeTone =
    finding.freshness.state === "fresh" ? "success" : finding.freshness.state === "stale" ? "caution" : "warning";
  const queueStatus = queueEntry ? queueStatusKey(queueEntry) : null;
  const feedbackState = finding.managerFeedback.state;
  const evidenceCount = finding.evidence.length;
  const confidencePercent = formatNumber(finding.confidence.score, {
    style: "percent",
    maximumFractionDigits: 0
  });
  const recoveryActions = presentFindingRecoveryActions(finding);
  const missingDataLabel = formatFindingMissingDataLabels(finding.freshness.missingData, t);

  async function submit(decisionType: OperationalFindingDecisionType, edited?: string) {
    if (disabled || busy) return;
    await onSubmitFeedback(finding, decisionType, edited);
    setEditing(false);
    setEditError(undefined);
  }

  const severityLabel = t(`dailyBrief.severity.${finding.severity}` as "dailyBrief.severity.info");

  return (
    <View style={[styles.card, finding.severity === "urgent" && styles.cardUrgent]}>
      <View style={styles.badgeRow}>
        <Badge label={severityLabel} tone={severityTone} />
        <Badge
          label={t(`dailyBrief.${finding.freshness.state}.label` as "dailyBrief.fresh.label")}
          tone={freshnessTone}
        />
        {feedbackState !== "unreviewed" ? (
          <Badge
            label={t(
              feedbackState === "approved"
                ? "dailyBrief.feedback.state.approved"
                : feedbackState === "edited"
                  ? "dailyBrief.feedback.state.edited"
                  : "dailyBrief.feedback.state.dismissed"
            )}
            tone="neutral"
          />
        ) : null}
        {queueStatus ? (
          <Badge
            label={t(`dailyBrief.queue.${queueStatus}` as "dailyBrief.queue.pending")}
            tone={queueTone(queueStatus)}
          />
        ) : null}
      </View>

      <Text
        style={styles.cardTitle}
        accessibilityRole="header"
        accessibilityLabel={`${finding.title}. ${severityLabel}`}
      >
        {finding.title}
      </Text>
      <Text style={styles.cardBody}>{finding.explanation}</Text>
      <Text style={styles.meta}>
        {t("dailyBrief.confidence", { score: confidencePercent })} ·{" "}
        {t(evidenceCount === 1 ? "dailyBrief.evidenceCount.one" : "dailyBrief.evidenceCount.other", {
          count: formatNumber(evidenceCount)
        })}
      </Text>
      <Text style={styles.meta}>{t("dailyBrief.workflow", { workflow: finding.affectedWorkflow })}</Text>
      {finding.freshness.missingData.length > 0 && missingDataLabel ? (
        <Text style={styles.missing}>
          {t("dailyBrief.missingData", { items: missingDataLabel })}
        </Text>
      ) : null}
      {recoveryActions.length > 0 ? (
        <View style={styles.recoveryActions}>
          <Text style={styles.kicker}>{t("dailyBrief.recovery.title")}</Text>
          <View style={styles.actions}>
            {recoveryActions.map((action) => (
              <Button
                key={`${action.reason}:${action.href}`}
                title={t(action.labelKey)}
                variant="secondary"
                size="compact"
                accessibilityLabel={t(action.labelKey)}
                onPress={() => router.push(action.href as never)}
                style={styles.actionButton}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.kicker}>{t("dailyBrief.recommended")}</Text>
      <Text style={styles.recommended}>{finding.recommendedAction}</Text>
      {finding.managerFeedback.state !== "unreviewed" ? (
        <>
          <Text style={styles.kicker}>{t("dailyBrief.feedback.annotation")}</Text>
          <Text style={styles.annotation}>{finding.managerFeedback.effectiveRecommendedAction}</Text>
        </>
      ) : null}

      {canManage ? (
        editing ? (
          <View style={styles.editBlock}>
            <Text style={styles.editLabel}>{t("dailyBrief.edit.label")}</Text>
            <TextInput
              accessibilityLabel={t("dailyBrief.edit.label")}
              value={editText}
              onChangeText={(value) => {
                setEditText(value);
                setEditError(undefined);
              }}
              editable={!busy}
              multiline
              style={[styles.editInput, editError ? styles.editInputError : null]}
              placeholder={t("dailyBrief.edit.placeholder")}
              placeholderTextColor={colors.faint}
            />
            {editError ? <Text style={styles.editError}>{editError}</Text> : null}
            <View style={styles.actions}>
              <Button
                title={t("dailyBrief.action.saveEdit")}
                onPress={() => {
                  const next = editText.trim();
                  if (!next || next === finding.recommendedAction.trim() || next.length > 320) {
                    setEditError(t("dailyBrief.edit.invalid"));
                    return;
                  }
                  void submit("edited", next);
                }}
                disabled={busy || disabled}
                style={styles.actionButton}
              />
              <Button
                title={t("dailyBrief.action.cancelEdit")}
                variant="secondary"
                onPress={() => {
                  setEditing(false);
                  setEditText(finding.recommendedAction);
                  setEditError(undefined);
                }}
                disabled={busy}
                style={styles.actionButton}
              />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button
              title={t("dailyBrief.action.approve")}
              accessibilityLabel={t("dailyBrief.approveAccessibility", { title: finding.title })}
              onPress={() => void submit("approved")}
              disabled={busy || disabled}
              style={styles.actionButton}
            />
            <Button
              title={t("dailyBrief.action.edit")}
              variant="secondary"
              accessibilityLabel={t("dailyBrief.editAccessibility", { title: finding.title })}
              onPress={() => {
                setEditing(true);
                setEditText(finding.recommendedAction);
              }}
              disabled={busy || disabled}
              style={styles.actionButton}
            />
            <Button
              title={t("dailyBrief.action.dismiss")}
              variant="secondary"
              accessibilityLabel={t("dailyBrief.dismissAccessibility", { title: finding.title })}
              onPress={() => void submit("dismissed")}
              disabled={busy || disabled}
              style={styles.actionButton}
            />
          </View>
        )
      ) : null}
    </View>
  );
}

function queueStatusKey(entry: FindingDecisionOutboxEntry) {
  if (entry.status === "pending" && entry.resolutionReason) return "retryable" as const;
  return entry.status;
}


function queueTone(status: string): BadgeTone {
  if (status === "accepted") return "success";
  if (status === "submitting" || status === "pending" || status === "retryable") return "caution";
  if (status === "conflict" || status === "rejected") return "danger";
  return "neutral";
}

const styles = StyleSheet.create({
  preview: {
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  previewPressed: {
    opacity: 0.68
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  previewHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  previewTitle: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 16,
    lineHeight: 21
  },
  previewCount: {
    color: colors.accent,
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 17
  },
  previewFinding: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 15,
    lineHeight: 20
  },
  previewBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 18
  },
  board: { gap: 12, padding: 12 },
  disclaimer: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 17
  },
  message: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 18
  },
  messageError: { color: colors.danger },
  empty: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    padding: 16,
    gap: 6
  },
  emptyTitle: { color: colors.text, fontFamily: typography.families.bold, fontSize: 15, lineHeight: 20 },
  emptyBody: { color: colors.muted, fontFamily: typography.families.body, fontSize: 13, lineHeight: 18 },
  section: { gap: 10 },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 14,
    lineHeight: 18,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    padding: 12,
    gap: 6
  },
  cardUrgent: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cardTitle: { color: colors.text, fontFamily: typography.families.bold, fontSize: 16, lineHeight: 21 },
  cardBody: { color: colors.muted, fontFamily: typography.families.body, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.faint, fontFamily: typography.families.semibold, fontSize: 12, lineHeight: 16 },
  missing: { color: colors.warning, fontFamily: typography.families.semibold, fontSize: 12, lineHeight: 16 },
  recoveryActions: { gap: 4, marginTop: 4 },
  kicker: {
    marginTop: 4,
    color: colors.faint,
    fontFamily: typography.families.bold,
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase"
  },
  recommended: { color: colors.text, fontFamily: typography.families.semibold, fontSize: 14, lineHeight: 19 },
  annotation: { color: colors.text, fontFamily: typography.families.body, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionButton: { minHeight: 44, flexGrow: 1 },
  editBlock: { gap: 8, marginTop: 8 },
  editLabel: { color: colors.text, fontFamily: typography.families.bold, fontSize: 13, lineHeight: 18 },
  editInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: "top"
  },
  editInputError: { borderColor: colors.danger },
  editError: { color: colors.danger, fontFamily: typography.families.semibold, fontSize: 12, lineHeight: 16 }
});

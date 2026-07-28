import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Badge, type BadgeTone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SectionSurface } from "../ui/SectionSurface";
import { StatusNotice } from "../ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import type { FindingDecisionOutboxEntry } from "../../services/domain/findingDecisionOutbox";
import type {
  DailyOperationalBrief,
  OperationalFinding
} from "../../services/domain/operationalFindings";
import type { OperationalFindingDecisionType } from "../../services/domain/operationalFindingDecisions";

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
  onSubmitFeedback
}: {
  brief: DailyOperationalBrief | null;
  queue: readonly FindingDecisionOutboxEntry[];
  canManage: boolean;
  busyFindingId: string | null;
  message: string | null;
  messageIsError: boolean;
  onSubmitFeedback: FeedbackHandler;
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

  const queueByFindingId = useMemo(() => {
    const map = new Map<string, FindingDecisionOutboxEntry>();
    for (const entry of queue) {
      const findingId = entry.decision.finding.id;
      const existing = map.get(findingId);
      if (!existing || entry.updatedAt > existing.updatedAt) map.set(findingId, entry);
    }
    return map;
  }, [queue]);

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
                  queueEntry={queueByFindingId.get(finding.id) ?? null}
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

  async function submit(decisionType: OperationalFindingDecisionType, edited?: string) {
    if (disabled || busy) return;
    await onSubmitFeedback(finding, decisionType, edited);
    setEditing(false);
    setEditError(undefined);
  }

  return (
    <View
      style={[styles.card, finding.severity === "urgent" && styles.cardUrgent]}
      accessible
      accessibilityLabel={`${finding.title}. ${t(`dailyBrief.severity.${finding.severity}`)}`}
    >
      <View style={styles.badgeRow}>
        <Badge label={t(`dailyBrief.severity.${finding.severity}` as "dailyBrief.severity.info")} tone={severityTone} />
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

      <Text style={styles.cardTitle}>{finding.title}</Text>
      <Text style={styles.cardBody}>{finding.explanation}</Text>
      <Text style={styles.meta}>
        {t("dailyBrief.confidence", { score: confidencePercent })} ·{" "}
        {t(evidenceCount === 1 ? "dailyBrief.evidenceCount.one" : "dailyBrief.evidenceCount.other", {
          count: formatNumber(evidenceCount)
        })}
      </Text>
      <Text style={styles.meta}>{t("dailyBrief.workflow", { workflow: finding.affectedWorkflow })}</Text>
      {finding.freshness.missingData.length > 0 ? (
        <Text style={styles.missing}>
          {t("dailyBrief.missingData", { items: finding.freshness.missingData.join(", ") })}
        </Text>
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
  kicker: {
    marginTop: 4,
    color: colors.faint,
    fontFamily: typography.families.bold,
    fontSize: 11,
    lineHeight: 14,
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

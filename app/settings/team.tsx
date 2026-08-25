import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, UserPlus, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  addRestaurantMemberByEmail,
  fetchRestaurantTeam,
  removeRestaurantMember,
  updateRestaurantMember
} from "../../services/miseService";
import {
  assignableTeamRoles,
  canEditTeamMember,
  canManageTeam,
  normalizeTeamMemberEmail,
  sortTeamMembers,
  TeamMembershipError,
  type AssignableTeamRole
} from "../../services/domain/teamMembership";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import type { RestaurantRole, RestaurantTeamMember } from "../../types/mise";
import { captureMiseError } from "../../services/telemetry";

interface TeamNotice {
  tone: StatusNoticeTone;
  titleKey: MessageKey;
  bodyKey?: MessageKey;
}

const roleKeys: Record<RestaurantRole, MessageKey> = {
  owner: "settings.role.owner",
  admin: "settings.role.admin",
  manager: "settings.role.manager",
  staff: "settings.role.staff"
};

export default function TeamSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { restaurant, role, user, usingLocalDemo } = useMiseSession();
  const [members, setMembers] = useState<RestaurantTeamMember[]>([]);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableTeamRole>("staff");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<TeamNotice | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canManage = canManageTeam(role);
  const availableRoles = useMemo(() => assignableTeamRoles(role), [role]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    const soft = hasLoadedRef.current && activeRestaurantIdRef.current === restaurantId;
    if (soft) {
      // Invalidate readiness during soft refresh so mutations stay closed until proof returns.
      setLoadedRestaurantId(null);
    } else {
      setLoading(true);
      setLoadError(false);
      setNotice(null);
    }
    try {
      const nextMembers = sortTeamMembers(await fetchRestaurantTeam(restaurantId));
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setMembers(nextMembers);
      setLoadedRestaurantId(restaurantId);
      setLoadError(false);
      // Soft refresh must preserve operator-entered invite email/role drafts.
    } catch (error) {
      captureMiseError(error, { flow: "team", operation: "load", restaurant_id: restaurantId });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      // Fail closed for display/actions, but keep local invite drafts and prior members for retry.
      setLoadError(true);
      if (!soft) {
        setMembers([]);
      }
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    hasLoadedRef.current = false;
    setMembers([]);
    setLoadedRestaurantId(null);
    setLoadError(false);
    setNotice(null);
    setInviteEmail("");
    setBusyKey(null);
    setLoading(Boolean(restaurant));
    if (availableRoles.length > 0 && !availableRoles.includes(inviteRole)) {
      setInviteRole(availableRoles[0]!);
    }
  }, [restaurant?.id, availableRoles.join("|")]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: t("team.title"),
      headerLeft: () => (
        <ActionIcon accessibilityLabel={t("team.back")} onPress={() => router.back()}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      )
    });
  }, [navigation, t]);

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const mutationAllowed = canManage && hubReady;
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: Boolean(busyKey)
  });
  const visibleMembers = hubReady ? members : [];

  async function inviteMember() {
    if (!restaurant || !actionsEditable) return;
    const normalizedEmail = normalizeTeamMemberEmail(inviteEmail);
    if (!normalizedEmail) {
      setNotice({ tone: "danger", titleKey: "team.notice.emailInvalid" });
      return;
    }
    setBusyKey("invite");
    setNotice(null);
    try {
      await addRestaurantMemberByEmail(restaurant.id, normalizedEmail, inviteRole);
      setInviteEmail("");
      setNotice({ tone: "success", titleKey: "team.notice.added" });
      await load();
    } catch (error) {
      captureMiseError(error, { flow: "team", operation: "add", restaurant_id: restaurant.id });
      setNotice({
        tone: "danger",
        titleKey:
          error instanceof TeamMembershipError && error.status === "account_not_found"
            ? "team.notice.accountMissing"
            : error instanceof TeamMembershipError && error.status === "already_member"
              ? "team.notice.alreadyMember"
              : error instanceof TeamMembershipError && error.status === "permission_denied"
                ? "team.notice.permissionDenied"
                : "team.notice.addError"
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function changeRole(member: RestaurantTeamMember, nextRole: AssignableTeamRole) {
    if (!restaurant || !actionsEditable || member.role === nextRole) return;
    setBusyKey(`role:${member.user_id}`);
    setNotice(null);
    try {
      await updateRestaurantMember(restaurant.id, member.user_id, { role: nextRole });
      setNotice({ tone: "success", titleKey: "team.notice.roleUpdated" });
      await load();
    } catch (error) {
      captureMiseError(error, { flow: "team", operation: "update_role", restaurant_id: restaurant.id });
      setNotice({ tone: "danger", titleKey: "team.notice.updateError" });
    } finally {
      setBusyKey(null);
    }
  }

  async function removeMember(member: RestaurantTeamMember) {
    if (!restaurant || !actionsEditable) return;
    setBusyKey(`remove:${member.user_id}`);
    setNotice(null);
    try {
      await removeRestaurantMember(restaurant.id, member.user_id);
      setNotice({ tone: "success", titleKey: "team.notice.removed" });
      await load();
    } catch (error) {
      captureMiseError(error, { flow: "team", operation: "remove", restaurant_id: restaurant.id });
      setNotice({ tone: "danger", titleKey: "team.notice.removeError" });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Screen title={t("team.title")} subtitle={restaurant ? restaurant.name : t("team.subtitle")}>
      <View style={styles.stack}>
        {notice ? (
          <StatusNotice title={t(notice.titleKey)} message={notice.bodyKey ? t(notice.bodyKey) : undefined} tone={notice.tone} />
        ) : null}

        {usingLocalDemo ? (
          <StatusNotice title={t("team.notice.demoTitle")} message={t("team.notice.demoBody")} tone="neutral" />
        ) : null}

        {canManage ? (
          <SectionSurface title={t("team.section.invite")} padding="comfortable">
            <Text style={styles.helper}>{t("team.invite.helper")}</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder={t("team.invite.emailPlaceholder")}
              accessibilityLabel={t("team.invite.emailAccessibility")}
              style={styles.input}
              editable={actionsEditable}
            />
            <View style={styles.roleRow}>
              {availableRoles.map((option) => {
                const selected = option === inviteRole;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setInviteRole(option)}
                    disabled={!actionsEditable}
                    style={[styles.roleChip, selected ? styles.roleChipSelected : null]}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !actionsEditable }}
                    accessibilityLabel={t(roleKeys[option])}
                  >
                    <Text style={[styles.roleChipText, selected ? styles.roleChipTextSelected : null]}>
                      {t(roleKeys[option])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Button
              title={t(busyKey === "invite" ? "team.invite.adding" : "team.invite.add")}
              onPress={() => void inviteMember()}
              disabled={!actionsEditable || inviteEmail.trim().length === 0}
              icon={<UserPlus size={icon.inline} color={colors.surface} strokeWidth={iconStroke} />}
            />
          </SectionSurface>
        ) : (
          <StatusNotice title={t("team.notice.readOnlyTitle")} message={t("team.notice.readOnlyBody")} tone="neutral" />
        )}

        <SectionSurface title={t("team.section.members")} padding="comfortable">
          {loading ? <Text style={styles.helper}>{t("team.loading")}</Text> : null}
          {loadError ? (
            <RetryNotice
              title={t("team.empty.errorTitle")}
              message={t("team.empty.errorBody")}
              retryLabel={t("team.empty.retry")}
              accessibilityLabel={t("team.empty.retryAccessibility")}
              onRetry={() => void load()}
            />
          ) : null}
          {!loading && !loadError && visibleMembers.length === 0 ? (
            <EmptyState
              title={t("team.empty.title")}
              body={t("team.empty.body")}
              illustration={<UsersRound size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
              framed
            />
          ) : null}
          {visibleMembers.map((member) => {
            const isSelf = member.user_id === user?.id;
            const editable = mutationAllowed && canEditTeamMember(role, { role: member.role, isSelf });
            return (
              <View key={`${member.restaurant_id}:${member.user_id}`} style={styles.memberCard}>
                <View style={styles.memberHeader}>
                  <IconBadge tone="neutral">
                    <UsersRound size={icon.inline} color={colors.text} strokeWidth={iconStroke} />
                  </IconBadge>
                  <View style={styles.memberCopy}>
                    <Text style={styles.memberName}>
                      {member.name?.trim() || member.email?.trim() || t("team.member.unnamed")}
                      {isSelf ? ` · ${t("team.member.you")}` : ""}
                    </Text>
                    <Text style={styles.memberEmail}>{member.email?.trim() || t("team.member.emailMissing")}</Text>
                  </View>
                  <Badge label={t(roleKeys[member.role])} tone="neutral" />
                </View>
                {editable ? (
                  <View style={styles.memberActions}>
                    <View style={styles.roleRow}>
                      {availableRoles.map((option) => {
                        const selected = option === member.role;
                        return (
                          <Pressable
                            key={option}
                            onPress={() => void changeRole(member, option)}
                            style={[styles.roleChip, selected ? styles.roleChipSelected : null]}
                            disabled={!actionsEditable}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled: !actionsEditable }}
                            accessibilityLabel={t("team.member.setRole", { role: t(roleKeys[option]) })}
                          >
                            <Text style={[styles.roleChipText, selected ? styles.roleChipTextSelected : null]}>
                              {t(roleKeys[option])}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Button
                      title={t(busyKey === `remove:${member.user_id}` ? "team.member.removing" : "team.member.remove")}
                      variant="secondary"
                      onPress={() => void removeMember(member)}
                      disabled={!actionsEditable}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </SectionSurface>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  helper: {
    ...typography.body,
    color: colors.muted
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  roleChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  roleChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  roleChipText: {
    ...typography.caption,
    color: colors.text
  },
  roleChipTextSelected: {
    color: colors.accentDark
  },
  memberCard: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  memberCopy: {
    flex: 1,
    gap: 2
  },
  memberName: {
    ...typography.cardTitle,
    color: colors.text
  },
  memberEmail: {
    ...typography.caption,
    color: colors.muted
  },
  memberActions: {
    gap: spacing.sm,
    paddingLeft: 44
  }
});

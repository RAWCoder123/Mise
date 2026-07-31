import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ArrowLeft, Copy, Link2, ShieldCheck, UserPlus, Users } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  addRestaurantMemberByEmail,
  createRestaurantMemberInvite,
  fetchRestaurantMemberInvites,
  fetchRestaurantTeamMembers,
  removeRestaurantMember,
  revokeRestaurantMemberInvite,
  updateRestaurantMember
} from "../../services/miseService";
import {
  canActorChangeMemberRole,
  canActorChangeMemberStatus,
  canActorRemoveMember,
  isValidMemberEmail,
  rolesAssignableBy,
  type AssignableRestaurantRole
} from "../../services/domain/teamMembership";
import {
  buildInviteClaimPath,
  canActorRevokeMemberInvite,
  isInvitePending
} from "../../services/domain/teamInvites";
import {
  canManageTeamForRestaurant,
  canViewMemberInvitesForRestaurant,
  canViewTeamForRestaurant
} from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import type { CreatedRestaurantMemberInvite, RestaurantMemberInvite, RestaurantRole, RestaurantTeamMember } from "../../types/mise";

type TeamNotice = { tone: StatusNoticeTone; key: MessageKey };

export default function TeamSettingsScreen() {
  const navigation = useNavigation();
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant, role, user } = useMiseSession();
  const [members, setMembers] = useState<RestaurantTeamMember[]>([]);
  const [invites, setInvites] = useState<RestaurantMemberInvite[]>([]);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<TeamNotice | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRestaurantRole>("staff");
  const [createdInvite, setCreatedInvite] = useState<CreatedRestaurantMemberInvite | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canView = canViewTeamForRestaurant(memberships, restaurant?.id);
  const canManage = canManageTeamForRestaurant(memberships, restaurant?.id);
  const canViewInvites = canViewMemberInvitesForRestaurant(memberships, restaurant?.id);
  const assignableRoles = useMemo(() => rolesAssignableBy(role), [role]);

  useEffect(() => {
    if (assignableRoles.length > 0 && !assignableRoles.includes(inviteRole)) {
      setInviteRole(assignableRoles[0]!);
    }
  }, [assignableRoles, inviteRole]);

  const load = useCallback(async () => {
    if (!restaurant || !canView) {
      setLoading(false);
      setMembers([]);
      setInvites([]);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const [nextMembers, nextInvites] = await Promise.all([
        fetchRestaurantTeamMembers(restaurantId),
        canViewInvites ? fetchRestaurantMemberInvites(restaurantId) : Promise.resolve([])
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setMembers(nextMembers);
      setInvites(nextInvites);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "settings_team", operation: "load", restaurant_id: restaurantId });
      setNotice({ tone: "danger", key: "settings.team.notice.loadError" });
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [canView, canViewInvites, restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    setMembers([]);
    setInvites([]);
    setLoadedRestaurantId(null);
    setNotice(null);
    setBusyKey(null);
    setCreatedInvite(null);
    setLoading(Boolean(restaurant) && canView);
  }, [canView, restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function addExistingMember() {
    if (!restaurant || !canManage || busyKey) return;
    const restaurantId = restaurant.id;
    if (!isValidMemberEmail(inviteEmail)) {
      setNotice({ tone: "caution", key: "settings.team.notice.invalidEmail" });
      return;
    }
    setBusyKey("add");
    setNotice(null);
    try {
      await addRestaurantMemberByEmail(restaurantId, inviteEmail, inviteRole);
      setInviteEmail("");
      setCreatedInvite(null);
      await load();
      setNotice({ tone: "success", key: "settings.team.notice.added" });
    } catch (inviteError) {
      captureMiseError(inviteError, { flow: "settings_team", operation: "add", restaurant_id: restaurantId });
      setNotice({ tone: "danger", key: "settings.team.notice.addError" });
    } finally {
      setBusyKey(null);
    }
  }

  async function createInviteLink() {
    if (!restaurant || !canManage || busyKey) return;
    const restaurantId = restaurant.id;
    if (!isValidMemberEmail(inviteEmail)) {
      setNotice({ tone: "caution", key: "settings.team.notice.invalidEmail" });
      return;
    }
    setBusyKey("create-invite");
    setNotice(null);
    try {
      const invite = await createRestaurantMemberInvite(restaurantId, inviteEmail, inviteRole);
      setCreatedInvite(invite);
      setInviteEmail("");
      await load();
      setNotice({ tone: "success", key: "settings.team.notice.inviteCreated" });
    } catch (inviteError) {
      captureMiseError(inviteError, {
        flow: "settings_team",
        operation: "create_invite",
        restaurant_id: restaurantId
      });
      setNotice({ tone: "danger", key: "settings.team.notice.inviteCreateError" });
    } finally {
      setBusyKey(null);
    }
  }

  async function copyCreatedInvite() {
    if (!createdInvite) return;
    await Clipboard.setStringAsync(buildInviteClaimPath(createdInvite.claim_token));
    setNotice({ tone: "success", key: "settings.team.notice.inviteCopied" });
  }

  async function revokeInvite(invite: RestaurantMemberInvite) {
    if (!restaurant || !canManage || busyKey) return;
    const restaurantId = restaurant.id;
    setBusyKey(`revoke:${invite.id}`);
    setNotice(null);
    try {
      await revokeRestaurantMemberInvite(restaurantId, invite.id);
      if (createdInvite?.id === invite.id) setCreatedInvite(null);
      await load();
      setNotice({ tone: "success", key: "settings.team.notice.inviteRevoked" });
    } catch (revokeError) {
      captureMiseError(revokeError, {
        flow: "settings_team",
        operation: "revoke_invite",
        restaurant_id: restaurantId
      });
      setNotice({ tone: "danger", key: "settings.team.notice.inviteRevokeError" });
    } finally {
      setBusyKey(null);
    }
  }

  async function changeRole(member: RestaurantTeamMember, nextRole: RestaurantRole) {
    if (!restaurant || !canManage || busyKey || nextRole === member.role) return;
    if (!canActorChangeMemberRole(role, member.role, nextRole)) return;
    const restaurantId = restaurant.id;
    setBusyKey(`role:${member.user_id}`);
    setNotice(null);
    try {
      await updateRestaurantMember(restaurantId, member.user_id, { role: nextRole });
      await load();
      setNotice({ tone: "success", key: "settings.team.notice.updated" });
    } catch (updateError) {
      captureMiseError(updateError, { flow: "settings_team", operation: "update_role", restaurant_id: restaurantId });
      setNotice({ tone: "danger", key: "settings.team.notice.updateError" });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleDisabled(member: RestaurantTeamMember) {
    if (!restaurant || !canManage || busyKey) return;
    const nextStatus = member.status === "disabled" ? "active" : "disabled";
    if (!canActorChangeMemberStatus(role, member.role, nextStatus)) return;
    const restaurantId = restaurant.id;
    setBusyKey(`status:${member.user_id}`);
    setNotice(null);
    try {
      await updateRestaurantMember(restaurantId, member.user_id, { status: nextStatus });
      await load();
      setNotice({
        tone: "success",
        key: nextStatus === "disabled" ? "settings.team.notice.disabled" : "settings.team.notice.enabled"
      });
    } catch (updateError) {
      captureMiseError(updateError, {
        flow: "settings_team",
        operation: "update_status",
        restaurant_id: restaurantId
      });
      setNotice({ tone: "danger", key: "settings.team.notice.updateError" });
    } finally {
      setBusyKey(null);
    }
  }

  async function removeMember(member: RestaurantTeamMember) {
    if (!restaurant || !canManage || busyKey) return;
    if (!canActorRemoveMember(role, member.role)) return;
    const restaurantId = restaurant.id;
    setBusyKey(`remove:${member.user_id}`);
    setNotice(null);
    try {
      await removeRestaurantMember(restaurantId, member.user_id);
      await load();
      setNotice({ tone: "success", key: "settings.team.notice.removed" });
    } catch (removeError) {
      captureMiseError(removeError, { flow: "settings_team", operation: "remove", restaurant_id: restaurantId });
      setNotice({ tone: "danger", key: "settings.team.notice.removeError" });
    } finally {
      setBusyKey(null);
    }
  }

  const visibleMembers = loadedRestaurantId === restaurant?.id ? members : [];
  const pendingInvites =
    loadedRestaurantId === restaurant?.id
      ? invites.filter((invite) => isInvitePending(invite.status, invite.expires_at))
      : [];

  return (
    <Screen
      title={t("settings.team.title")}
      subtitle={t("settings.team.subtitle")}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        {notice ? <StatusNotice title={t(notice.key)} tone={notice.tone} /> : null}

        {!canView ? (
          <EmptyState
            illustration={<ShieldCheck size={22} color={colors.muted} strokeWidth={2.25} />}
            title={t("settings.team.restrictedTitle")}
            body={t("settings.team.restrictedBody")}
          />
        ) : (
          <>
            <SectionSurface>
              <View style={styles.sectionHeading}>
                <IconBadge tone="neutral">
                  <Users size={20} color={colors.text} strokeWidth={2.25} />
                </IconBadge>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>{t("settings.team.rosterTitle")}</Text>
                  <Text style={styles.sectionBody}>
                    {t("settings.team.rosterBody", { count: formatNumber(visibleMembers.length) })}
                  </Text>
                </View>
              </View>

              {loading ? (
                <Text style={styles.helper}>{t("settings.team.loading")}</Text>
              ) : visibleMembers.length === 0 ? (
                <EmptyState
                  illustration={<Users size={22} color={colors.muted} strokeWidth={2.25} />}
                  title={t("settings.team.emptyTitle")}
                  body={t("settings.team.emptyBody")}
                />
              ) : (
                <View style={styles.memberList}>
                  {visibleMembers.map((member) => {
                    const isSelf = member.user_id === user?.id;
                    const manageRoles = rolesAssignableBy(role).filter((entry) =>
                      canActorChangeMemberRole(role, member.role, entry)
                    );
                    const canDisable = canActorChangeMemberStatus(
                      role,
                      member.role,
                      member.status === "disabled" ? "active" : "disabled"
                    );
                    const canRemove = canActorRemoveMember(role, member.role);
                    return (
                      <View key={member.id} style={styles.memberCard}>
                        <View style={styles.memberHeader}>
                          <View style={styles.memberCopy}>
                            <Text style={styles.memberName}>{member.display_name}</Text>
                            <Text style={styles.memberEmail}>{member.email || t("settings.team.emailMissing")}</Text>
                          </View>
                          <Badge
                            label={roleLabel(member.role, t)}
                            tone={member.status === "active" ? "neutral" : "caution"}
                          />
                        </View>
                        <Text style={styles.memberMeta}>
                          {t(
                            member.status === "active"
                              ? "settings.team.status.active"
                              : member.status === "disabled"
                                ? "settings.team.status.disabled"
                                : "settings.team.status.invited"
                          )}
                          {isSelf ? ` · ${t("settings.team.you")}` : ""}
                        </Text>

                        {canManage && !isSelf && member.role !== "owner" ? (
                          <View style={styles.memberActions}>
                            {manageRoles.length > 0 ? (
                              <SegmentedControl
                                accessibilityLabel={t("settings.team.roleControlAccessibility", {
                                  name: member.display_name
                                })}
                                options={manageRoles.map((entry) => ({
                                  value: entry,
                                  label: roleLabel(entry, t)
                                }))}
                                value={
                                  (manageRoles.includes(member.role as AssignableRestaurantRole)
                                    ? member.role
                                    : manageRoles[0]!) as AssignableRestaurantRole
                                }
                                onValueChange={(value) => void changeRole(member, value)}
                                variant="pills"
                                scrollable
                              />
                            ) : null}
                            <View style={styles.actionRow}>
                              {canDisable ? (
                                <Button
                                  title={t(
                                    member.status === "disabled"
                                      ? "settings.team.action.enable"
                                      : "settings.team.action.disable"
                                  )}
                                  variant="secondary"
                                  onPress={() => void toggleDisabled(member)}
                                  disabled={Boolean(busyKey)}
                                />
                              ) : null}
                              {canRemove ? (
                                <Button
                                  title={t("settings.team.action.remove")}
                                  variant="secondary"
                                  onPress={() => void removeMember(member)}
                                  disabled={Boolean(busyKey)}
                                />
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </SectionSurface>

            {canManage ? (
              <SectionSurface>
                <View style={styles.sectionHeading}>
                  <IconBadge tone="brand">
                    <Link2 size={20} color={colors.accentDark} strokeWidth={2.25} />
                  </IconBadge>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle}>{t("settings.team.shareInviteTitle")}</Text>
                    <Text style={styles.sectionBody}>{t("settings.team.shareInviteBody")}</Text>
                  </View>
                </View>

                <Text style={styles.label}>{t("settings.team.emailLabel")}</Text>
                <TextInput
                  accessibilityLabel={t("settings.team.emailLabel")}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder={t("settings.team.emailPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                />

                {assignableRoles.length > 0 ? (
                  <SegmentedControl
                    accessibilityLabel={t("settings.team.inviteRoleAccessibility")}
                    options={assignableRoles.map((entry) => ({
                      value: entry,
                      label: roleLabel(entry, t)
                    }))}
                    value={inviteRole}
                    onValueChange={setInviteRole}
                    variant="pills"
                    scrollable
                    style={styles.roleControl}
                  />
                ) : null}

                <View style={styles.actionRow}>
                  <Button
                    title={t(
                      busyKey === "create-invite" ? "settings.team.creatingInvite" : "settings.team.createInvite"
                    )}
                    icon={<Link2 size={18} color={colors.surface} strokeWidth={2.25} />}
                    onPress={() => void createInviteLink()}
                    disabled={Boolean(busyKey) || assignableRoles.length === 0}
                  />
                  <Button
                    title={t(busyKey === "add" ? "settings.team.adding" : "settings.team.add")}
                    icon={<UserPlus size={18} color={colors.text} strokeWidth={2.25} />}
                    variant="secondary"
                    onPress={() => void addExistingMember()}
                    disabled={Boolean(busyKey) || assignableRoles.length === 0}
                  />
                </View>
                <Text style={styles.helper}>{t("settings.team.inviteHelper")}</Text>

                {createdInvite ? (
                  <View style={styles.createdInvite}>
                    <Text style={styles.memberName}>{t("settings.team.createdInviteTitle")}</Text>
                    <Text style={styles.memberEmail}>{createdInvite.email}</Text>
                    <Text style={styles.path}>{buildInviteClaimPath(createdInvite.claim_token)}</Text>
                    <Button
                      title={t("settings.team.copyInvite")}
                      icon={<Copy size={18} color={colors.surface} strokeWidth={2.25} />}
                      onPress={() => void copyCreatedInvite()}
                      fullWidth
                    />
                    <Text style={styles.helper}>{t("settings.team.createdInviteHelper")}</Text>
                  </View>
                ) : null}
              </SectionSurface>
            ) : (
              <Pressable accessibilityRole="text" style={styles.readOnlyNote}>
                <Text style={styles.helper}>{t("settings.team.readOnlyHelper")}</Text>
              </Pressable>
            )}

            {canViewInvites ? (
              <SectionSurface>
                <View style={styles.sectionHeading}>
                  <IconBadge tone="neutral">
                    <UserPlus size={20} color={colors.text} strokeWidth={2.25} />
                  </IconBadge>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle}>{t("settings.team.pendingInvitesTitle")}</Text>
                    <Text style={styles.sectionBody}>
                      {t(
                        canManage
                          ? "settings.team.pendingInvitesBody"
                          : "settings.team.pendingInvitesReadOnlyBody",
                        { count: formatNumber(pendingInvites.length) }
                      )}
                    </Text>
                  </View>
                </View>

                {pendingInvites.length === 0 ? (
                  <Text style={styles.helper}>{t("settings.team.pendingInvitesEmpty")}</Text>
                ) : (
                  <View style={styles.memberList}>
                    {pendingInvites.map((invite) => (
                      <View key={invite.id} style={styles.memberCard}>
                        <View style={styles.memberHeader}>
                          <View style={styles.memberCopy}>
                            <Text style={styles.memberName}>{invite.email}</Text>
                            <Text style={styles.memberMeta}>
                              {t("settings.team.status.invited")} · {roleLabel(invite.role, t)}
                            </Text>
                          </View>
                          <Badge label={t("settings.team.status.invited")} tone="caution" />
                        </View>
                        {canManage && canActorRevokeMemberInvite(role, invite.role) ? (
                          <Button
                            title={t("settings.team.action.revokeInvite")}
                            variant="secondary"
                            onPress={() => void revokeInvite(invite)}
                            disabled={Boolean(busyKey)}
                          />
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </SectionSurface>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function roleLabel(role: RestaurantRole, t: (key: MessageKey) => string) {
  switch (role) {
    case "owner":
      return t("settings.role.owner");
    case "admin":
      return t("settings.role.admin");
    case "manager":
      return t("settings.role.manager");
    case "staff":
      return t("settings.role.staff");
  }
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  sectionHeading: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start"
  },
  sectionCopy: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.text
  },
  sectionBody: {
    ...typography.body,
    color: colors.muted
  },
  memberList: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  memberCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  memberMeta: {
    ...typography.caption,
    color: colors.muted
  },
  memberActions: {
    gap: spacing.sm
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  label: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.body
  },
  roleControl: {
    marginVertical: spacing.sm
  },
  helper: {
    ...typography.caption,
    color: colors.muted
  },
  readOnlyNote: {
    paddingHorizontal: spacing.xs
  },
  createdInvite: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  path: {
    ...typography.caption,
    color: colors.text
  }
});

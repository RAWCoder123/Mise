import { router } from "expo-router";
import {
  BarChart3,
  ClipboardList,
  HelpCircle,
  Mail,
  PackageSearch,
  ScanLine,
  Settings,
  Sparkles,
  Truck,
  UsersRound
} from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionTile, ActionTileGrid } from "../../components/ui/ActionTile";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { colors, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import type { RestaurantRole } from "../../types/mise";

const roleKeys: Record<RestaurantRole, MessageKey> = {
  owner: "settings.role.owner",
  admin: "settings.role.admin",
  manager: "settings.role.manager",
  staff: "settings.role.staff"
};

export default function MoreScreen() {
  const { t } = useLocale();
  const { restaurant, role, user } = useMiseSession();
  const initials = initialsFor(user?.name || user?.email || "Mise");

  return (
    <Screen
      title={t("nav.more")}
      subtitle={restaurant ? `${restaurant.name} · ${t("more.subtitle")}` : t("more.subtitle")}
    >
      <View style={styles.stack}>
        <ActionTileGrid columns={4} accessibilityLabel={t("more.shortcuts.accessibility")}>
          <ActionTile
            compact
            label={t("more.shortcut.createTask")}
            accessibilityLabel={t("more.shortcut.createTaskHint")}
            icon={<ClipboardList size={15} color={colors.accentDark} strokeWidth={2.2} />}
            onPress={() => router.push("/today")}
          />
          <ActionTile
            compact
            label={t("more.shortcut.logDelivery")}
            accessibilityLabel={t("more.shortcut.logDeliveryHint")}
            icon={<Truck size={15} color={colors.text} strokeWidth={2.2} />}
            onPress={() => router.push("/inventory")}
          />
          <ActionTile
            compact
            label={t("more.shortcut.scanItem")}
            accessibilityLabel={t("more.shortcut.scanItemHint")}
            icon={<ScanLine size={15} color={colors.text} strokeWidth={2.2} />}
            onPress={() => router.push("/inventory")}
          />
          <ActionTile
            compact
            label={t("more.shortcut.askMise")}
            accessibilityLabel={t("more.shortcut.askMiseHint")}
            icon={<Sparkles size={15} color={colors.accentDark} strokeWidth={2.2} />}
            onPress={() => router.push("/ask-mise")}
          />
        </ActionTileGrid>

        <View style={styles.listGroup}>
          <Text style={styles.listLabel}>{t("more.section.operations")}</Text>
          <View style={styles.list}>
            <OperationalRow
              title={t("nav.insights")}
              subtitle={t("more.row.insights.subtitle")}
              icon={<BarChart3 size={18} color={colors.text} strokeWidth={2.25} />}
              iconTone="neutral"
              onPress={() => router.push("/insights")}
            />
            <OperationalRow
              title={t("more.row.integrations.title")}
              subtitle={t("more.row.integrations.subtitle")}
              icon={<Mail size={18} color={colors.accentDark} strokeWidth={2.25} />}
              iconTone="brand"
              onPress={() => router.push("/settings/gmail")}
            />
            <OperationalRow
              title={t("more.row.suppliers.title")}
              subtitle={t("more.row.suppliers.subtitle")}
              icon={<Truck size={18} color={colors.text} strokeWidth={2.25} />}
              iconTone="neutral"
              onPress={() => router.push("/settings/suppliers")}
            />
            <OperationalRow
              title={t("nav.settings")}
              subtitle={t("more.row.settings.subtitle")}
              icon={<Settings size={18} color={colors.text} strokeWidth={2.25} />}
              iconTone="neutral"
              onPress={() => router.push("/settings")}
            />
          </View>
        </View>

        <View style={styles.listGroup}>
          <Text style={styles.listLabel}>{t("more.section.team")}</Text>
          <View style={styles.list}>
            <OperationalRow
              title={t("more.row.team.title")}
              subtitle={t("more.row.team.body")}
              icon={<UsersRound size={18} color={colors.text} strokeWidth={2.25} />}
              iconTone="neutral"
              onPress={() => router.push("/settings/team" as never)}
            />
            <OperationalRow
              title={t("more.row.help.title")}
              subtitle={t("more.row.help.body")}
              icon={<HelpCircle size={18} color={colors.muted} strokeWidth={2.25} />}
              iconTone="neutral"
            />
            <OperationalRow
              title={t("more.row.report.title")}
              subtitle={t("more.row.report.body")}
              icon={<PackageSearch size={18} color={colors.muted} strokeWidth={2.25} />}
              iconTone="neutral"
              onPress={() => router.push("/insights")}
            />
          </View>
        </View>

        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{user?.name?.trim() || t("more.profile.fallbackName")}</Text>
            <Text style={styles.profileMeta}>
              {role ? t(roleKeys[role]) : t("settings.account.operator")}
              {user?.email?.trim() ? ` · ${user.email.trim()}` : ""}
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  listGroup: {
    gap: 6
  },
  listLabel: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  profileRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft
  },
  avatarText: {
    color: colors.accentDark,
    fontFamily: typography.families.bold,
    fontSize: 13,
    lineHeight: 16
  },
  profileCopy: {
    flex: 1,
    minWidth: 0
  },
  profileName: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 14,
    lineHeight: 18
  },
  profileMeta: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1
  }
});

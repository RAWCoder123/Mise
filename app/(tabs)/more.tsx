import { router } from "expo-router";
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Mail,
  ScanLine,
  Settings,
  Truck,
  UsersRound
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionTile, ActionTileGrid } from "../../components/ui/ActionTile";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { colors, radii, typography } from "../../constants/theme";
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
  const { role, user } = useMiseSession();
  const initials = initialsFor(user?.name || user?.email || "Mise");

  return (
    <Screen title={t("nav.more")} titleAlign="left">
      <View style={styles.stack}>
        <Text style={styles.shortcutsLabel}>{t("more.shortcuts.title")}</Text>
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
            label={t("more.shortcut.dailyReport")}
            accessibilityLabel={t("more.shortcut.dailyReportHint")}
            icon={<BarChart3 size={15} color={colors.accentDark} strokeWidth={2.2} />}
            onPress={() => router.push("/insights")}
          />
        </ActionTileGrid>

        <View style={styles.list}>
          <OperationalRow
            title={t("more.row.team.title")}
            icon={<UsersRound size={18} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/settings/team" as never)}
          />
          <OperationalRow
            title={t("nav.insights")}
            icon={<BarChart3 size={18} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/insights")}
          />
          <OperationalRow
            title={t("more.row.integrations.title")}
            icon={<Mail size={18} color={colors.accentDark} strokeWidth={2.25} />}
            iconTone="brand"
            onPress={() => router.push("/settings/gmail")}
          />
          <OperationalRow
            title={t("more.row.suppliers.title")}
            icon={<Truck size={18} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/settings/suppliers")}
          />
          <OperationalRow
            title={t("nav.settings")}
            icon={<Settings size={18} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/settings")}
          />
          <OperationalRow
            title={t("more.row.help.title")}
            icon={<HelpCircle size={18} color={colors.muted} strokeWidth={2.25} />}
            iconTone="neutral"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("more.profile.open")}
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{user?.name?.trim() || t("more.profile.fallbackName")}</Text>
            <Text style={styles.profileMeta}>{role ? t(roleKeys[role]) : t("settings.account.operator")}</Text>
          </View>
          <ChevronRight size={16} color={colors.faint} strokeWidth={2.25} />
        </Pressable>
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
    gap: 12
  },
  shortcutsLabel: {
    color: colors.text,
    ...typography.sectionTitle
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  profileRow: {
    minHeight: 56,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
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
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1
  },
  pressed: {
    opacity: 0.72
  }
});

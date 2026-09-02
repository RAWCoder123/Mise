import { router } from "expo-router";
import {
  Activity,
  BarChart3,
  Brain,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Mail,
  PackageMinus,
  ScanLine,
  Settings,
  Sunrise,
  Truck,
  Undo2,
  UsersRound
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionTile, ActionTileGrid } from "../../components/ui/ActionTile";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { colors, conceptTypography, density, icon, iconStroke, radii } from "../../constants/theme";
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
        <SectionHeader title={t("more.shortcuts.title")} />
        <ActionTileGrid columns={4} accessibilityLabel={t("more.shortcuts.accessibility")}>
          <ActionTile
            compact
            label={t("more.shortcut.createTask")}
            accessibilityLabel={t("more.shortcut.createTaskHint")}
            icon={<ClipboardList size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/create-task")}
          />
          <ActionTile
            compact
            label={t("more.shortcut.logDelivery")}
            accessibilityLabel={t("more.shortcut.logDeliveryHint")}
            icon={<Truck size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/log-delivery")}
          />
          <ActionTile
            compact
            label={t("more.shortcut.scanItem")}
            accessibilityLabel={t("more.shortcut.scanItemHint")}
            icon={<ScanLine size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/scan-item")}
          />
          <ActionTile
            compact
            label={t("more.shortcut.dailyReport")}
            accessibilityLabel={t("more.shortcut.dailyReportHint")}
            icon={<BarChart3 size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/daily-report")}
          />
        </ActionTileGrid>

        <View style={styles.section}>
          <SectionHeader title={t("more.section.operations")} />
          <View style={styles.list}>
          <OperationalRow
            density="menu"
            title={t("more.row.dailyBrief.title")}
            icon={<Sunrise size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/daily-brief" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("more.row.waste.title")}
            icon={<PackageMinus size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/waste" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("more.row.receiptCorrect.title")}
            icon={<Undo2 size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/receipt-correct" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("more.row.activity.title")}
            icon={<Activity size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/activity" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("more.row.memory.title")}
            icon={<Brain size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/more/restaurant-memory" as never)}
          />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t("more.section.team")} />
          <View style={styles.list}>
          <OperationalRow
            density="menu"
            title={t("more.row.team.title")}
            icon={<UsersRound size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings/team" as never)}
          />
          <OperationalRow
            density="menu"
            title={t("nav.insights")}
            icon={<BarChart3 size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/insights")}
          />
          <OperationalRow
            density="menu"
            title={t("more.row.integrations.title")}
            icon={<Mail size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings/gmail")}
          />
          <OperationalRow
            density="menu"
            title={t("more.row.suppliers.title")}
            icon={<Truck size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings/suppliers")}
          />
          <OperationalRow
            density="menu"
            title={t("nav.settings")}
            icon={<Settings size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings")}
          />
          <OperationalRow
            density="menu"
            title={t("more.row.help.title")}
            icon={<HelpCircle size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            onPress={() => router.push("/settings/support" as never)}
          />
          </View>
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
          <ChevronRight size={density.chevron} color={colors.faint} strokeWidth={iconStroke} />
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
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  section: {
    gap: 4
  },
  profileRow: {
    minHeight: density.profileRow,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    fontFamily: conceptTypography.rowTitle.fontFamily,
    fontSize: 12,
    lineHeight: 15
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  profileName: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  profileMeta: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: conceptTypography.body.fontFamily,
    marginTop: 2
  },
  pressed: {
    opacity: 0.72
  }
});

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
import { SectionSurface } from "../../components/ui/SectionSurface";
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
        <SectionSurface padding="comfortable">
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{user?.name?.trim() || t("more.profile.fallbackName")}</Text>
              <Text style={styles.profileMeta}>{role ? t(roleKeys[role]) : t("settings.account.operator")}</Text>
              <Text style={styles.profileEmail}>{user?.email?.trim() || t("settings.account.emailMissing")}</Text>
            </View>
          </View>
        </SectionSurface>

        <ActionTileGrid accessibilityLabel={t("more.shortcuts.accessibility")}>
          <ActionTile
            label={t("more.shortcut.createTask")}
            accessibilityLabel={t("more.shortcut.createTaskHint")}
            icon={<ClipboardList size={17} color={colors.accentDark} strokeWidth={2.2} />}
            onPress={() => router.push("/today")}
          />
          <ActionTile
            label={t("more.shortcut.logDelivery")}
            accessibilityLabel={t("more.shortcut.logDeliveryHint")}
            icon={<Truck size={17} color={colors.text} strokeWidth={2.2} />}
            onPress={() => router.push("/inventory")}
          />
          <ActionTile
            label={t("more.shortcut.scanItem")}
            accessibilityLabel={t("more.shortcut.scanItemHint")}
            icon={<ScanLine size={17} color={colors.text} strokeWidth={2.2} />}
            onPress={() => router.push("/inventory")}
          />
          <ActionTile
            label={t("more.shortcut.askMise")}
            accessibilityLabel={t("more.shortcut.askMiseHint")}
            icon={<Sparkles size={17} color={colors.accentDark} strokeWidth={2.2} />}
            onPress={() => router.push("/ask-mise")}
          />
        </ActionTileGrid>

        <SectionSurface title={t("more.section.operations")} padding="none">
          <OperationalRow
            title={t("nav.insights")}
            subtitle={t("more.row.insights.subtitle")}
            icon={<BarChart3 size={20} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/insights")}
          />
          <OperationalRow
            title={t("more.row.integrations.title")}
            subtitle={t("more.row.integrations.subtitle")}
            icon={<Mail size={20} color={colors.accentDark} strokeWidth={2.25} />}
            iconTone="brand"
            onPress={() => router.push("/settings/gmail")}
          />
          <OperationalRow
            title={t("more.row.suppliers.title")}
            subtitle={t("more.row.suppliers.subtitle")}
            icon={<Truck size={20} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/settings/suppliers")}
          />
          <OperationalRow
            title={t("nav.settings")}
            subtitle={t("more.row.settings.subtitle")}
            icon={<Settings size={20} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/settings")}
          />
        </SectionSurface>

        <SectionSurface title={t("more.section.team")} padding="none">
          <OperationalRow
            title={t("more.row.team.title")}
            subtitle={t("more.row.team.body")}
            icon={<UsersRound size={20} color={colors.text} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/settings/team" as never)}
          />
          <OperationalRow
            title={t("more.row.help.title")}
            subtitle={t("more.row.help.body")}
            icon={<HelpCircle size={20} color={colors.muted} strokeWidth={2.25} />}
            iconTone="neutral"
          />
          <OperationalRow
            title={t("more.row.report.title")}
            subtitle={t("more.row.report.body")}
            icon={<PackageSearch size={20} color={colors.muted} strokeWidth={2.25} />}
            iconTone="neutral"
            onPress={() => router.push("/insights")}
          />
        </SectionSurface>
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
    gap: 14
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  avatarText: {
    color: colors.accentDark,
    fontFamily: typography.families.bold,
    fontSize: 19,
    lineHeight: 24
  },
  profileCopy: {
    flex: 1,
    minWidth: 0
  },
  profileName: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 18,
    lineHeight: 23
  },
  profileMeta: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  profileEmail: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1
  }
});

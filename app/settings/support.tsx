import { router, useNavigation } from "expo-router";
import { ArrowLeft, LifeBuoy } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";

export default function SupportSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { restaurant, user } = useMiseSession();

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  if (!user) {
    return (
      <Screen
        title={t("support.title")}
        subtitle={t("support.subtitle")}
        action={
          <ActionIcon accessibilityLabel={t("support.backToSettings")} onPress={goBackToSettings}>
            <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
          </ActionIcon>
        }
      >
        <StatusNotice tone="caution" title={t("support.signedOut.title")} message={t("support.signedOut.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("support.title")}
      subtitle={restaurant ? t("support.subtitleRestaurant", { restaurant: restaurant.name }) : t("support.subtitle")}
      action={
        <ActionIcon accessibilityLabel={t("support.backToSettings")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <StatusNotice tone="caution" title={t("support.beta.title")} message={t("support.beta.body")} />

        <Card>
          <View style={styles.hero}>
            <IconBadge tone="brand">
              <LifeBuoy size={20} color={colors.accentDark} strokeWidth={2.25} />
            </IconBadge>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t("support.summary.title")}</Text>
              <Text style={styles.heroBody}>{t("support.summary.body")}</Text>
            </View>
          </View>
        </Card>

        <InfoBlock title={t("support.section.available")} body={t("support.section.availableBody")} />
        <InfoBlock title={t("support.section.disabled")} body={t("support.section.disabledBody")} />
        <InfoBlock title={t("support.section.contact")} body={t("support.section.contactBody")} />

        <Button
          title={t("support.action.openPrivacy")}
          variant="secondary"
          onPress={() => router.push("/settings/privacy" as never)}
          fullWidth
        />
        <Button
          title={t("support.action.openExport")}
          variant="ghost"
          onPress={() => router.push("/settings/export" as never)}
          fullWidth
        />
        <Button
          title={t("support.action.openAccount")}
          variant="ghost"
          onPress={goBackToSettings}
          fullWidth
          accessibilityHint={t("support.action.openAccountHint")}
        />
      </View>
    </Screen>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  hero: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroCopy: { flex: 1, minWidth: 0, gap: 6 },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 17,
    lineHeight: 22
  },
  heroBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 20
  },
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    padding: 14,
    gap: 6
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 14,
    lineHeight: 18
  },
  sectionBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 19
  }
});

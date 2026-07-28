import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";

const PRIVACY_POLICY_URL = "https://getmise.app/privacy";

export default function PrivacySettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { restaurant, user } = useMiseSession();
  const [linkError, setLinkError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function openPrivacyPolicyUrl() {
    if (opening) return;
    setOpening(true);
    setLinkError(null);
    try {
      const canOpen = await Linking.canOpenURL(PRIVACY_POLICY_URL);
      if (!canOpen) {
        setLinkError(t("privacy.link.unavailable"));
        return;
      }
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      setLinkError(t("privacy.link.unavailable"));
    } finally {
      setOpening(false);
    }
  }

  if (!user) {
    return (
      <Screen
        title={t("privacy.title")}
        subtitle={t("privacy.subtitle")}
        action={
          <ActionIcon accessibilityLabel={t("privacy.backToSettings")} onPress={goBackToSettings}>
            <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
          </ActionIcon>
        }
      >
        <StatusNotice tone="caution" title={t("privacy.signedOut.title")} message={t("privacy.signedOut.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("privacy.title")}
      subtitle={restaurant ? t("privacy.subtitleRestaurant", { restaurant: restaurant.name }) : t("privacy.subtitle")}
      action={
        <ActionIcon accessibilityLabel={t("privacy.backToSettings")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <StatusNotice tone="caution" title={t("privacy.beta.title")} message={t("privacy.beta.body")} />
        <StatusNotice
          tone="caution"
          title={t("privacy.hosting.title")}
          message={t("privacy.hosting.body")}
        />

        <Card>
          <View style={styles.hero}>
            <IconBadge tone="leaf">
              <ShieldCheck size={20} color={colors.success} strokeWidth={2.25} />
            </IconBadge>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t("privacy.summary.title")}</Text>
              <Text style={styles.heroBody}>{t("privacy.summary.body")}</Text>
            </View>
          </View>
        </Card>

        <PolicySection title={t("privacy.section.collect")} body={t("privacy.section.collectBody")} />
        <PolicySection title={t("privacy.section.notActive")} body={t("privacy.section.notActiveBody")} />
        <PolicySection title={t("privacy.section.storage")} body={t("privacy.section.storageBody")} />
        <PolicySection title={t("privacy.section.rights")} body={t("privacy.section.rightsBody")} />
        <PolicySection title={t("privacy.section.contact")} body={t("privacy.section.contactBody")} />

        {linkError ? <StatusNotice tone="danger" title={t("privacy.link.errorTitle")} message={linkError} /> : null}

        <Button
          title={t("privacy.action.openPolicyUrl")}
          accessibilityLabel={t("privacy.action.openPolicyUrlAccessibility")}
          accessibilityHint={t("privacy.action.openPolicyUrlHint")}
          icon={<ExternalLink size={17} color={colors.surface} strokeWidth={2.5} />}
          onPress={() => void openPrivacyPolicyUrl()}
          disabled={opening}
          fullWidth
        />
        <Button
          title={t("privacy.action.openSupport")}
          variant="secondary"
          onPress={() => router.push("/settings/support" as never)}
          fullWidth
        />
        <Button
          title={t("privacy.action.openExport")}
          variant="ghost"
          onPress={() => router.push("/settings/export" as never)}
          fullWidth
        />
      </View>
    </Screen>
  );
}

function PolicySection({ title, body }: { title: string; body: string }) {
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

import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, ExternalLink, LifeBuoy, Mail } from "lucide-react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { readPublicAppConfig } from "../../lib/appConfig";

const SUPPORT_MAILTO = "mailto:support@getmise.app?subject=Mise%20beta%20support";
const PRIVACY_MAILTO = "mailto:privacy@getmise.app?subject=Mise%20beta%20privacy";

export default function SupportSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { restaurant, user } = useMiseSession();
  const supportUrl = useMemo(() => readPublicAppConfig().supportUrl, []);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const signedIn = Boolean(user);

  function goBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.replace(signedIn ? "/settings" : "/login");
  }

  async function openBoundedMailto(url: typeof SUPPORT_MAILTO | typeof PRIVACY_MAILTO) {
    if (opening) return;
    setOpening(true);
    setLinkError(null);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        setLinkError(t("support.link.unavailable"));
        return;
      }
      await Linking.openURL(url);
    } catch {
      setLinkError(t("support.link.unavailable"));
    } finally {
      setOpening(false);
    }
  }

  async function openSupportUrl() {
    if (opening || !supportUrl) return;
    setOpening(true);
    setLinkError(null);
    try {
      const canOpen = await Linking.canOpenURL(supportUrl);
      if (!canOpen) {
        setLinkError(t("support.link.urlUnavailable"));
        return;
      }
      await Linking.openURL(supportUrl);
    } catch {
      setLinkError(t("support.link.urlUnavailable"));
    } finally {
      setOpening(false);
    }
  }

  return (
    <Screen
      title={t("support.title")}
      subtitle={
        signedIn && restaurant
          ? t("support.subtitleRestaurant", { restaurant: restaurant.name })
          : t("support.subtitle")
      }
      action={
        <ActionIcon
          accessibilityLabel={t(signedIn ? "support.backToSettings" : "support.backToLogin")}
          onPress={goBack}
        >
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <StatusNotice tone="caution" title={t("support.beta.title")} message={t("support.beta.body")} />
        {supportUrl ? (
          <StatusNotice tone="caution" title={t("support.hosting.title")} message={t("support.hosting.body")} />
        ) : (
          <StatusNotice
            tone="caution"
            title={t("support.missing.title")}
            message={t("support.missing.body")}
          />
        )}
        <StatusNotice
          tone="caution"
          title={t("support.monitoring.title")}
          message={t("support.monitoring.body")}
        />

        <Card>
          <View style={styles.hero}>
            <IconBadge tone="brand">
              <LifeBuoy size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
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

        {linkError ? <StatusNotice tone="danger" title={t("support.link.errorTitle")} message={linkError} /> : null}

        <Button
          title={t("support.action.openSupportUrl")}
          accessibilityLabel={t("support.action.openSupportUrlAccessibility")}
          accessibilityHint={t("support.action.openSupportUrlHint")}
          icon={<ExternalLink size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
          onPress={() => void openSupportUrl()}
          disabled={opening || !supportUrl}
          fullWidth
        />
        <Button
          title={t("support.action.emailSupport")}
          variant="secondary"
          accessibilityLabel={t("support.action.emailSupportAccessibility")}
          accessibilityHint={t("support.action.emailSupportHint")}
          icon={<Mail size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
          onPress={() => void openBoundedMailto(SUPPORT_MAILTO)}
          disabled={opening}
          fullWidth
        />
        <Button
          title={t("support.action.emailPrivacy")}
          variant="secondary"
          accessibilityLabel={t("support.action.emailPrivacyAccessibility")}
          accessibilityHint={t("support.action.emailPrivacyHint")}
          icon={<Mail size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
          onPress={() => void openBoundedMailto(PRIVACY_MAILTO)}
          disabled={opening}
          fullWidth
        />
        <Button
          title={t("support.action.openPrivacy")}
          variant="ghost"
          onPress={() => router.push("/settings/privacy" as never)}
          fullWidth
        />
        {signedIn ? (
          <>
            <Button
              title={t("support.action.openExport")}
              variant="ghost"
              onPress={() => router.push("/settings/export" as never)}
              fullWidth
            />
            <Button
              title={t("support.action.openAccount")}
              variant="ghost"
              onPress={goBack}
              fullWidth
              accessibilityHint={t("support.action.openAccountHint")}
            />
          </>
        ) : null}
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
    backgroundColor: colors.surface,
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

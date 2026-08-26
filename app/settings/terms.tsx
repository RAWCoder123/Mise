import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react-native";

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

export default function TermsSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { restaurant, user } = useMiseSession();
  const termsUrl = useMemo(() => readPublicAppConfig().termsUrl, []);
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

  async function openTermsUrl() {
    if (opening || !termsUrl) return;
    setOpening(true);
    setLinkError(null);
    try {
      const canOpen = await Linking.canOpenURL(termsUrl);
      if (!canOpen) {
        setLinkError(t("terms.link.unavailable"));
        return;
      }
      await Linking.openURL(termsUrl);
    } catch {
      setLinkError(t("terms.link.unavailable"));
    } finally {
      setOpening(false);
    }
  }

  return (
    <Screen
      title={t("terms.title")}
      subtitle={
        signedIn && restaurant
          ? t("terms.subtitleRestaurant", { restaurant: restaurant.name })
          : t("terms.subtitle")
      }
      action={
        <ActionIcon
          accessibilityLabel={t(signedIn ? "terms.backToSettings" : "terms.backToLogin")}
          onPress={goBack}
        >
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <StatusNotice tone="caution" title={t("terms.beta.title")} message={t("terms.beta.body")} />
        {termsUrl ? (
          <StatusNotice tone="caution" title={t("terms.hosting.title")} message={t("terms.hosting.body")} />
        ) : (
          <StatusNotice
            tone="caution"
            title={t("terms.missing.title")}
            message={t("terms.missing.body")}
          />
        )}

        <Card>
          <View style={styles.hero}>
            <IconBadge tone="neutral">
              <FileText size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
            </IconBadge>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t("terms.summary.title")}</Text>
              <Text style={styles.heroBody}>{t("terms.summary.body")}</Text>
            </View>
          </View>
        </Card>

        <PolicySection title={t("terms.section.scope")} body={t("terms.section.scopeBody")} />
        <PolicySection title={t("terms.section.orders")} body={t("terms.section.ordersBody")} />
        <PolicySection title={t("terms.section.contact")} body={t("terms.section.contactBody")} />

        {linkError ? <StatusNotice tone="danger" title={t("terms.link.errorTitle")} message={linkError} /> : null}

        <Button
          title={t("terms.action.openTermsUrl")}
          accessibilityLabel={t("terms.action.openTermsUrlAccessibility")}
          accessibilityHint={t("terms.action.openTermsUrlHint")}
          icon={<ExternalLink size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
          onPress={() => void openTermsUrl()}
          disabled={opening || !termsUrl}
          fullWidth
        />
        <Button
          title={t("terms.action.openPrivacy")}
          variant="secondary"
          onPress={() => router.push("/settings/privacy" as never)}
          fullWidth
        />
        <Button
          title={t("terms.action.openSupport")}
          variant="ghost"
          onPress={() => router.push("/settings/support" as never)}
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

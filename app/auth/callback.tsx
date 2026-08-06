import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../components/ui/Screen";
import { colors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { createSessionFromUrl, isMiseAuthCallbackUrl } from "../../lib/authOAuth";
import { captureMiseError } from "../../services/telemetry";

export default function AuthCallbackScreen() {
  const { t } = useLocale();
  const { ready, restaurant, user } = useMiseSession();
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function complete() {
      try {
        const url =
          typeof window !== "undefined" && typeof window.location?.href === "string"
            ? window.location.href
            : await Linking.getInitialURL();

        if (url && isMiseAuthCallbackUrl(url)) {
          await createSessionFromUrl(url);
        }
      } catch (callbackError) {
        captureMiseError(callbackError, { flow: "oauth", operation: "auth_callback_screen" });
        if (mounted) setError(true);
      }
    }

    void complete();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (restaurant) {
      router.replace("/home");
      return;
    }
    if (user) {
      router.replace("/setup");
      return;
    }
    if (error) {
      router.replace("/login");
    }
  }, [error, ready, restaurant, user]);

  return (
    <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading={!error}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t("login.error.oauth")}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    padding: 16
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  }
});

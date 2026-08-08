import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useNavigation } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { exportRestaurantData } from "../../services/miseService";
import { canDeleteRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

type ExportNotice = {
  tone: "success" | "caution" | "warning" | "danger";
  title: string;
  body: string;
};

export default function RestaurantExportScreen() {
  const navigation = useNavigation();
  const { formatDate, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<ExportNotice | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  const exportLockRef = useRef(false);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canExport = Boolean(restaurant) && canDeleteRestaurantData(memberships, restaurant?.id);

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(restaurant?.id ?? null);
    setNotice(null);
    setExporting(false);
    exportLockRef.current = false;
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoadedRestaurantId(restaurant?.id ?? null);
    }, [restaurant?.id])
  );

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function runExport() {
    if (!restaurant || !canExport || exportLockRef.current || exporting) return;

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    exportLockRef.current = true;
    setExporting(true);
    setNotice(null);

    try {
      const payload = await exportRestaurantData(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;

      const stamp = formatExportDate(payload.generatedAt || new Date().toISOString(), formatDate);
      const filename = `mise-restaurant-export-${stamp}.json`;
      const serialized = JSON.stringify(payload);

      if (Platform.OS === "web") {
        downloadJsonOnWeb(serialized, filename);
        if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
        setNotice({
          tone: "success",
          title: t("export.notice.successTitle"),
          body: t("export.notice.successBody", { filename })
        });
        return;
      }

      const directory = FileSystem.cacheDirectory;
      if (!directory) {
        setNotice({
          tone: "danger",
          title: t("export.notice.unavailableTitle"),
          body: t("export.notice.unavailableBody")
        });
        return;
      }

      const fileUri = `${directory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, serialized);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (!sharingAvailable) {
        setNotice({
          tone: "caution",
          title: t("export.notice.sharingUnavailableTitle"),
          body: t("export.notice.sharingUnavailableBody", { filename })
        });
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: t("export.share.dialogTitle"),
        UTI: "public.json"
      });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "success",
        title: t("export.notice.successTitle"),
        body: t("export.notice.successBody", { filename })
      });
    } catch (exportError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(exportError, {
        flow: "settings",
        operation: "restaurant_export",
        restaurant_id: restaurantId
      });
      setNotice(noticeForExportError(exportError, t));
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        exportLockRef.current = false;
        setExporting(false);
      }
    }
  }

  const visibleRestaurantId = loadedRestaurantId === restaurant?.id ? restaurant?.id ?? null : null;

  return (
    <Screen
      title={t("export.title")}
      subtitle={t("export.subtitle")}
      action={
        <ActionIcon accessibilityLabel={t("export.backToSettings")} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        {!canExport || !visibleRestaurantId ? (
          <StatusNotice
            tone="caution"
            title={t("export.restricted.title")}
            message={t("export.restricted.body")}
          />
        ) : (
          <>
            <Card>
              <View style={styles.heroRow}>
                <IconBadge tone="brand">
                  <Download size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
                </IconBadge>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>{t("export.card.title")}</Text>
                  <Text style={styles.heroBody}>{t("export.card.body")}</Text>
                </View>
              </View>
              <View style={styles.retentionBox}>
                <ShieldCheck size={icon.row} color={colors.success} strokeWidth={iconStroke} />
                <Text style={styles.retentionText}>{t("export.retention.body")}</Text>
              </View>
              <Button
                title={exporting ? t("export.action.exporting") : t("export.action.export")}
                accessibilityHint={t("export.action.hint")}
                icon={<Download size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
                onPress={() => void runExport()}
                disabled={exporting}
                fullWidth
                style={styles.exportButton}
              />
            </Card>

            {notice ? (
              <StatusNotice tone={notice.tone} title={notice.title} message={notice.body} />
            ) : null}

            {exporting ? (
              <StatusNotice
                tone="caution"
                title={t("export.progress.title")}
                message={t("export.progress.body")}
              />
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function formatExportDate(
  iso: string,
  formatDate: ReturnType<typeof useLocale>["formatDate"]
) {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return formatDate(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" })
      .replace(/[^\d]/g, "-")
      .replace(/^-|-$/g, "");
  }
  const date = new Date(parsed);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadJsonOnWeb(serialized: string, filename: string) {
  const blob = new Blob([serialized], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function noticeForExportError(
  error: unknown,
  t: ReturnType<typeof useLocale>["t"]
): ExportNotice {
  const message = error instanceof Error ? error.message : "";
  if (/too large|exceeded the supported in-app size|in-app delivery/i.test(message)) {
    return {
      tone: "warning",
      title: t("export.notice.oversizedTitle"),
      body: t("export.notice.oversizedBody")
    };
  }
  if (/sharing|unavailable/i.test(message)) {
    return {
      tone: "caution",
      title: t("export.notice.sharingUnavailableTitle"),
      body: t("export.notice.sharingUnavailableBody", { filename: "mise-restaurant-export.json" })
    };
  }
  return {
    tone: "danger",
    title: t("export.notice.failureTitle"),
    body: t("export.notice.failureBody")
  };
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroCopy: { flex: 1, minWidth: 0, gap: 6 },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 18,
    lineHeight: 24
  },
  heroBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 20
  },
  retentionBox: {
    marginTop: 14,
    borderRadius: radii.md,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  retentionText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 18
  },
  exportButton: { marginTop: 16 }
});

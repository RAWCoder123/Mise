import { useEffect, useMemo, useRef, useState } from "react";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { DEMO_SETUP_POS_SALES_PLACEHOLDER } from "../../services/demo/demoSetupData";
import {
  saveRestaurantSetup,
  validateImportedPosSalesRows
} from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

export default function SalesImportScreen() {
  const navigation = useNavigation();
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [csvText, setCsvText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRows, setSuccessRows] = useState<number | null>(null);
  const submitLockRef = useRef(false);
  const importRequestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canImport = Boolean(restaurant) && canManageRestaurantData(memberships, restaurant?.id);
  const parsed = useMemo(() => validateImportedPosSalesRows(csvText), [csvText]);
  const issuePreview = parsed.issues.slice(0, 3);
  const rejectedPreviewCount = Math.max(0, parsed.rejectedRowCount);

  useEffect(() => {
    importRequestIdRef.current += 1;
    submitLockRef.current = false;
    setCsvText("");
    setSaving(false);
    setError(null);
    setSuccessRows(null);
  }, [restaurant?.id]);

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function importSales() {
    if (!restaurant || !canImport || submitLockRef.current || saving) return;
    if (parsed.acceptedRowCount === 0) {
      setError(t("salesImport.error.noRows"));
      setSuccessRows(null);
      return;
    }
    if (parsed.issues.length > 0) {
      setError(
        t(
          parsed.issues.length === 1
            ? "salesImport.error.issues.one"
            : "salesImport.error.issues.other",
          { count: formatNumber(parsed.issues.length) }
        )
      );
      setSuccessRows(null);
      return;
    }

    const restaurantId = restaurant.id;
    const requestId = ++importRequestIdRef.current;
    submitLockRef.current = true;
    setSaving(true);
    setError(null);
    setSuccessRows(null);
    try {
      // Empty inventory/supplier/recipe arrays upsert nothing; POS rows append by
      // (restaurant_id, source_pos, source_record_id) without wiping existing setup.
      const summary = await saveRestaurantSetup(restaurantId, {
        inventoryItems: [],
        suppliers: [],
        recipes: [],
        posSales: parsed.rows,
        attachments: []
      });
      if (
        requestId !== importRequestIdRef.current ||
        activeRestaurantIdRef.current !== restaurantId
      ) {
        return;
      }
      setSuccessRows(summary.posSalesRowsSaved);
      setCsvText("");
    } catch (importError) {
      captureMiseError(importError, {
        flow: "settings",
        operation: "sales_csv_import",
        restaurant_id: restaurantId
      });
      if (
        requestId !== importRequestIdRef.current ||
        activeRestaurantIdRef.current !== restaurantId
      ) {
        return;
      }
      setError(t("salesImport.error.save"));
    } finally {
      if (requestId === importRequestIdRef.current) {
        submitLockRef.current = false;
        setSaving(false);
      }
    }
  }

  return (
    <Screen
      title={t("salesImport.title")}
      subtitle={t("salesImport.subtitle")}
      action={
        <ActionIcon accessibilityLabel={t("salesImport.backToSettings")} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <OperationalHero
          eyebrow={t("salesImport.hero.eyebrow")}
          title={t("salesImport.hero.title")}
          body={t("salesImport.hero.body")}
          meta={restaurant?.name ?? t("common.notSet")}
          tone="leaf"
          icon={<Upload size={icon.emphasis} color={colors.success} strokeWidth={iconStroke} />}
          stats={[
            {
              label: t("salesImport.stat.ready"),
              value: formatNumber(parsed.acceptedRowCount),
              tone: parsed.acceptedRowCount > 0 ? "leaf" : "neutral"
            },
            {
              label: t("salesImport.stat.issues"),
              value: formatNumber(parsed.issues.length),
              tone: parsed.issues.length > 0 ? "danger" : "neutral"
            }
          ]}
        />

        {!restaurant ? (
          <StatusNotice
            tone="caution"
            title={t("salesImport.missingRestaurant.title")}
            message={t("salesImport.missingRestaurant.body")}
          />
        ) : !canImport ? (
          <StatusNotice
            tone="caution"
            title={t("salesImport.restricted.title")}
            message={t("salesImport.restricted.body")}
          />
        ) : null}

        {successRows != null ? (
          <StatusNotice
            tone="success"
            title={t(
              successRows === 1 ? "salesImport.success.one" : "salesImport.success.other",
              { count: formatNumber(successRows) }
            )}
            message={t("salesImport.success.body")}
          />
        ) : null}

        {error ? (
          <StatusNotice tone="danger" title={t("salesImport.error.title")} message={error} />
        ) : null}

        <Card>
          <View style={styles.pasteHeader}>
            <IconBadge tone="neutral">
              <FileSpreadsheet size={icon.row} color={colors.text} strokeWidth={iconStroke} />
            </IconBadge>
            <View style={styles.pasteCopy}>
              <Text style={styles.pasteTitle}>{t("salesImport.paste.title")}</Text>
              <Text style={styles.pasteDetail}>{t("salesImport.paste.format")}</Text>
            </View>
          </View>
          <TextInput
            accessibilityLabel={t("salesImport.paste.accessibility")}
            accessibilityHint={t("salesImport.paste.hint")}
            value={csvText}
            onChangeText={(value) => {
              setCsvText(value);
              setError(null);
              setSuccessRows(null);
            }}
            style={styles.textArea}
            multiline
            editable={canImport && !saving}
            textAlignVertical="top"
            placeholder={DEMO_SETUP_POS_SALES_PLACEHOLDER}
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {parsed.acceptedRowCount > 0 ? (
            <Text style={styles.readyCopy}>
              {t(
                parsed.acceptedRowCount === 1
                  ? "salesImport.ready.one"
                  : "salesImport.ready.other",
                { count: formatNumber(parsed.acceptedRowCount) }
              )}
            </Text>
          ) : (
            <Text style={styles.readyCopy}>{t("salesImport.ready.empty")}</Text>
          )}
          {rejectedPreviewCount > 0 ? (
            <Text style={styles.issueCopy}>
              {t(
                rejectedPreviewCount === 1
                  ? "salesImport.rejected.one"
                  : "salesImport.rejected.other",
                { count: formatNumber(rejectedPreviewCount) }
              )}
            </Text>
          ) : null}
          {issuePreview.map((issue) => (
            <Text key={`${issue.row}_${issue.field}`} style={styles.issueCopy}>
              {t("salesImport.issue", {
                row: formatNumber(issue.row),
                field: issue.field
              })}
            </Text>
          ))}
        </Card>

        <Button
          title={t(saving ? "salesImport.action.importing" : "salesImport.action.import")}
          onPress={() => void importSales()}
          disabled={
            !canImport ||
            saving ||
            parsed.acceptedRowCount === 0 ||
            parsed.issues.length > 0
          }
          accessibilityHint={t("salesImport.action.hint")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  pasteHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  pasteCopy: {
    flex: 1,
    gap: 4
  },
  pasteTitle: {
    ...typography.cardTitle,
    color: colors.text
  },
  pasteDetail: {
    ...typography.caption,
    color: colors.muted
  },
  textArea: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface
  },
  readyCopy: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.sm
  },
  issueCopy: {
    ...typography.caption,
    color: colors.accentDark,
    marginTop: spacing.xs
  }
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { ArrowLeft, Camera, Link2, Package, ScanLine, Search } from "lucide-react-native";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { matchInventoryBarcode } from "../../services/domain/inventoryBarcodeMatch";
import {
  captureInventoryItemSupplierSku,
  fetchInventoryBarcodeCatalog
} from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";
import type { InventoryItem, SupplierItem } from "../../types/mise";

const CAMERA_SUPPORTED = Platform.OS === "ios" || Platform.OS === "android";
const SCAN_COOLDOWN_MS = 1600;

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

function matchesQuery(item: InventoryItem, query: string, supplierItems: readonly SupplierItem[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const linkedSkus = supplierItems
    .filter(
      (entry) =>
        entry.inventory_item_id === item.id ||
        (entry.supplier_id === item.supplier_id &&
          entry.item_name.trim().toLowerCase() === item.item_name.trim().toLowerCase() &&
          entry.unit.trim().toLowerCase() === item.unit.trim().toLowerCase())
    )
    .map((entry) => entry.supplier_sku)
    .filter(Boolean);
  const haystack = [item.item_name, item.id, item.category, item.supplier_name, item.unit, ...linkedSkus]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export default function ScanItemScreen() {
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [query, setQuery] = useState("");
  const [barcodeMatches, setBarcodeMatches] = useState<InventoryItem[] | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState(false);
  const [capturingItemId, setCapturingItemId] = useState<string | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  const lastScanAtRef = useRef(0);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  const canCapture = canManageRestaurantData(memberships, restaurant?.id);

  useEffect(() => {
    requestIdRef.current += 1;
    setItems([]);
    setSupplierItems([]);
    setQuery("");
    setBarcodeMatches(null);
    setLastScannedCode(null);
    setCaptureMode(false);
    setCapturingItemId(null);
    setCaptureMessage(null);
    setCaptureError(false);
    setLoadedRestaurantId(null);
    setError(false);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const catalog = await fetchInventoryBarcodeCatalog(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setItems(catalog.inventoryItems);
      setSupplierItems(catalog.supplierItems);
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      setScanPaused(false);
    }, [load])
  );

  const visibleItems = loadedRestaurantId === restaurant?.id ? items : [];
  const visibleSupplierItems = loadedRestaurantId === restaurant?.id ? supplierItems : [];
  const searchMatches = useMemo(
    () =>
      visibleItems
        .filter((item) => matchesQuery(item, query, visibleSupplierItems))
        .slice(0, 40),
    [query, visibleItems, visibleSupplierItems]
  );

  const handleBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      const code = result.data?.trim() ?? "";
      if (!code || scanPaused) return;
      const now = Date.now();
      if (now - lastScanAtRef.current < SCAN_COOLDOWN_MS) return;
      lastScanAtRef.current = now;

      const { matches } = matchInventoryBarcode(code, visibleItems, {
        supplierItems: visibleSupplierItems
      });
      setLastScannedCode(code);
      setCaptureMode(false);
      setCaptureMessage(null);
      setCaptureError(false);

      if (matches.length === 1) {
        setScanPaused(true);
        setBarcodeMatches(null);
        router.push(`/inventory/${matches[0]!.id}`);
        return;
      }

      if (matches.length > 1) {
        setBarcodeMatches(matches);
        setQuery(code);
        return;
      }

      setBarcodeMatches([]);
      setQuery(code);
      if (canCapture) {
        setCaptureMode(true);
      }
    },
    [canCapture, scanPaused, visibleItems, visibleSupplierItems]
  );

  const linkBarcodeToItem = useCallback(
    async (item: InventoryItem) => {
      if (!restaurant || !lastScannedCode || !canCapture) return;
      const restaurantId = restaurant.id;
      const code = lastScannedCode;
      setCapturingItemId(item.id);
      setCaptureMessage(null);
      setCaptureError(false);
      try {
        const saved = await captureInventoryItemSupplierSku(restaurantId, item.id, code);
        if (activeRestaurantIdRef.current !== restaurantId) return;
        setSupplierItems((current) => {
          const without = current.filter((entry) => entry.id !== saved.id);
          return [...without, saved];
        });
        setCaptureMode(false);
        setBarcodeMatches(null);
        setScanPaused(true);
        setCaptureMessage(t("scanItem.capture.success", { item: item.item_name }));
        router.push(`/inventory/${item.id}`);
      } catch (caught) {
        if (activeRestaurantIdRef.current !== restaurantId) return;
        setCaptureError(true);
        setCaptureMessage(
          caught instanceof Error ? caught.message : t("scanItem.capture.error")
        );
      } finally {
        if (activeRestaurantIdRef.current === restaurantId) {
          setCapturingItemId(null);
        }
      }
    },
    [canCapture, lastScannedCode, restaurant, t]
  );

  if (!restaurant) {
    return (
      <Screen title={t("scanItem.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("scanItem.noRestaurant.body")} />
      </Screen>
    );
  }

  const showCamera = CAMERA_SUPPORTED && permission?.granted;
  const listItems = barcodeMatches && barcodeMatches.length > 0 ? barcodeMatches : searchMatches;
  const listTitle =
    captureMode && lastScannedCode
      ? t("scanItem.capture.pickTitle")
      : barcodeMatches && barcodeMatches.length > 1
        ? t("scanItem.barcode.multi", { count: formatNumber(barcodeMatches.length) })
        : query.trim()
          ? t("scanItem.results", { count: formatNumber(listItems.length) })
          : t("scanItem.allItems", { count: formatNumber(visibleItems.length) });

  return (
    <Screen
      title={t("scanItem.title")}
      subtitle={t("scanItem.subtitle")}
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
      keyboardAware
    >
      <View style={styles.stack}>
        {CAMERA_SUPPORTED ? (
          permission?.granted ? (
            <View style={styles.cameraFrame}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"]
                }}
                onBarcodeScanned={scanPaused ? undefined : handleBarcode}
              />
              <View style={styles.cameraOverlay} pointerEvents="none">
                <View style={styles.viewfinder} />
                <Text style={styles.cameraHint}>{t("scanItem.camera.hint")}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.permissionCard}>
              <Camera size={icon.emphasis} color={colors.accent} strokeWidth={iconStroke} />
              <Text style={styles.permissionTitle}>{t("scanItem.permission.title")}</Text>
              <Text style={styles.permissionBody}>{t("scanItem.permission.body")}</Text>
              <Button
                title={
                  permission?.canAskAgain === false
                    ? t("scanItem.permission.settings")
                    : t("scanItem.permission.allow")
                }
                onPress={() => void requestPermission()}
                icon={<Camera size={icon.inline} color={colors.surface} strokeWidth={iconStroke} />}
              />
            </View>
          )
        ) : (
          <StatusNotice
            tone="neutral"
            title={t("scanItem.web.title")}
            message={t("scanItem.web.body")}
          />
        )}

        {lastScannedCode && barcodeMatches?.length === 0 ? (
          <StatusNotice
            tone="warning"
            title={t("scanItem.barcode.noneTitle")}
            message={
              canCapture
                ? t("scanItem.barcode.noneBodyCapture", { code: lastScannedCode })
                : t("scanItem.barcode.noneBody", { code: lastScannedCode })
            }
          />
        ) : null}

        {captureMessage ? (
          <StatusNotice
            tone={captureError ? "danger" : "success"}
            title={captureError ? t("scanItem.capture.errorTitle") : t("scanItem.capture.successTitle")}
            message={captureMessage}
          />
        ) : null}

        {error ? (
          <RetryNotice
            title={t("scanItem.retry.title")}
            message={t("scanItem.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("scanItem.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        <SectionHeader title={t("scanItem.search.section")} />
        <View style={styles.searchWrap}>
          <Search size={icon.row} color={colors.muted} strokeWidth={iconStroke} />
          <TextInput
            accessibilityLabel={t("scanItem.search.accessibility")}
            placeholder={t("scanItem.search.placeholder")}
            placeholderTextColor={colors.faint}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setBarcodeMatches(null);
              if (!value.trim()) setCaptureMode(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={!showCamera}
            style={styles.searchInput}
          />
        </View>

        <SectionHeader title={listTitle} />

        {listItems.length === 0 ? (
          <EmptyState
            title={t("scanItem.empty.title")}
            body={t("scanItem.empty.body")}
            illustration={<ScanLine size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
          />
        ) : (
          <View style={styles.list}>
            {listItems.map((item) => (
              <OperationalRow
                key={item.id}
                density="operational"
                title={item.item_name}
                subtitle={t("scanItem.row.meta", {
                  category: item.category,
                  code: item.id
                })}
                value={`${formatNumber(item.current_quantity, { maximumFractionDigits: 1 })} ${item.unit}`}
                icon={
                  captureMode ? (
                    <Link2 size={icon.row} color={colors.accent} strokeWidth={iconStroke} />
                  ) : (
                    <Package size={icon.row} color={colors.text} strokeWidth={iconStroke} />
                  )
                }
                onPress={() => {
                  if (captureMode && lastScannedCode && canCapture) {
                    void linkBarcodeToItem(item);
                    return;
                  }
                  router.push(`/inventory/${item.id}`);
                }}
                disabled={capturingItemId !== null}
                accessibilityLabel={
                  captureMode
                    ? t("scanItem.capture.rowAccessibility", { item: item.item_name })
                    : t("scanItem.row.accessibility", { item: item.item_name })
                }
              />
            ))}
          </View>
        )}

        {scanPaused ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("scanItem.camera.resume")}
            onPress={() => setScanPaused(false)}
            style={styles.resumeTap}
          >
            <Text style={styles.resumeText}>{t("scanItem.camera.resume")}</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  cameraFrame: {
    height: 240,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.text
  },
  camera: {
    flex: 1
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 16
  },
  viewfinder: {
    width: "62%",
    height: 110,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.sm,
    backgroundColor: "transparent"
  },
  cameraHint: {
    color: colors.surface,
    textAlign: "center",
    ...conceptTypography.caption
  },
  permissionCard: {
    gap: 10,
    padding: 18,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "flex-start"
  },
  permissionTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  permissionBody: {
    color: colors.muted,
    ...typography.body,
    marginBottom: 4
  },
  searchWrap: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    ...typography.body
  },
  list: {
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    overflow: "hidden"
  },
  resumeTap: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  resumeText: {
    color: colors.accent,
    ...conceptTypography.caption
  }
});

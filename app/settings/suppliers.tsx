import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, Mail, Package, ShieldCheck } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { AppLocale } from "../../i18n/catalog";
import type { SupplierCatalogGroup } from "../../services/domain/supplierCatalog";
import {
  fetchSupplierCatalog,
  fetchSupplierRecipientDirectory,
  renameSupplier,
  saveSupplierRecipient
} from "../../services/miseService";
import type { SupplierRecipientDirectoryEntry } from "../../services/domain/supplierRecipients";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { filterSupplierCatalogGroups } from "../../services/presentation/supplierCatalogPresentation";
import { canManageRestaurantData } from "../../services/tenantAccess";

interface SupplierNotice {
  tone: StatusNoticeTone;
  title: string;
  message: string;
}

export default function SupplierRecipientsScreen() {
  const navigation = useNavigation();
  const { formatCurrency, formatNumber, locale } = useLocale();
  const copy = supplierCopy[locale];
  const { memberships, restaurant } = useMiseSession();
  const [entries, setEntries] = useState<SupplierRecipientDirectoryEntry[]>([]);
  const [catalogGroups, setCatalogGroups] = useState<SupplierCatalogGroup[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [draftEmails, setDraftEmails] = useState<Record<string, string>>({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<SupplierNotice | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  const actionLocksRef = useRef(new Set<string>());
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canManage = canManageRestaurantData(memberships, restaurant?.id);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [nextEntries, nextCatalog] = await Promise.all([
        fetchSupplierRecipientDirectory(restaurantId),
        fetchSupplierCatalog(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEntries.some((entry) => entry.restaurantId !== restaurantId)) {
        throw new Error("Supplier directory did not match the active restaurant.");
      }
      if (nextCatalog.some((group) => group.lines.some((line) => line.restaurantId !== restaurantId))) {
        throw new Error("Supplier catalog did not match the active restaurant.");
      }
      setEntries(nextEntries);
      setCatalogGroups(nextCatalog);
      setDraftEmails(Object.fromEntries(
        nextEntries.map((entry) => [entry.supplierId, entry.email ?? ""])
      ));
      setDraftNames(Object.fromEntries(
        nextEntries.map((entry) => [entry.supplierId, entry.supplierName])
      ));
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    actionLocksRef.current.clear();
    setEntries([]);
    setCatalogGroups([]);
    setCatalogQuery("");
    setDraftEmails({});
    setDraftNames({});
    setLoadedRestaurantId(null);
    setLoadError(false);
    setSavingKeys(new Set());
    setNotice(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: savingKeys.size > 0
  });
  const visibleEntries = hubReady ? entries : [];

  async function saveRecipient(entry: SupplierRecipientDirectoryEntry) {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    const key = entry.supplierId;
    if (actionLocksRef.current.has(key)) return;
    const email = (draftEmails[key] ?? "").trim();
    if (!isValidRecipientEmail(email)) {
      setNotice({
        tone: "warning",
        title: copy.invalidTitle,
        message: copy.invalidBody(entry.supplierName)
      });
      return;
    }

    actionLocksRef.current.add(key);
    setSavingKeys((current) => new Set(current).add(key));
    setNotice(null);
    try {
      const saved = await saveSupplierRecipient(restaurantId, entry.supplierId, email);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setEntries((current) => current.map((currentEntry) =>
        currentEntry.supplierId === key
          ? {
              ...currentEntry,
              email: saved.email,
              recipientId: saved.id,
              updatedAt: saved.updated_at,
              source: currentEntry.source === "current" ? "current_and_saved" : currentEntry.source
            }
          : currentEntry
      ));
      setDraftEmails((current) => ({ ...current, [key]: saved.email ?? "" }));
      setNotice({
        tone: "success",
        title: copy.savedTitle,
        message: copy.savedBody(entry.supplierName)
      });
    } catch {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "danger",
        title: copy.saveErrorTitle,
        message: copy.saveErrorBody(entry.supplierName)
      });
    } finally {
      actionLocksRef.current.delete(key);
      if (activeRestaurantIdRef.current === restaurantId) {
        setSavingKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    }
  }

  async function rename(entry: SupplierRecipientDirectoryEntry) {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    const key = entry.supplierId;
    if (actionLocksRef.current.has(key)) return;
    const requestedName = draftNames[key] ?? "";
    const displayName = canonicalSupplierName(requestedName);
    if (!isValidSupplierName(requestedName)) {
      setNotice({
        tone: "warning",
        title: copy.invalidNameTitle,
        message: copy.invalidNameBody
      });
      return;
    }

    actionLocksRef.current.add(key);
    setSavingKeys((current) => new Set(current).add(key));
    setNotice(null);
    try {
      await renameSupplier(restaurantId, entry.supplierId, displayName);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setEntries((current) => current.map((currentEntry) =>
        currentEntry.supplierId === key
          ? { ...currentEntry, supplierName: displayName }
          : currentEntry
      ));
      setDraftNames((current) => ({ ...current, [key]: displayName }));
      setNotice({
        tone: "success",
        title: copy.renamedTitle,
        message: copy.renamedBody(displayName)
      });
    } catch {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "danger",
        title: copy.renameErrorTitle,
        message: copy.renameErrorBody(entry.supplierName)
      });
    } finally {
      actionLocksRef.current.delete(key);
      if (activeRestaurantIdRef.current === restaurantId) {
        setSavingKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    }
  }

  const configuredCount = useMemo(
    () => visibleEntries.filter((entry) => Boolean(entry.email)).length,
    [visibleEntries]
  );
  const visibleCatalogGroups = useMemo(
    () => (hubReady ? filterSupplierCatalogGroups(catalogGroups, catalogQuery) : []),
    [catalogGroups, catalogQuery, hubReady]
  );
  const catalogLineCount = useMemo(
    () => visibleCatalogGroups.reduce((total, group) => total + group.lines.length, 0),
    [visibleCatalogGroups]
  );

  return (
    <Screen
      title={copy.title}
      subtitle={copy.subtitle}
      loading={loading}
      keyboardAware
      action={
        <ActionIcon accessibilityLabel={copy.back} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      {!restaurant ? (
        <StatusNotice tone="warning" title={copy.noRestaurantTitle} message={copy.noRestaurantBody} />
      ) : (
        <View style={styles.stack}>
          {!canManage ? (
            <StatusNotice title={copy.readOnlyTitle} message={copy.readOnlyBody} />
          ) : null}

          {loadError ? (
            <StatusNotice
              tone="danger"
              title={copy.loadErrorTitle}
              message={copy.loadErrorBody}
              actionLabel={copy.retry}
              actionAccessibilityLabel={copy.retryAccessibility}
              onAction={() => void load()}
            />
          ) : null}

          {notice ? <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} /> : null}

          <StatusNotice
            icon={<ShieldCheck size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />}
            title={copy.safetyTitle}
            message={copy.safetyBody}
          />

          <SectionSurface
            title={copy.sectionTitle}
            subtitle={copy.sectionSubtitle}
            action={copy.configuredCount(formatNumber(configuredCount), formatNumber(visibleEntries.length))}
            padding="none"
          >
            {visibleEntries.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState compact title={copy.emptyTitle} body={copy.emptyBody} />
              </View>
            ) : (
              visibleEntries.map((entry, index) => {
                const key = entry.supplierId;
                const draftEmail = draftEmails[key] ?? "";
                const draftName = draftNames[key] ?? entry.supplierName;
                const saving = savingKeys.has(key);
                const emailUnchanged = draftEmail.trim().toLowerCase() === (entry.email ?? "").toLowerCase();
                const nameUnchanged = canonicalSupplierName(draftName) === entry.supplierName;
                return (
                  <View
                    key={key}
                    style={[styles.recipientRow, index > 0 && styles.dividedRow]}
                  >
                    <View style={styles.recipientHeader}>
                      <IconBadge tone={entry.email ? "leaf" : "warning"}>
                        <Mail
                          size={icon.emphasis}
                          color={entry.email ? colors.success : colors.warning}
                          strokeWidth={iconStroke}
                        />
                      </IconBadge>
                      <View style={styles.recipientCopy}>
                        <Text style={styles.supplierName} numberOfLines={2}>{entry.supplierName}</Text>
                        <Text style={styles.supplierMeta}>
                          {entry.source === "saved" ? copy.savedRecipient : copy.currentSupplier}
                        </Text>
                      </View>
                      <Badge
                        label={entry.email ? copy.configured : copy.needsEmail}
                        tone={entry.email ? "success" : "warning"}
                      />
                    </View>

                    {canManage ? (
                      <View style={styles.editor}>
                        <Text style={styles.inputLabel}>{copy.nameLabel}</Text>
                        <TextInput
                          accessibilityLabel={copy.nameAccessibility(entry.supplierName)}
                          accessibilityHint={copy.nameHint}
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={actionsEditable && !saving}
                          maxLength={160}
                          onChangeText={(value) => setDraftNames((current) => ({ ...current, [key]: value }))}
                          onSubmitEditing={() => {
                            if (!nameUnchanged && actionsEditable && !saving) void rename(entry);
                          }}
                          placeholder={copy.namePlaceholder}
                          placeholderTextColor={colors.faint}
                          returnKeyType="done"
                          style={styles.input}
                          value={draftName}
                        />
                        <Button
                          title={saving ? copy.saving : copy.rename}
                          accessibilityLabel={copy.renameAccessibility(entry.supplierName)}
                          accessibilityHint={copy.renameHint}
                          variant="secondary"
                          fullWidth
                          disabled={!actionsEditable || saving || nameUnchanged}
                          onPress={() => void rename(entry)}
                        />
                        <Text style={styles.inputLabel}>{copy.emailLabel}</Text>
                        <TextInput
                          accessibilityLabel={copy.emailAccessibility(entry.supplierName)}
                          accessibilityHint={copy.emailHint}
                          autoCapitalize="none"
                          autoComplete="email"
                          autoCorrect={false}
                          editable={actionsEditable && !saving}
                          keyboardType="email-address"
                          onChangeText={(value) => setDraftEmails((current) => ({ ...current, [key]: value }))}
                          onSubmitEditing={() => {
                            if (!emailUnchanged && actionsEditable && !saving) void saveRecipient(entry);
                          }}
                          placeholder={copy.emailPlaceholder}
                          placeholderTextColor={colors.faint}
                          returnKeyType="done"
                          style={styles.input}
                          textContentType="emailAddress"
                          value={draftEmail}
                        />
                        <Button
                          title={saving ? copy.saving : copy.save}
                          accessibilityLabel={copy.saveAccessibility(entry.supplierName)}
                          accessibilityHint={copy.saveHint}
                          variant="secondary"
                          fullWidth
                          disabled={!actionsEditable || saving || emailUnchanged}
                          onPress={() => void saveRecipient(entry)}
                        />
                      </View>
                    ) : (
                      <View accessible accessibilityLabel={copy.readOnlyEmailAccessibility(entry.supplierName, entry.email)}>
                        <Text style={styles.readOnlyLabel}>{copy.emailLabel}</Text>
                        <Text style={[styles.readOnlyEmail, !entry.email && styles.missingEmail]}>
                          {entry.email ?? copy.notConfigured}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </SectionSurface>

          <SectionSurface
            title={copy.catalogTitle}
            subtitle={copy.catalogSubtitle}
            action={copy.catalogCount(formatNumber(catalogLineCount))}
            padding="none"
          >
            <View style={styles.catalogSearchWrap}>
              <TextInput
                accessibilityLabel={copy.catalogSearchAccessibility}
                accessibilityHint={copy.catalogSearchHint}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                onChangeText={setCatalogQuery}
                placeholder={copy.catalogSearchPlaceholder}
                placeholderTextColor={colors.faint}
                returnKeyType="search"
                style={styles.input}
                value={catalogQuery}
              />
            </View>
            {visibleCatalogGroups.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState
                  compact
                  title={catalogQuery.trim() ? copy.catalogSearchEmptyTitle : copy.catalogEmptyTitle}
                  body={catalogQuery.trim() ? copy.catalogSearchEmptyBody : copy.catalogEmptyBody}
                />
              </View>
            ) : (
              visibleCatalogGroups.map((group, groupIndex) => (
                <View
                  key={group.supplierKey}
                  style={[styles.catalogGroup, groupIndex > 0 && styles.dividedRow]}
                >
                  <View style={styles.catalogGroupHeader}>
                    <IconBadge tone="neutral">
                      <Package size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
                    </IconBadge>
                    <View style={styles.recipientCopy}>
                      <Text style={styles.supplierName} numberOfLines={2}>{group.supplierName}</Text>
                      <Text style={styles.supplierMeta}>
                        {copy.catalogGroupMeta(
                          formatNumber(group.lines.length),
                          formatNumber(group.preferredCount)
                        )}
                      </Text>
                    </View>
                  </View>
                  {group.lines.map((line, lineIndex) => (
                    <View
                      key={line.id}
                      style={[styles.catalogLine, lineIndex > 0 && styles.catalogLineDivided]}
                      accessible
                      accessibilityLabel={copy.catalogLineAccessibility(
                        line.itemName,
                        line.supplierSku,
                        line.packSize,
                        line.preferred
                      )}
                    >
                      <View style={styles.catalogLineHeader}>
                        <Text style={styles.catalogItemName} numberOfLines={2}>{line.itemName}</Text>
                        {line.preferred ? (
                          <Badge label={copy.preferred} tone="success" />
                        ) : null}
                      </View>
                      <Text style={styles.catalogMeta}>
                        {copy.catalogSkuLabel(line.supplierSku)}
                      </Text>
                      <Text style={styles.catalogMeta}>
                        {copy.catalogPackLabel(line.packSize)}
                      </Text>
                      <Text style={styles.catalogMeta}>
                        {copy.catalogUnitCost(
                          line.unit,
                          formatCurrency(line.estimatedUnitCost, {
                            currency: restaurant?.currency ?? "USD"
                          })
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </SectionSurface>
        </View>
      )}
    </Screen>
  );
}

function isValidRecipientEmail(value: string) {
  const normalized = value.trim();
  return normalized.length >= 3 && normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function canonicalSupplierName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isValidSupplierName(value: string) {
  const canonical = canonicalSupplierName(value);
  return canonical.length >= 1 && canonical.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value);
}

interface SupplierCopy {
  title: string;
  subtitle: string;
  back: string;
  noRestaurantTitle: string;
  noRestaurantBody: string;
  readOnlyTitle: string;
  readOnlyBody: string;
  loadErrorTitle: string;
  loadErrorBody: string;
  retry: string;
  retryAccessibility: string;
  invalidTitle: string;
  invalidBody: (supplier: string) => string;
  invalidNameTitle: string;
  invalidNameBody: string;
  savedTitle: string;
  savedBody: (supplier: string) => string;
  saveErrorTitle: string;
  saveErrorBody: (supplier: string) => string;
  renamedTitle: string;
  renamedBody: (supplier: string) => string;
  renameErrorTitle: string;
  renameErrorBody: (supplier: string) => string;
  safetyTitle: string;
  safetyBody: string;
  sectionTitle: string;
  sectionSubtitle: string;
  configuredCount: (configured: string, total: string) => string;
  emptyTitle: string;
  emptyBody: string;
  catalogTitle: string;
  catalogSubtitle: string;
  catalogCount: (count: string) => string;
  catalogSearchPlaceholder: string;
  catalogSearchAccessibility: string;
  catalogSearchHint: string;
  catalogEmptyTitle: string;
  catalogEmptyBody: string;
  catalogSearchEmptyTitle: string;
  catalogSearchEmptyBody: string;
  catalogGroupMeta: (lines: string, preferred: string) => string;
  catalogSkuLabel: (sku: string | null) => string;
  catalogPackLabel: (packSize: string | null) => string;
  catalogUnitCost: (unit: string, cost: string) => string;
  catalogLineAccessibility: (
    itemName: string,
    sku: string | null,
    packSize: string | null,
    preferred: boolean
  ) => string;
  preferred: string;
  savedRecipient: string;
  currentSupplier: string;
  configured: string;
  needsEmail: string;
  nameLabel: string;
  namePlaceholder: string;
  nameAccessibility: (supplier: string) => string;
  nameHint: string;
  rename: string;
  renameAccessibility: (supplier: string) => string;
  renameHint: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailAccessibility: (supplier: string) => string;
  emailHint: string;
  save: string;
  saving: string;
  saveAccessibility: (supplier: string) => string;
  saveHint: string;
  readOnlyEmailAccessibility: (supplier: string, email: string | null) => string;
  notConfigured: string;
}

const supplierCopy: Record<AppLocale, SupplierCopy> = {
  en: {
    title: "Suppliers",
    subtitle: "Recipients plus catalog pack labels, preferred items, and SKUs.",
    back: "Back to settings",
    noRestaurantTitle: "No restaurant selected",
    noRestaurantBody: "Open a restaurant workspace before managing supplier recipients.",
    readOnlyTitle: "View-only supplier emails",
    readOnlyBody: "Owners, admins, and managers can update recipients. Staff can review the saved addresses.",
    loadErrorTitle: "Supplier emails could not refresh",
    loadErrorBody: "Try loading this restaurant’s supplier directory again.",
    retry: "Try again",
    retryAccessibility: "Retry loading supplier emails",
    invalidTitle: "Enter a valid email",
    invalidBody: (supplier) => `Add a complete email address for ${supplier}.`,
    invalidNameTitle: "Enter a valid supplier name",
    invalidNameBody: "Use 1–160 characters without control characters.",
    savedTitle: "Supplier email saved",
    savedBody: (supplier) => `${supplier} is ready for approved order emails.`,
    saveErrorTitle: "Supplier email was not saved",
    saveErrorBody: (supplier) => `Try saving the recipient for ${supplier} again.`,
    renamedTitle: "Supplier renamed",
    renamedBody: (supplier) => `${supplier} keeps its recipient, orders, and purchasing identity.`,
    renameErrorTitle: "Supplier was not renamed",
    renameErrorBody: (supplier) => `Try renaming ${supplier} again. The name may already be in use.`,
    safetyTitle: "Restaurant-scoped recipients",
    safetyBody: "Each supplier keeps one durable restaurant identity. Renaming it does not detach its recipient or create a different supplier.",
    sectionTitle: "Supplier directory",
    sectionSubtitle: "Current suppliers and their approved-order recipients.",
    configuredCount: (configured, total) => `${configured} of ${total} ready`,
    emptyTitle: "No suppliers yet",
    emptyBody: "Add inventory suppliers during setup before configuring order recipients.",
    catalogTitle: "Supplier catalog",
    catalogSubtitle: "Saved pack labels, preferred flags, and supplier SKUs. Read-only — no invented quantities.",
    catalogCount: (count) => `${count} items`,
    catalogSearchPlaceholder: "Search item, SKU, or pack label",
    catalogSearchAccessibility: "Search supplier catalog",
    catalogSearchHint: "Filters catalog lines by item name, SKU, pack label, or supplier.",
    catalogEmptyTitle: "No catalog items yet",
    catalogEmptyBody: "Supplier catalog rows appear after setup seeds or hosted supplier item records exist.",
    catalogSearchEmptyTitle: "No catalog matches",
    catalogSearchEmptyBody: "Try another item name, SKU, pack label, or supplier.",
    catalogGroupMeta: (lines, preferred) => `${lines} items · ${preferred} preferred`,
    catalogSkuLabel: (sku) => (sku ? `SKU ${sku}` : "No supplier SKU on file"),
    catalogPackLabel: (packSize) => (packSize ? `Pack ${packSize}` : "No pack label on file"),
    catalogUnitCost: (unit, cost) => `${unit} · ${cost} each`,
    catalogLineAccessibility: (itemName, sku, packSize, preferred) =>
      [
        itemName,
        preferred ? "preferred" : null,
        sku ? `SKU ${sku}` : "no supplier SKU",
        packSize ? `pack ${packSize}` : "no pack label"
      ]
        .filter(Boolean)
        .join(", "),
    preferred: "Preferred",
    savedRecipient: "Saved recipient",
    currentSupplier: "Current supplier",
    configured: "Ready",
    needsEmail: "Needs email",
    nameLabel: "Display name",
    namePlaceholder: "Supplier name",
    nameAccessibility: (supplier) => `Display name for ${supplier}`,
    nameHint: "Renaming preserves this supplier’s identity and recipient.",
    rename: "Save name",
    renameAccessibility: (supplier) => `Save a new display name for ${supplier}`,
    renameHint: "Changes presentation without assigning a different supplier.",
    emailLabel: "Order email",
    emailPlaceholder: "orders@supplier.com",
    emailAccessibility: (supplier) => `Order email for ${supplier}`,
    emailHint: "Enter the recipient used for approved supplier orders.",
    save: "Save email",
    saving: "Saving",
    saveAccessibility: (supplier) => `Save order email for ${supplier}`,
    saveHint: "Saves this recipient to the active restaurant only.",
    readOnlyEmailAccessibility: (supplier, email) => `${supplier} order email: ${email ?? "not configured"}`,
    notConfigured: "Not configured"
  },
  es: {
    title: "Proveedores",
    subtitle: "Destinatarios más etiquetas de empaque, preferidos y SKU del catálogo.",
    back: "Volver a Configuración",
    noRestaurantTitle: "No hay restaurante seleccionado",
    noRestaurantBody: "Abre un espacio de restaurante antes de administrar destinatarios.",
    readOnlyTitle: "Correos de proveedores de solo lectura",
    readOnlyBody: "Propietarios, administradores y gerentes pueden actualizar destinatarios. El personal puede revisar las direcciones guardadas.",
    loadErrorTitle: "No se pudieron actualizar los correos",
    loadErrorBody: "Intenta cargar nuevamente el directorio de proveedores de este restaurante.",
    retry: "Reintentar",
    retryAccessibility: "Volver a cargar los correos de proveedores",
    invalidTitle: "Ingresa un correo válido",
    invalidBody: (supplier) => `Agrega una dirección de correo completa para ${supplier}.`,
    invalidNameTitle: "Ingresa un nombre de proveedor válido",
    invalidNameBody: "Usa entre 1 y 160 caracteres, sin caracteres de control.",
    savedTitle: "Correo del proveedor guardado",
    savedBody: (supplier) => `${supplier} está listo para recibir pedidos aprobados.`,
    saveErrorTitle: "No se guardó el correo",
    saveErrorBody: (supplier) => `Intenta guardar nuevamente el destinatario de ${supplier}.`,
    renamedTitle: "Proveedor renombrado",
    renamedBody: (supplier) => `${supplier} conserva su destinatario, pedidos e identidad de compra.`,
    renameErrorTitle: "No se cambió el nombre",
    renameErrorBody: (supplier) => `Intenta renombrar ${supplier} nuevamente. Es posible que el nombre ya esté en uso.`,
    safetyTitle: "Destinatarios por restaurante",
    safetyBody: "Cada proveedor conserva una identidad estable dentro del restaurante. Renombrarlo no desconecta su destinatario ni crea otro proveedor.",
    sectionTitle: "Directorio de proveedores",
    sectionSubtitle: "Proveedores actuales y destinatarios de pedidos aprobados.",
    configuredCount: (configured, total) => `${configured} de ${total} listos`,
    emptyTitle: "Aún no hay proveedores",
    emptyBody: "Agrega proveedores de inventario durante la configuración antes de definir destinatarios.",
    catalogTitle: "Catálogo de proveedores",
    catalogSubtitle: "Etiquetas de empaque, preferidos y SKU guardados. Solo lectura: sin cantidades inventadas.",
    catalogCount: (count) => `${count} artículos`,
    catalogSearchPlaceholder: "Buscar artículo, SKU o empaque",
    catalogSearchAccessibility: "Buscar en el catálogo de proveedores",
    catalogSearchHint: "Filtra líneas por nombre, SKU, empaque o proveedor.",
    catalogEmptyTitle: "Aún no hay artículos de catálogo",
    catalogEmptyBody: "Las filas del catálogo aparecen tras la configuración o cuando existen registros alojados de artículos de proveedor.",
    catalogSearchEmptyTitle: "Sin coincidencias en el catálogo",
    catalogSearchEmptyBody: "Prueba otro nombre, SKU, empaque o proveedor.",
    catalogGroupMeta: (lines, preferred) => `${lines} artículos · ${preferred} preferidos`,
    catalogSkuLabel: (sku) => (sku ? `SKU ${sku}` : "Sin SKU de proveedor"),
    catalogPackLabel: (packSize) => (packSize ? `Empaque ${packSize}` : "Sin etiqueta de empaque"),
    catalogUnitCost: (unit, cost) => `${unit} · ${cost} c/u`,
    catalogLineAccessibility: (itemName, sku, packSize, preferred) =>
      [
        itemName,
        preferred ? "preferido" : null,
        sku ? `SKU ${sku}` : "sin SKU de proveedor",
        packSize ? `empaque ${packSize}` : "sin etiqueta de empaque"
      ]
        .filter(Boolean)
        .join(", "),
    preferred: "Preferido",
    savedRecipient: "Destinatario guardado",
    currentSupplier: "Proveedor actual",
    configured: "Listo",
    needsEmail: "Falta correo",
    nameLabel: "Nombre visible",
    namePlaceholder: "Nombre del proveedor",
    nameAccessibility: (supplier) => `Nombre visible de ${supplier}`,
    nameHint: "Cambiar el nombre conserva la identidad y el destinatario del proveedor.",
    rename: "Guardar nombre",
    renameAccessibility: (supplier) => `Guardar un nuevo nombre visible para ${supplier}`,
    renameHint: "Cambia la presentación sin asignar otro proveedor.",
    emailLabel: "Correo para pedidos",
    emailPlaceholder: "pedidos@proveedor.com",
    emailAccessibility: (supplier) => `Correo para pedidos de ${supplier}`,
    emailHint: "Ingresa el destinatario que recibirá los pedidos aprobados.",
    save: "Guardar correo",
    saving: "Guardando",
    saveAccessibility: (supplier) => `Guardar correo para pedidos de ${supplier}`,
    saveHint: "Guarda este destinatario únicamente en el restaurante activo.",
    readOnlyEmailAccessibility: (supplier, email) => `Correo para pedidos de ${supplier}: ${email ?? "sin configurar"}`,
    notConfigured: "Sin configurar"
  },
  "zh-Hans": {
    title: "供应商",
    subtitle: "收件人以及目录中的包装标签、首选品和 SKU。",
    back: "返回设置",
    noRestaurantTitle: "未选择餐厅",
    noRestaurantBody: "请先打开餐厅工作区，再管理供应商收件人。",
    readOnlyTitle: "供应商邮箱仅供查看",
    readOnlyBody: "所有者、管理员和经理可以更新收件人；员工可以查看已保存的地址。",
    loadErrorTitle: "无法刷新供应商邮箱",
    loadErrorBody: "请重新加载此餐厅的供应商目录。",
    retry: "重试",
    retryAccessibility: "重新加载供应商邮箱",
    invalidTitle: "请输入有效邮箱",
    invalidBody: (supplier) => `请为 ${supplier} 添加完整的邮箱地址。`,
    invalidNameTitle: "请输入有效的供应商名称",
    invalidNameBody: "请使用 1–160 个字符，且不要包含控制字符。",
    savedTitle: "供应商邮箱已保存",
    savedBody: (supplier) => `${supplier} 已可接收批准后的订单邮件。`,
    saveErrorTitle: "未能保存供应商邮箱",
    saveErrorBody: (supplier) => `请重新保存 ${supplier} 的收件人。`,
    renamedTitle: "供应商已重命名",
    renamedBody: (supplier) => `${supplier} 的收件人、订单和采购身份均保持不变。`,
    renameErrorTitle: "未能重命名供应商",
    renameErrorBody: (supplier) => `请再次尝试重命名 ${supplier}。该名称可能已被使用。`,
    safetyTitle: "餐厅专属收件人",
    safetyBody: "每个供应商在餐厅内都有一个持久身份。重命名不会断开收件人，也不会创建新的供应商。",
    sectionTitle: "收件人目录",
    sectionSubtitle: "当前供应商及其已批准订单的收件人。",
    configuredCount: (configured, total) => `${configured}/${total} 已就绪`,
    emptyTitle: "尚无供应商",
    emptyBody: "请先在设置中添加库存供应商，再配置订单收件人。",
    catalogTitle: "供应商货品目录",
    catalogSubtitle: "已保存的包装标签、首选标记和供应商 SKU。只读，不会虚构数量。",
    catalogCount: (count) => `${count} 项`,
    catalogSearchPlaceholder: "搜索货品、SKU 或包装标签",
    catalogSearchAccessibility: "搜索供应商货品目录",
    catalogSearchHint: "按货品名称、SKU、包装标签或供应商筛选。",
    catalogEmptyTitle: "尚无目录货品",
    catalogEmptyBody: "完成设置或存在托管供应商货品记录后，才会显示目录行。",
    catalogSearchEmptyTitle: "没有匹配的目录项",
    catalogSearchEmptyBody: "请尝试其他货品名称、SKU、包装标签或供应商。",
    catalogGroupMeta: (lines, preferred) => `${lines} 项 · ${preferred} 首选`,
    catalogSkuLabel: (sku) => (sku ? `SKU ${sku}` : "无供应商 SKU"),
    catalogPackLabel: (packSize) => (packSize ? `包装 ${packSize}` : "无包装标签"),
    catalogUnitCost: (unit, cost) => `${unit} · ${cost}/单位`,
    catalogLineAccessibility: (itemName, sku, packSize, preferred) =>
      [
        itemName,
        preferred ? "首选" : null,
        sku ? `SKU ${sku}` : "无供应商 SKU",
        packSize ? `包装 ${packSize}` : "无包装标签"
      ]
        .filter(Boolean)
        .join("，"),
    preferred: "首选",
    savedRecipient: "已保存的收件人",
    currentSupplier: "当前供应商",
    configured: "已就绪",
    needsEmail: "需要邮箱",
    nameLabel: "显示名称",
    namePlaceholder: "供应商名称",
    nameAccessibility: (supplier) => `${supplier} 的显示名称`,
    nameHint: "重命名会保留供应商身份和收件人。",
    rename: "保存名称",
    renameAccessibility: (supplier) => `保存 ${supplier} 的新显示名称`,
    renameHint: "仅更改显示内容，不会分配其他供应商。",
    emailLabel: "订单邮箱",
    emailPlaceholder: "orders@supplier.com",
    emailAccessibility: (supplier) => `${supplier} 的订单邮箱`,
    emailHint: "输入用于接收已批准供应商订单的收件人。",
    save: "保存邮箱",
    saving: "正在保存",
    saveAccessibility: (supplier) => `保存 ${supplier} 的订单邮箱`,
    saveHint: "仅将此收件人保存到当前餐厅。",
    readOnlyEmailAccessibility: (supplier, email) => `${supplier} 的订单邮箱：${email ?? "未配置"}`,
    notConfigured: "未配置"
  }
};

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  emptyWrap: {
    padding: 14
  },
  catalogSearchWrap: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    backgroundColor: colors.surface
  },
  catalogGroup: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface
  },
  catalogGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  catalogLine: {
    gap: 4,
    paddingLeft: 4
  },
  catalogLineDivided: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  catalogLineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  catalogItemName: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    ...typography.body,
    fontWeight: "600"
  },
  catalogMeta: {
    color: colors.muted,
    ...typography.caption
  },
  recipientRow: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface
  },
  dividedRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  recipientHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  recipientCopy: {
    flex: 1,
    minWidth: 0
  },
  supplierName: {
    color: colors.text,
    ...typography.cardTitle
  },
  supplierMeta: {
    color: colors.muted,
    ...typography.body,
    marginTop: 2
  },
  editor: {
    gap: 8
  },
  inputLabel: {
    color: colors.text,
    ...typography.caption
  },
  input: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceWarm,
    color: colors.text,
    ...typography.body,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  readOnlyLabel: {
    color: colors.muted,
    ...typography.caption
  },
  readOnlyEmail: {
    color: colors.text,
    ...typography.body,
    marginTop: 4
  },
  missingEmail: {
    color: colors.warning
  }
});

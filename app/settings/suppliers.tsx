import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react-native";
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
import {
  fetchSupplierRecipientDirectory,
  renameSupplier,
  saveSupplierRecipient
} from "../../services/miseService";
import type { SupplierRecipientDirectoryEntry } from "../../services/domain/supplierRecipients";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canManageRestaurantData } from "../../services/tenantAccess";

interface SupplierNotice {
  tone: StatusNoticeTone;
  title: string;
  message: string;
}

export default function SupplierRecipientsScreen() {
  const navigation = useNavigation();
  const { formatNumber, locale } = useLocale();
  const copy = supplierCopy[locale];
  const { memberships, restaurant } = useMiseSession();
  const [entries, setEntries] = useState<SupplierRecipientDirectoryEntry[]>([]);
  const [draftEmails, setDraftEmails] = useState<Record<string, string>>({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<SupplierNotice | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
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
    const soft = hasLoadedRef.current && activeRestaurantIdRef.current === restaurantId;
    if (soft) {
      // Invalidate readiness during soft refresh so mutations stay closed until proof returns.
      setLoadedRestaurantId(null);
    } else {
      setLoading(true);
      setLoadError(false);
      setNotice(null);
    }
    try {
      const nextEntries = await fetchSupplierRecipientDirectory(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEntries.some((entry) => entry.restaurantId !== restaurantId)) {
        throw new Error("Supplier directory did not match the active restaurant.");
      }
      setEntries(nextEntries);
      setLoadedRestaurantId(restaurantId);
      setLoadError(false);
      // Soft refresh must preserve operator-entered name/email drafts.
      if (soft) {
        setDraftEmails((current) =>
          Object.fromEntries(
            nextEntries.map((entry) => [
              entry.supplierId,
              entry.supplierId in current ? current[entry.supplierId]! : (entry.email ?? "")
            ])
          )
        );
        setDraftNames((current) =>
          Object.fromEntries(
            nextEntries.map((entry) => [
              entry.supplierId,
              entry.supplierId in current ? current[entry.supplierId]! : entry.supplierName
            ])
          )
        );
      } else {
        setDraftEmails(Object.fromEntries(
          nextEntries.map((entry) => [entry.supplierId, entry.email ?? ""])
        ));
        setDraftNames(Object.fromEntries(
          nextEntries.map((entry) => [entry.supplierId, entry.supplierName])
        ));
      }
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      // Fail closed for display/actions, but keep local drafts and prior directory for retry.
      setLoadError(true);
      if (!soft) {
        setEntries([]);
      }
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    hasLoadedRef.current = false;
    actionLocksRef.current.clear();
    setEntries([]);
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
    subtitle: "Names and recipients for approved restaurant orders.",
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
    subtitle: "Nombres y destinatarios de pedidos aprobados del restaurante.",
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
    subtitle: "餐厅已批准订单使用的名称和收件人。",
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
    sectionTitle: "供应商目录",
    sectionSubtitle: "当前供应商及其已批准订单的收件人。",
    configuredCount: (configured, total) => `${configured}/${total} 已就绪`,
    emptyTitle: "尚无供应商",
    emptyBody: "请先在设置中添加库存供应商，再配置订单收件人。",
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

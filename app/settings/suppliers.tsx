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
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { AppLocale } from "../../i18n/catalog";
import {
  fetchSupplierRecipientDirectory,
  saveSupplierRecipient
} from "../../services/miseService";
import {
  supplierRecipientDirectoryKey,
  type SupplierRecipientDirectoryEntry
} from "../../services/domain/supplierRecipients";
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
      const nextEntries = await fetchSupplierRecipientDirectory(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEntries.some((entry) => entry.restaurantId !== restaurantId)) {
        throw new Error("Supplier directory did not match the active restaurant.");
      }
      setEntries(nextEntries);
      setDraftEmails(Object.fromEntries(
        nextEntries.map((entry) => [supplierRecipientDirectoryKey(entry.supplierName), entry.email ?? ""])
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
    setDraftEmails({});
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

  async function save(entry: SupplierRecipientDirectoryEntry) {
    if (!restaurant || !canManage) return;
    const restaurantId = restaurant.id;
    const key = supplierRecipientDirectoryKey(entry.supplierName);
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
      const saved = await saveSupplierRecipient(restaurantId, entry.supplierName, email);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setEntries((current) => current.map((currentEntry) =>
        supplierRecipientDirectoryKey(currentEntry.supplierName) === key
          ? {
              ...currentEntry,
              supplierName: saved.supplier_name,
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
        message: copy.savedBody(saved.supplier_name)
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

  const visibleEntries = loadedRestaurantId === restaurant?.id ? entries : [];
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
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.25} />
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
            icon={<ShieldCheck size={20} color={colors.text} strokeWidth={2.25} />}
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
                const key = supplierRecipientDirectoryKey(entry.supplierName);
                const draftEmail = draftEmails[key] ?? "";
                const saving = savingKeys.has(key);
                const unchanged = draftEmail.trim().toLowerCase() === (entry.email ?? "").toLowerCase();
                return (
                  <View
                    key={key}
                    style={[styles.recipientRow, index > 0 && styles.dividedRow]}
                  >
                    <View style={styles.recipientHeader}>
                      <IconBadge tone={entry.email ? "leaf" : "warning"}>
                        <Mail
                          size={20}
                          color={entry.email ? colors.success : colors.warning}
                          strokeWidth={2.25}
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
                        <Text style={styles.inputLabel}>{copy.emailLabel}</Text>
                        <TextInput
                          accessibilityLabel={copy.emailAccessibility(entry.supplierName)}
                          accessibilityHint={copy.emailHint}
                          autoCapitalize="none"
                          autoComplete="email"
                          autoCorrect={false}
                          editable={!saving}
                          keyboardType="email-address"
                          onChangeText={(value) => setDraftEmails((current) => ({ ...current, [key]: value }))}
                          onSubmitEditing={() => {
                            if (!unchanged && !saving) void save(entry);
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
                          disabled={saving || unchanged}
                          onPress={() => void save(entry)}
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
  savedTitle: string;
  savedBody: (supplier: string) => string;
  saveErrorTitle: string;
  saveErrorBody: (supplier: string) => string;
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
    title: "Supplier emails",
    subtitle: "Recipients for approved restaurant orders.",
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
    savedTitle: "Supplier email saved",
    savedBody: (supplier) => `${supplier} is ready for approved order emails.`,
    saveErrorTitle: "Supplier email was not saved",
    saveErrorBody: (supplier) => `Try saving the recipient for ${supplier} again.`,
    safetyTitle: "Restaurant-scoped recipients",
    safetyBody: "Mise uses these addresses only for manager-approved supplier orders in this restaurant.",
    sectionTitle: "Supplier directory",
    sectionSubtitle: "Current inventory suppliers and previously saved recipients.",
    configuredCount: (configured, total) => `${configured} of ${total} ready`,
    emptyTitle: "No suppliers yet",
    emptyBody: "Add inventory suppliers during setup before configuring order recipients.",
    savedRecipient: "Saved recipient",
    currentSupplier: "Current supplier",
    configured: "Ready",
    needsEmail: "Needs email",
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
    title: "Correos de proveedores",
    subtitle: "Destinatarios de pedidos aprobados del restaurante.",
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
    savedTitle: "Correo del proveedor guardado",
    savedBody: (supplier) => `${supplier} está listo para recibir pedidos aprobados.`,
    saveErrorTitle: "No se guardó el correo",
    saveErrorBody: (supplier) => `Intenta guardar nuevamente el destinatario de ${supplier}.`,
    safetyTitle: "Destinatarios por restaurante",
    safetyBody: "Mise usa estas direcciones solo para pedidos aprobados por un gerente en este restaurante.",
    sectionTitle: "Directorio de proveedores",
    sectionSubtitle: "Proveedores actuales del inventario y destinatarios guardados anteriormente.",
    configuredCount: (configured, total) => `${configured} de ${total} listos`,
    emptyTitle: "Aún no hay proveedores",
    emptyBody: "Agrega proveedores de inventario durante la configuración antes de definir destinatarios.",
    savedRecipient: "Destinatario guardado",
    currentSupplier: "Proveedor actual",
    configured: "Listo",
    needsEmail: "Falta correo",
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
    title: "供应商邮箱",
    subtitle: "用于餐厅已批准订单的收件人。",
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
    savedTitle: "供应商邮箱已保存",
    savedBody: (supplier) => `${supplier} 已可接收批准后的订单邮件。`,
    saveErrorTitle: "未能保存供应商邮箱",
    saveErrorBody: (supplier) => `请重新保存 ${supplier} 的收件人。`,
    safetyTitle: "餐厅专属收件人",
    safetyBody: "Mise 仅使用这些地址发送此餐厅经经理批准的供应商订单。",
    sectionTitle: "供应商目录",
    sectionSubtitle: "当前库存供应商和之前保存的收件人。",
    configuredCount: (configured, total) => `${configured}/${total} 已就绪`,
    emptyTitle: "尚无供应商",
    emptyBody: "请先在设置中添加库存供应商，再配置订单收件人。",
    savedRecipient: "已保存的收件人",
    currentSupplier: "当前供应商",
    configured: "已就绪",
    needsEmail: "需要邮箱",
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

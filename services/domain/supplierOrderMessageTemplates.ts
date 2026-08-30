/**
 * Locale-aware supplier-order message and subject templates.
 *
 * These strings are part of the MISE-003B send-content fingerprint body/subject.
 * Demo TypeScript and hosted PostgreSQL must stay byte-identical for the same
 * locale. Keep this module free of the UI i18n catalog so fingerprint vectors
 * stay deterministic and easy to mirror in SQL.
 */

export const SUPPLIER_ORDER_MESSAGE_LOCALES = ["en", "es", "zh-Hans"] as const;

export type SupplierOrderMessageLocale = (typeof SUPPLIER_ORDER_MESSAGE_LOCALES)[number];

export const DEFAULT_SUPPLIER_ORDER_MESSAGE_LOCALE: SupplierOrderMessageLocale = "en";

const TEMPLATES: Readonly<
  Record<
    SupplierOrderMessageLocale,
    Readonly<{
      orderDraftFor: (supplierName: string) => string;
      deliveryTomorrowMorning: string;
      notesHeader: string;
      subject: (restaurantName: string, supplierName: string) => string;
    }>
  >
> = {
  en: {
    orderDraftFor: (supplierName) => `Order draft for ${supplierName}`,
    deliveryTomorrowMorning: "Delivery requested: Tomorrow morning",
    notesHeader: "Notes:",
    subject: (restaurantName, supplierName) => `${restaurantName} order for ${supplierName}`
  },
  es: {
    orderDraftFor: (supplierName) => `Borrador de pedido para ${supplierName}`,
    deliveryTomorrowMorning: "Entrega solicitada: Mañana por la mañana",
    notesHeader: "Notas:",
    subject: (restaurantName, supplierName) => `Pedido de ${restaurantName} para ${supplierName}`
  },
  "zh-Hans": {
    orderDraftFor: (supplierName) => `${supplierName} 的订单草稿`,
    deliveryTomorrowMorning: "请求送达：明天上午",
    notesHeader: "备注：",
    subject: (restaurantName, supplierName) => `${restaurantName} 发给 ${supplierName} 的订单`
  }
};

export function resolveSupplierOrderMessageLocale(
  value: string | null | undefined
): SupplierOrderMessageLocale {
  if (
    value === "en" ||
    value === "es" ||
    value === "zh-Hans"
  ) {
    return value;
  }
  return DEFAULT_SUPPLIER_ORDER_MESSAGE_LOCALE;
}

export function formatSupplierOrderSubject(
  restaurantName: string,
  supplierName: string,
  locale: string | null | undefined = DEFAULT_SUPPLIER_ORDER_MESSAGE_LOCALE
) {
  const resolved = resolveSupplierOrderMessageLocale(locale);
  return TEMPLATES[resolved]
    .subject(restaurantName, supplierName)
    .replace(/[\r\n]+/g, " ")
    .trim();
}

export function formatSupplierOrderMessageBody(input: {
  supplierName: string;
  linesBody: string;
  operatorNote?: string | null;
  locale?: string | null;
}) {
  const resolved = resolveSupplierOrderMessageLocale(input.locale);
  const templates = TEMPLATES[resolved];
  const supplierName = input.supplierName.slice(0, 160);
  const note = input.operatorNote?.trim() ?? "";
  const base = [
    templates.orderDraftFor(supplierName),
    "",
    input.linesBody,
    "",
    templates.deliveryTomorrowMorning
  ].join("\n");
  if (!note) return base;
  return `${base}\n\n${templates.notesHeader}\n${note.slice(0, 2000)}`;
}

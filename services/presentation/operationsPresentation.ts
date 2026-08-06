import { formatLocalizedNumber } from "../../i18n/formatters";
import type { AppLocale } from "../../i18n/catalog";
import type { Insight, LearningMemorySignal, LearningMemorySummary } from "../../types/mise";
import type {
  BusinessInsightType,
  InsightPresentationDescriptor,
  LearningMemoryNextStepCode,
  LearningMemorySignalPresentationDescriptor,
  TodayTaskPresentationDescriptor
} from "../../types/presentation";
import type {
  OperatingPlanItem,
  OperatingPlanItemKind,
  ReprioritizationCode,
  ServiceWindowId,
  VerificationMethod
} from "../domain/operatingPlan";
import type { OperationalTodayTask } from "../domain/todayTasks";

export interface PresentedOperationalCopy {
  title: string;
  detail: string;
  evidenceOnly: boolean;
}

export interface PresentedInsightCopy {
  title: string;
  description: string;
  whyItMatters: string | null;
  recommendedAction: string;
  evidenceOnly: boolean;
}

export interface PresentedLearningMemory {
  label: string;
  operatorCopy: string;
  nextStep: string;
  signals: PresentedLearningMemorySignal[];
}

export interface PresentedLearningMemorySignal {
  label: string;
  value: string;
  detail: string;
}

interface OperationsCopy {
  evidenceLabel: string;
  sourceRecommendationLabel: string;
  insightType: Record<BusinessInsightType, string>;
  today: {
    recommendationReviewTitle: (itemName: string) => string;
    recommendationReviewDetail: string;
    recommendationDraftTitle: (supplierName: string) => string;
    recommendationDraftDetail: (itemName: string) => string;
    confirmCountTitle: (itemName: string) => string;
    confirmCountDetail: (quantity: string, unit: string) => string;
    resolveStockTitle: (itemName: string) => string;
    resolveStockDetail: (quantity: string, unit: string) => string;
    sendOrderTitle: (supplierName: string) => string;
    reviewOrderTitle: (supplierName: string) => string;
    orderDeliveryDetail: string;
    orderDraftDetail: string;
    setupTitles: Record<SetupPresentationCode, string>;
    setupDetails: Record<SetupPresentationCode, string>;
    connectSalesTitle: string;
    connectSalesDetail: string;
    salesConnectedTitle: (providerName: string) => string;
    salesConnectedDetail: string;
    repairSalesTitle: (providerName: string) => string;
    repairSalesErrorDetail: string;
    repairSalesPausedDetail: string;
    repairSalesDisconnectedDetail: string;
    reviewInsightTitle: (typeLabel: string) => string;
    reviewInsightDetail: string;
  };
  insight: {
    inventoryCriticalTitle: (itemName: string) => string;
    inventoryLowTitle: (itemName: string) => string;
    inventoryDescription: (itemName: string, quantity: string, unit: string) => string;
    inventoryWhy: string;
    inventoryAction: (supplierName: string, quantity: string, unit: string) => string;
    salesTitle: (itemName: string) => string;
    salesDescription: (itemName: string, lift: string) => string;
    salesWhy: string;
    salesAction: (itemName: string) => string;
    prepTitle: (menuItemName: string) => string;
    prepDescription: (menuItemName: string, inventoryItemName: string) => string;
    prepWhy: string;
    prepAction: (supplierName: string) => string;
    wasteTitle: (itemName: string) => string;
    wasteDescription: (itemName: string, quantity: string, unit: string) => string;
    wasteWhy: string;
    wasteAction: (itemName: string) => string;
  };
  memory: {
    reliableLabel: string;
    buildingLabel: string;
    needsProofLabel: string;
    reliableCopy: string;
    buildingCopy: string;
    nextSteps: Record<LearningMemoryNextStepCode, string>;
    recipeLabel: string;
    recipeDetail: (count: string, rawCount: number) => string;
    depletionLabel: string;
    depletionDetail: (count: string, rawCount: number) => string;
    demandLabel: string;
    demandDetail: (count: string, rawCount: number) => string;
    orderLabel: string;
    orderDetail: (count: string, rawCount: number) => string;
    insightLabel: string;
    insightDetail: (count: string, rawCount: number) => string;
    learningValue: string;
    dayValue: (days: string) => string;
  };
}

type SetupPresentationCode = Extract<
  TodayTaskPresentationDescriptor["code"],
  `today.setup.${string}`
>;

const copyByLocale: Readonly<Record<AppLocale, OperationsCopy>> = {
  en: {
    evidenceLabel: "Evidence",
    sourceRecommendationLabel: "Source recommendation",
    insightType: {
      sales: "sales signal",
      inventory: "inventory signal",
      waste: "waste signal",
      cost: "cost signal",
      prep: "prep signal",
      ordering: "ordering signal"
    },
    today: {
      recommendationReviewTitle: (itemName) => `Review ${itemName} reorder`,
      recommendationReviewDetail: "Operator approval is required before this recommendation changes ordering state.",
      recommendationDraftTitle: (supplierName) => `Prepare ${supplierName} supplier draft`,
      recommendationDraftDetail: (itemName) => `${itemName} is approved. Build the draft and review it before sending.`,
      confirmCountTitle: (itemName) => `Confirm ${itemName} count`,
      confirmCountDetail: (quantity, unit) => `Projected ${quantity} ${unit}. Update the count before making an ordering decision.`,
      resolveStockTitle: (itemName) => `Resolve ${itemName} stock risk`,
      resolveStockDetail: (quantity, unit) => `Projected ${quantity} ${unit}. Review the count and supplier coverage.`,
      sendOrderTitle: (supplierName) => `Send ${supplierName} order`,
      reviewOrderTitle: (supplierName) => `Review ${supplierName} order`,
      orderDeliveryDetail: "A supplier delivery commitment is recorded for this order.",
      orderDraftDetail: "Review the approved draft before it leaves the restaurant.",
      setupTitles: {
        "today.setup.profile.open": "Finish restaurant profile",
        "today.setup.profile.complete": "Restaurant profile complete",
        "today.setup.inventory.open": "Finish inventory baseline",
        "today.setup.inventory.complete": "Inventory baseline complete",
        "today.setup.recipes.open": "Map recipes to inventory",
        "today.setup.recipes.complete": "Recipe mapping complete",
        "today.setup.email.connect": "Connect Gmail sender",
        "today.setup.email.reconnect": "Reconnect Gmail sender",
        "today.setup.email.complete": "Gmail sender connected"
      },
      setupDetails: {
        "today.setup.profile.open": "Complete the operating profile before relying on restaurant-specific guidance.",
        "today.setup.profile.complete": "The restaurant profile is ready for review.",
        "today.setup.inventory.open": "Add the current stock baseline before relying on reorder coverage.",
        "today.setup.inventory.complete": "The inventory baseline is ready for review.",
        "today.setup.recipes.open": "Link menu items to stock so sales can drive depletion.",
        "today.setup.recipes.complete": "Recipe-to-inventory mapping is ready for review.",
        "today.setup.email.connect": "Connect an approved sender before emailing supplier orders.",
        "today.setup.email.reconnect": "Reconnect the approved sender before emailing supplier orders.",
        "today.setup.email.complete": "The approved Gmail sender is connected."
      },
      connectSalesTitle: "Connect restaurant sales",
      connectSalesDetail: "Connect a supported POS or import workflow before relying on live sales signals.",
      salesConnectedTitle: (providerName) => `${providerName} sales connected`,
      salesConnectedDetail: "The current sales source is connected.",
      repairSalesTitle: (providerName) => `Fix ${providerName} sales connection`,
      repairSalesErrorDetail: "The provider reports an error. Review the connection before relying on current sales.",
      repairSalesPausedDetail: "Sales synchronization is paused. Review the connection to resume current signals.",
      repairSalesDisconnectedDetail: "This sales source is not connected.",
      reviewInsightTitle: (typeLabel) => `Review ${typeLabel}`,
      reviewInsightDetail: "Open the evidence and recommended action before the next service window."
    },
    insight: {
      inventoryCriticalTitle: (itemName) => `${itemName} may run out today`,
      inventoryLowTitle: (itemName) => `${itemName} is below its normal level`,
      inventoryDescription: (itemName, quantity, unit) => `${itemName} is projected at ${quantity} ${unit} after mapped POS demand.`,
      inventoryWhy: "This can interrupt prep or force an 86 mid-service.",
      inventoryAction: (supplierName, quantity, unit) => `Check the walk-in, then add ${quantity} ${unit} on the next ${supplierName} ticket.`,
      salesTitle: (itemName) => `${itemName} demand is rising`,
      salesDescription: (itemName, lift) => `${itemName} is ${lift} above its recent service-day baseline.`,
      salesWhy: "Pull prep forward or you may 86 linked dishes before the next order lands.",
      salesAction: (itemName) => `Before the next prep window, confirm walk-in counts for ingredients tied to ${itemName}.`,
      prepTitle: (menuItemName) => `${menuItemName} depends on low stock`,
      prepDescription: (menuItemName, inventoryItemName) => `${menuItemName} is selling hard and uses ${inventoryItemName}, which is already below reorder.`,
      prepWhy: "A top seller can get 86'd mid-service if this ingredient runs out.",
      prepAction: (supplierName) => `Before prep, put the short ingredient on the next ${supplierName} ticket.`,
      wasteTitle: (itemName) => `${itemName} may be overstocked`,
      wasteDescription: (itemName, quantity, unit) => `${itemName} has about ${quantity} ${unit}, more than projected use.`,
      wasteWhy: "Extra on hand can spoil or tie up cash before the next rush needs it.",
      wasteAction: (itemName) => `Skip or trim the next ${itemName} order unless tonight’s sales stay hot.`
    },
    memory: {
      reliableLabel: "Mise memory is reliable",
      buildingLabel: "Mise memory is building",
      needsProofLabel: "Mise needs more proof",
      reliableCopy: "I’m getting sharper on your rush, counts, and what you approve—enough to coach the next prep window.",
      buildingCopy: "I’m still learning your house: recipes, sales, counts, and orders. Keep updating after service and I’ll get sharper.",
      nextSteps: {
        "memory.next.recipe_coverage": "Map missing POS items to ingredients so I can protect prep, not just guess.",
        "memory.next.demand_history": "Give me about seven service days so I learn your real rush pattern.",
        "memory.next.send_approved": "Send approved supplier drafts so I remember what you actually order.",
        "memory.next.first_order": "Approve and send the first supplier draft to start ordering memory.",
        "memory.next.keep_counts_current": "Update counts after service so I can time the next reorder better."
      },
      recipeLabel: "Recipe coverage",
      recipeDetail: (count, rawCount) => `${count} dish-to-stock ${rawCount === 1 ? "link" : "links"}`,
      depletionLabel: "POS depletion",
      depletionDetail: (count, rawCount) => `${count} stock ${rawCount === 1 ? "item moved" : "items moved"} by sales`,
      demandLabel: "Demand memory",
      demandDetail: (count, rawCount) => `${count} rolling menu ${rawCount === 1 ? "pattern" : "patterns"}`,
      orderLabel: "Order memory",
      orderDetail: (count, rawCount) => `${count} sent or ordered ${rawCount === 1 ? "decision" : "decisions"}`,
      insightLabel: "Signals",
      insightDetail: (count, rawCount) => `${count} ${rawCount === 1 ? "insight" : "insights"} generated today`,
      learningValue: "Learning",
      dayValue: (days) => `${days}d`
    }
  },
  es: {
    evidenceLabel: "Evidencia",
    sourceRecommendationLabel: "Recomendación de origen",
    insightType: {
      sales: "señal de ventas",
      inventory: "señal de inventario",
      waste: "señal de desperdicio",
      cost: "señal de costos",
      prep: "señal de preparación",
      ordering: "señal de pedidos"
    },
    today: {
      recommendationReviewTitle: (itemName) => `Revisar reposición de ${itemName}`,
      recommendationReviewDetail: "Se requiere aprobación del operador antes de cambiar el estado del pedido.",
      recommendationDraftTitle: (supplierName) => `Preparar borrador para ${supplierName}`,
      recommendationDraftDetail: (itemName) => `${itemName} está aprobado. Crea y revisa el borrador antes de enviarlo.`,
      confirmCountTitle: (itemName) => `Confirmar conteo de ${itemName}`,
      confirmCountDetail: (quantity, unit) => `Proyección: ${quantity} ${unit}. Actualiza el conteo antes de decidir el pedido.`,
      resolveStockTitle: (itemName) => `Resolver riesgo de inventario de ${itemName}`,
      resolveStockDetail: (quantity, unit) => `Proyección: ${quantity} ${unit}. Revisa el conteo y la cobertura del proveedor.`,
      sendOrderTitle: (supplierName) => `Enviar pedido a ${supplierName}`,
      reviewOrderTitle: (supplierName) => `Revisar pedido de ${supplierName}`,
      orderDeliveryDetail: "Este pedido tiene un compromiso de entrega del proveedor.",
      orderDraftDetail: "Revisa el borrador aprobado antes de enviarlo fuera del restaurante.",
      setupTitles: {
        "today.setup.profile.open": "Completar perfil del restaurante",
        "today.setup.profile.complete": "Perfil del restaurante completo",
        "today.setup.inventory.open": "Completar base de inventario",
        "today.setup.inventory.complete": "Base de inventario completa",
        "today.setup.recipes.open": "Vincular recetas con inventario",
        "today.setup.recipes.complete": "Vinculación de recetas completa",
        "today.setup.email.connect": "Conectar remitente de Gmail",
        "today.setup.email.reconnect": "Reconectar remitente de Gmail",
        "today.setup.email.complete": "Remitente de Gmail conectado"
      },
      setupDetails: {
        "today.setup.profile.open": "Completa el perfil operativo antes de usar orientación específica del restaurante.",
        "today.setup.profile.complete": "El perfil del restaurante está listo para revisión.",
        "today.setup.inventory.open": "Añade la base de existencias antes de usar la cobertura de reposición.",
        "today.setup.inventory.complete": "La base de inventario está lista para revisión.",
        "today.setup.recipes.open": "Vincula platos con existencias para que las ventas calculen el consumo.",
        "today.setup.recipes.complete": "La vinculación entre recetas e inventario está lista para revisión.",
        "today.setup.email.connect": "Conecta un remitente aprobado antes de enviar pedidos por correo.",
        "today.setup.email.reconnect": "Reconecta el remitente aprobado antes de enviar pedidos por correo.",
        "today.setup.email.complete": "El remitente de Gmail aprobado está conectado."
      },
      connectSalesTitle: "Conectar ventas del restaurante",
      connectSalesDetail: "Conecta un POS compatible o una importación antes de usar señales de ventas en vivo.",
      salesConnectedTitle: (providerName) => `Ventas de ${providerName} conectadas`,
      salesConnectedDetail: "La fuente de ventas actual está conectada.",
      repairSalesTitle: (providerName) => `Corregir conexión de ventas de ${providerName}`,
      repairSalesErrorDetail: "El proveedor informa un error. Revisa la conexión antes de usar las ventas actuales.",
      repairSalesPausedDetail: "La sincronización de ventas está pausada. Revisa la conexión para reanudar las señales.",
      repairSalesDisconnectedDetail: "Esta fuente de ventas no está conectada.",
      reviewInsightTitle: (typeLabel) => `Revisar ${typeLabel}`,
      reviewInsightDetail: "Abre la evidencia y la acción recomendada antes del próximo servicio."
    },
    insight: {
      inventoryCriticalTitle: (itemName) => `${itemName} podría agotarse hoy`,
      inventoryLowTitle: (itemName) => `${itemName} está por debajo de su nivel normal`,
      inventoryDescription: (itemName, quantity, unit) => `La proyección de ${itemName} es ${quantity} ${unit} después de la demanda POS vinculada.`,
      inventoryWhy: "Una cobertura baja de ingredientes puede interrumpir la preparación o el servicio.",
      inventoryAction: (supplierName, quantity, unit) => `Revisa el pedido de ${supplierName} y añade ${quantity} ${unit}.`,
      salesTitle: (itemName) => `La demanda de ${itemName} está aumentando`,
      salesDescription: (itemName, lift) => `${itemName} está ${lift} por encima de su referencia reciente por día de servicio.`,
      salesWhy: "Los ingredientes vinculados pueden agotarse más rápido que el ritmo habitual de pedidos.",
      salesAction: (itemName) => `Revisa el inventario vinculado con ${itemName} antes de la próxima preparación.`,
      prepTitle: (menuItemName) => `${menuItemName} depende de existencias bajas`,
      prepDescription: (menuItemName, inventoryItemName) => `${menuItemName} se vende bien y usa ${inventoryItemName}, que está bajo su nivel de reposición.`,
      prepWhy: "Un plato de alta venta depende de un ingrediente que quizá no cubra el próximo servicio.",
      prepAction: (supplierName) => `Revisa el próximo pedido de ${supplierName}.`,
      wasteTitle: (itemName) => `${itemName} podría tener exceso de existencias`,
      wasteDescription: (itemName, quantity, unit) => `Hay cerca de ${quantity} ${unit} de ${itemName}, más que el uso proyectado.`,
      wasteWhy: "El exceso de existencias puede inmovilizar efectivo o aumentar el riesgo de desperdicio.",
      wasteAction: (itemName) => `Retrasa el próximo pedido de ${itemName} salvo que aumenten las ventas.`
    },
    memory: {
      reliableLabel: "La memoria de Mise es confiable",
      buildingLabel: "La memoria de Mise se está formando",
      needsProofLabel: "Mise necesita más evidencia",
      reliableCopy: "Las recetas, el consumo POS y las decisiones de gerencia aportan evidencia suficiente para explicar las recomendaciones.",
      buildingCopy: "Mise recopila evidencia de recetas, ventas, conteos y pedidos antes de automatizar más del flujo.",
      nextSteps: {
        "memory.next.recipe_coverage": "Vincula los artículos POS faltantes con ingredientes antes de usar pedidos automatizados.",
        "memory.next.demand_history": "Reúne al menos siete días de servicio para que Mise aprenda la demanda del restaurante.",
        "memory.next.send_approved": "Envía los borradores aprobados para que Mise recuerde el criterio real del operador.",
        "memory.next.first_order": "Aprueba y envía el primer borrador de proveedor para crear historial de pedidos.",
        "memory.next.keep_counts_current": "Actualiza los conteos después del servicio para que Mise refine el momento de reposición."
      },
      recipeLabel: "Cobertura de recetas",
      recipeDetail: (count, rawCount) => `${count} ${rawCount === 1 ? "vínculo" : "vínculos"} entre platos y existencias`,
      depletionLabel: "Consumo por POS",
      depletionDetail: (count, rawCount) => `${count} ${rawCount === 1 ? "artículo movido" : "artículos movidos"} por ventas`,
      demandLabel: "Memoria de demanda",
      demandDetail: (count, rawCount) => `${count} ${rawCount === 1 ? "patrón móvil" : "patrones móviles"} del menú`,
      orderLabel: "Memoria de pedidos",
      orderDetail: (count, rawCount) => `${count} ${rawCount === 1 ? "decisión enviada o pedida" : "decisiones enviadas o pedidas"}`,
      insightLabel: "Señales",
      insightDetail: (count, rawCount) => `${count} ${rawCount === 1 ? "análisis generado" : "análisis generados"} hoy`,
      learningValue: "Aprendiendo",
      dayValue: (days) => `${days} d`
    }
  },
  "zh-Hans": {
    evidenceLabel: "依据",
    sourceRecommendationLabel: "来源建议",
    insightType: {
      sales: "销售信号",
      inventory: "库存信号",
      waste: "损耗信号",
      cost: "成本信号",
      prep: "备餐信号",
      ordering: "订货信号"
    },
    today: {
      recommendationReviewTitle: (itemName) => `审核 ${itemName} 补货`,
      recommendationReviewDetail: "此建议必须经过操作员批准后才能改变订货状态。",
      recommendationDraftTitle: (supplierName) => `准备 ${supplierName} 供应商草稿`,
      recommendationDraftDetail: (itemName) => `${itemName} 已获批准。请创建草稿并在发送前审核。`,
      confirmCountTitle: (itemName) => `确认 ${itemName} 盘点数量`,
      confirmCountDetail: (quantity, unit) => `预计剩余 ${quantity} ${unit}。请先更新盘点数量，再决定是否订货。`,
      resolveStockTitle: (itemName) => `处理 ${itemName} 库存风险`,
      resolveStockDetail: (quantity, unit) => `预计剩余 ${quantity} ${unit}。请检查盘点数量和供应保障。`,
      sendOrderTitle: (supplierName) => `发送 ${supplierName} 订单`,
      reviewOrderTitle: (supplierName) => `审核 ${supplierName} 订单`,
      orderDeliveryDetail: "此订单已记录供应商交货承诺。",
      orderDraftDetail: "请在订单离开餐厅前审核已批准的草稿。",
      setupTitles: {
        "today.setup.profile.open": "完善餐厅资料",
        "today.setup.profile.complete": "餐厅资料已完成",
        "today.setup.inventory.open": "完成库存基线",
        "today.setup.inventory.complete": "库存基线已完成",
        "today.setup.recipes.open": "将菜谱关联到库存",
        "today.setup.recipes.complete": "菜谱关联已完成",
        "today.setup.email.connect": "连接 Gmail 发件账号",
        "today.setup.email.reconnect": "重新连接 Gmail 发件账号",
        "today.setup.email.complete": "Gmail 发件账号已连接"
      },
      setupDetails: {
        "today.setup.profile.open": "请先完善运营资料，再使用餐厅专属建议。",
        "today.setup.profile.complete": "餐厅资料已可供审核。",
        "today.setup.inventory.open": "请先添加当前库存基线，再使用补货覆盖预测。",
        "today.setup.inventory.complete": "库存基线已可供审核。",
        "today.setup.recipes.open": "将菜品关联到库存，让销售数据计算消耗。",
        "today.setup.recipes.complete": "菜谱与库存的关联已可供审核。",
        "today.setup.email.connect": "发送供应商订单前，请连接已批准的发件账号。",
        "today.setup.email.reconnect": "发送供应商订单前，请重新连接已批准的发件账号。",
        "today.setup.email.complete": "已批准的 Gmail 发件账号已连接。"
      },
      connectSalesTitle: "连接餐厅销售数据",
      connectSalesDetail: "请先连接支持的 POS 或导入流程，再使用实时销售信号。",
      salesConnectedTitle: (providerName) => `${providerName} 销售数据已连接`,
      salesConnectedDetail: "当前销售数据源已连接。",
      repairSalesTitle: (providerName) => `修复 ${providerName} 销售连接`,
      repairSalesErrorDetail: "提供商报告连接错误。请先检查连接，再使用当前销售数据。",
      repairSalesPausedDetail: "销售同步已暂停。请检查连接以恢复当前信号。",
      repairSalesDisconnectedDetail: "此销售数据源尚未连接。",
      reviewInsightTitle: (typeLabel) => `查看${typeLabel}`,
      reviewInsightDetail: "请在下一个营业时段前查看依据和建议操作。"
    },
    insight: {
      inventoryCriticalTitle: (itemName) => `${itemName} 今天可能用完`,
      inventoryLowTitle: (itemName) => `${itemName} 低于正常库存水平`,
      inventoryDescription: (itemName, quantity, unit) => `根据已关联的 POS 需求，${itemName} 预计剩余 ${quantity} ${unit}。`,
      inventoryWhy: "原料覆盖不足可能影响备餐或营业。",
      inventoryAction: (supplierName, quantity, unit) => `请审核 ${supplierName} 订单并添加 ${quantity} ${unit}。`,
      salesTitle: (itemName) => `${itemName} 需求正在上升`,
      salesDescription: (itemName, lift) => `${itemName} 比近期营业日基线高 ${lift}。`,
      salesWhy: "关联原料的消耗速度可能快于通常的订货节奏。",
      salesAction: (itemName) => `请在下次备餐前检查与 ${itemName} 关联的库存。`,
      prepTitle: (menuItemName) => `${menuItemName} 依赖低库存原料`,
      prepDescription: (menuItemName, inventoryItemName) => `${menuItemName} 销量较高，但使用的 ${inventoryItemName} 已低于补货水平。`,
      prepWhy: "畅销菜品依赖的原料可能不足以覆盖下一个营业时段。",
      prepAction: (supplierName) => `请审核下一份 ${supplierName} 订单。`,
      wasteTitle: (itemName) => `${itemName} 可能库存过多`,
      wasteDescription: (itemName, quantity, unit) => `${itemName} 约有 ${quantity} ${unit}，高于预计用量。`,
      wasteWhy: "库存过多可能占用现金或增加损耗风险。",
      wasteAction: (itemName) => `除非销量上升，否则请推迟下一次 ${itemName} 订货。`
    },
    memory: {
      reliableLabel: "Mise 运营记忆可靠",
      buildingLabel: "Mise 正在建立运营记忆",
      needsProofLabel: "Mise 需要更多依据",
      reliableCopy: "菜谱基线、POS 消耗和经理决策已提供足够依据来解释建议。",
      buildingCopy: "Mise 正在收集菜谱、销售、盘点和订货依据，再逐步扩展自动化流程。",
      nextSteps: {
        "memory.next.recipe_coverage": "依赖自动订货前，请将缺少的 POS 菜品关联到原料。",
        "memory.next.demand_history": "请至少收集七个营业日的数据，让 Mise 学习餐厅专属需求。",
        "memory.next.send_approved": "请发送已批准的供应商草稿，让 Mise 记住操作员的实际订货判断。",
        "memory.next.first_order": "请批准并发送第一份供应商草稿，以建立订货历史。",
        "memory.next.keep_counts_current": "请在营业后持续更新盘点数量，让 Mise 优化补货时机。"
      },
      recipeLabel: "菜谱覆盖率",
      recipeDetail: (count) => `${count} 条菜品与库存关联`,
      depletionLabel: "POS 消耗",
      depletionDetail: (count) => `销售带动 ${count} 项库存消耗`,
      demandLabel: "需求记忆",
      demandDetail: (count) => `${count} 个滚动菜品模式`,
      orderLabel: "订货记忆",
      orderDetail: (count) => `${count} 次已发送或已订货决策`,
      insightLabel: "信号",
      insightDetail: (count) => `今日生成 ${count} 条洞察`,
      learningValue: "学习中",
      dayValue: (days) => `${days} 天`
    }
  }
};

export function presentOperationalTodayTask(
  locale: AppLocale,
  task: Pick<OperationalTodayTask, "title" | "detail" | "presentation">
): PresentedOperationalCopy {
  const copy = copyByLocale[locale];
  const descriptor = task.presentation;
  if (!descriptor) {
    return {
      title: task.title,
      detail: `${copy.evidenceLabel}: ${task.detail}`,
      evidenceOnly: true
    };
  }

  const quantity = (value: number) => formatQuantity(locale, value);
  const { code, values } = descriptor;
  if (code === "today.recommendation.review") {
    return result(copy.today.recommendationReviewTitle(values.itemName), copy.today.recommendationReviewDetail);
  }
  if (code === "today.recommendation.prepare_draft") {
    return result(
      copy.today.recommendationDraftTitle(values.supplierName),
      copy.today.recommendationDraftDetail(values.itemName)
    );
  }
  if (code === "today.inventory.confirm_count") {
    return result(
      copy.today.confirmCountTitle(values.itemName),
      copy.today.confirmCountDetail(quantity(values.projectedQuantity), values.unit)
    );
  }
  if (code === "today.inventory.resolve_stock") {
    return result(
      copy.today.resolveStockTitle(values.itemName),
      copy.today.resolveStockDetail(quantity(values.projectedQuantity), values.unit)
    );
  }
  if (code === "today.order.send" || code === "today.order.review") {
    return result(
      code === "today.order.send"
        ? copy.today.sendOrderTitle(values.supplierName)
        : copy.today.reviewOrderTitle(values.supplierName),
      values.deliveryDate ? copy.today.orderDeliveryDetail : copy.today.orderDraftDetail
    );
  }
  if (code.startsWith("today.setup.")) {
    const setupCode = code as SetupPresentationCode;
    return result(copy.today.setupTitles[setupCode], copy.today.setupDetails[setupCode]);
  }
  if (code === "today.integration.connect") {
    return result(copy.today.connectSalesTitle, copy.today.connectSalesDetail);
  }
  if (code === "today.integration.connected") {
    return result(copy.today.salesConnectedTitle(values.providerName), copy.today.salesConnectedDetail);
  }
  if (code === "today.integration.repair") {
    const detail = values.status === "error"
      ? copy.today.repairSalesErrorDetail
      : values.status === "paused"
        ? copy.today.repairSalesPausedDetail
        : copy.today.repairSalesDisconnectedDetail;
    return result(copy.today.repairSalesTitle(values.providerName), detail);
  }
  if (code === "today.insight.review") {
    return result(
      copy.today.reviewInsightTitle(copy.insightType[values.insightType]),
      copy.today.reviewInsightDetail
    );
  }

  throw new Error(`Unsupported Today task presentation code: ${String(code)}`);
}

export function insightPresentationDescriptor(
  insight: Pick<Insight, "insight_type" | "title" | "description" | "why_it_matters" | "recommended_action" | "presentation">
): InsightPresentationDescriptor {
  return insight.presentation ?? {
    code: "insight.evidence.opaque",
    values: {
      insightType: insight.insight_type,
      rawTitle: insight.title,
      rawDescription: insight.description,
      rawWhyItMatters: insight.why_it_matters ?? null,
      rawRecommendedAction: insight.recommended_action
    }
  };
}

export function presentInsight(locale: AppLocale, insight: Insight): PresentedInsightCopy {
  const copy = copyByLocale[locale];
  const descriptor = insightPresentationDescriptor(insight);
  const { code, values } = descriptor;
  if (code === "insight.rule.inventory.stock_risk") {
    return {
      title: values.status === "Critical"
        ? copy.insight.inventoryCriticalTitle(values.itemName)
        : copy.insight.inventoryLowTitle(values.itemName),
      description: copy.insight.inventoryDescription(
        values.itemName,
        formatQuantity(locale, values.projectedQuantity),
        values.unit
      ),
      whyItMatters: copy.insight.inventoryWhy,
      recommendedAction: copy.insight.inventoryAction(
        values.supplierName,
        formatQuantity(locale, values.suggestedOrderQuantity),
        values.unit
      ),
      evidenceOnly: false
    };
  }
  if (code === "insight.rule.sales.demand_rising") {
    return {
      title: copy.insight.salesTitle(values.itemName),
      description: copy.insight.salesDescription(values.itemName, formatPercent(locale, values.liftPercent)),
      whyItMatters: copy.insight.salesWhy,
      recommendedAction: copy.insight.salesAction(values.itemName),
      evidenceOnly: false
    };
  }
  if (code === "insight.rule.prep.low_stock") {
    return {
      title: copy.insight.prepTitle(values.menuItemName),
      description: copy.insight.prepDescription(values.menuItemName, values.inventoryItemName),
      whyItMatters: copy.insight.prepWhy,
      recommendedAction: copy.insight.prepAction(values.supplierName),
      evidenceOnly: false
    };
  }
  if (code === "insight.rule.waste.overstock") {
    return {
      title: copy.insight.wasteTitle(values.itemName),
      description: copy.insight.wasteDescription(
        values.itemName,
        formatQuantity(locale, values.quantity),
        values.unit
      ),
      whyItMatters: copy.insight.wasteWhy,
      recommendedAction: copy.insight.wasteAction(values.itemName),
      evidenceOnly: false
    };
  }
  if (code === "insight.evidence.opaque") {
    return {
      title: sentenceCase(copy.insightType[values.insightType], locale),
      description: `${copy.evidenceLabel}: ${values.rawTitle}. ${values.rawDescription}`,
      whyItMatters: values.rawWhyItMatters
        ? `${copy.evidenceLabel}: ${values.rawWhyItMatters}`
        : null,
      recommendedAction: `${copy.sourceRecommendationLabel}: ${values.rawRecommendedAction}`,
      evidenceOnly: true
    };
  }
  return assertNever(code);
}

export function presentLearningMemory(
  locale: AppLocale,
  memory: LearningMemorySummary
): PresentedLearningMemory {
  const copy = copyByLocale[locale];
  const presentation = memory.presentation;
  const label = presentation
    ? presentation.labelCode === "memory.label.reliable"
      ? copy.memory.reliableLabel
      : presentation.labelCode === "memory.label.building"
        ? copy.memory.buildingLabel
        : copy.memory.needsProofLabel
    : memory.label;
  const operatorCopy = presentation
    ? presentation.operatorCopyCode === "memory.copy.reliable"
      ? copy.memory.reliableCopy
      : copy.memory.buildingCopy
    : memory.operatorCopy;
  const nextStep = presentation
    ? copy.memory.nextSteps[presentation.nextStepCode]
    : `${copy.evidenceLabel}: ${memory.nextStep}`;
  return {
    label,
    operatorCopy,
    nextStep,
    signals: memory.signals.map((signal) => presentLearningMemorySignal(locale, signal))
  };
}

export function presentLearningMemorySignal(
  locale: AppLocale,
  signal: LearningMemorySignal
): PresentedLearningMemorySignal {
  const copy = copyByLocale[locale];
  const descriptor = signal.presentation;
  if (!descriptor) {
    return {
      label: signal.label,
      value: signal.value,
      detail: `${copy.evidenceLabel}: ${signal.detail}`
    };
  }
  return presentStructuredMemorySignal(locale, copy, descriptor);
}

function presentStructuredMemorySignal(
  locale: AppLocale,
  copy: OperationsCopy,
  descriptor: LearningMemorySignalPresentationDescriptor
): PresentedLearningMemorySignal {
  const { code, values } = descriptor;
  if (code === "memory.signal.recipe_coverage") {
    return {
      label: copy.memory.recipeLabel,
      value: formatLocalizedNumber(locale, values.coveragePercent / 100, {
        style: "percent",
        maximumFractionDigits: 0
      }),
      detail: copy.memory.recipeDetail(formatInteger(locale, values.ingredientMappings), values.ingredientMappings)
    };
  }
  if (code === "memory.signal.pos_depletion") {
    return {
      label: copy.memory.depletionLabel,
      value: formatInteger(locale, values.itemCount),
      detail: copy.memory.depletionDetail(formatInteger(locale, values.itemCount), values.itemCount)
    };
  }
  if (code === "memory.signal.demand") {
    return {
      label: copy.memory.demandLabel,
      value: values.historyDays > 0
        ? copy.memory.dayValue(formatInteger(locale, values.historyDays))
        : copy.memory.learningValue,
      detail: copy.memory.demandDetail(formatInteger(locale, values.menuPatternCount), values.menuPatternCount)
    };
  }
  if (code === "memory.signal.orders") {
    return {
      label: copy.memory.orderLabel,
      value: formatInteger(locale, values.decisionCount),
      detail: copy.memory.orderDetail(formatInteger(locale, values.decisionCount), values.decisionCount)
    };
  }
  if (code === "memory.signal.insights") {
    return {
      label: copy.memory.insightLabel,
      value: formatInteger(locale, values.signalCount),
      detail: copy.memory.insightDetail(formatInteger(locale, values.signalCount), values.signalCount)
    };
  }
  return assertNever(code);
}

function result(title: string, detail: string): PresentedOperationalCopy {
  return { title, detail, evidenceOnly: false };
}

export interface PresentedOperatingPlanItem {
  title: string;
  detail: string;
  why: string;
  effect: string;
  neededByLabel: string | null;
  windowLabel: string;
  verificationLabel: string;
  kindLabel: string;
  completionResult: string | null;
  reprioritizationReason: string | null;
  evidenceOnly: boolean;
}

const operatingPlanCopyByLocale: Readonly<
  Record<
    AppLocale,
    {
      windows: Record<ServiceWindowId, string>;
      verification: Record<VerificationMethod, string>;
      kinds: Record<OperatingPlanItemKind, string>;
      reprioritization: Record<ReprioritizationCode, (detail: string) => string>;
    }
  >
> = {
  en: {
    windows: {
      before_prep: "Before prep",
      before_lunch: "Before lunch",
      before_supplier_cutoff: "Before supplier cutoff",
      before_dinner: "Before dinner",
      during_service: "During service",
      closing: "Closing",
      end_of_day: "End of day",
      unscheduled: "Unscheduled"
    },
    verification: {
      count: "Verify by count",
      review: "Verify by review",
      receipt: "Verify by receipt",
      provider_sync: "Verify by provider sync",
      none: "No verification step"
    },
    kinds: {
      mise_task: "Mise task",
      human_task: "Floor task",
      approval: "Approval",
      observation: "Observation",
      monitoring: "Monitoring",
      completed: "Completed",
      failed: "Failed"
    },
    reprioritization: {
      overdue_deadline: (detail) => detail || "Moved to Now: evidenced deadline is overdue.",
      delivery_overdue: (detail) => detail || "Moved to Now: delivery date is past.",
      delivery_due_today: (detail) => detail || "Moved to Now: delivery is needed today.",
      due_soon: (detail) => detail || "Moved to Now: deadline is due soon.",
      stock_risk: (detail) => detail || "Moved to Now: projected stock risk.",
      provider_failure: (detail) => detail || "Moved to Now: sales connection failed."
    }
  },
  es: {
    windows: {
      before_prep: "Antes de prep",
      before_lunch: "Antes del almuerzo",
      before_supplier_cutoff: "Antes del corte del proveedor",
      before_dinner: "Antes de la cena",
      during_service: "Durante el servicio",
      closing: "Cierre",
      end_of_day: "Fin del día",
      unscheduled: "Sin horario"
    },
    verification: {
      count: "Verificar con conteo",
      review: "Verificar con revisión",
      receipt: "Verificar con recepción",
      provider_sync: "Verificar con sync del proveedor",
      none: "Sin paso de verificación"
    },
    kinds: {
      mise_task: "Tarea Mise",
      human_task: "Tarea de piso",
      approval: "Aprobación",
      observation: "Observación",
      monitoring: "Monitoreo",
      completed: "Completada",
      failed: "Fallida"
    },
    reprioritization: {
      overdue_deadline: (detail) => detail || "Movida a Ahora: la fecha límite evidenciada ya pasó.",
      delivery_overdue: (detail) => detail || "Movida a Ahora: la entrega está atrasada.",
      delivery_due_today: (detail) => detail || "Movida a Ahora: la entrega se necesita hoy.",
      due_soon: (detail) => detail || "Movida a Ahora: la fecha límite es pronto.",
      stock_risk: (detail) => detail || "Movida a Ahora: riesgo de stock proyectado.",
      provider_failure: (detail) => detail || "Movida a Ahora: falló la conexión de ventas."
    }
  },
  "zh-Hans": {
    windows: {
      before_prep: "备餐前",
      before_lunch: "午餐前",
      before_supplier_cutoff: "供应商截止前",
      before_dinner: "晚餐前",
      during_service: "营业中",
      closing: "收工",
      end_of_day: "当日结束前",
      unscheduled: "未排程"
    },
    verification: {
      count: "以盘点核实",
      review: "以复核核实",
      receipt: "以收货核实",
      provider_sync: "以供应商同步核实",
      none: "无需核实步骤"
    },
    kinds: {
      mise_task: "Mise 任务",
      human_task: "现场任务",
      approval: "待批准",
      observation: "观察项",
      monitoring: "监控中",
      completed: "已完成",
      failed: "失败"
    },
    reprioritization: {
      overdue_deadline: (detail) => detail || "已调至现在：有证据的截止时间已过。",
      delivery_overdue: (detail) => detail || "已调至现在：送货日期已过。",
      delivery_due_today: (detail) => detail || "已调至现在：今日需要送货。",
      due_soon: (detail) => detail || "已调至现在：截止时间将至。",
      stock_risk: (detail) => detail || "已调至现在：存在库存风险。",
      provider_failure: (detail) => detail || "已调至现在：销售连接失败。"
    }
  }
};

export function presentServiceWindowLabel(locale: AppLocale, windowId: ServiceWindowId) {
  return operatingPlanCopyByLocale[locale].windows[windowId];
}

export function presentOperatingPlanItem(
  locale: AppLocale,
  item: OperatingPlanItem
): PresentedOperatingPlanItem {
  const copy = operatingPlanCopyByLocale[locale];
  const taskCopy = item.sourceTask
    ? presentOperationalTodayTask(locale, item.sourceTask)
    : {
        title: item.title,
        detail: item.detail,
        actionLabel: item.title,
        evidenceOnly: true
      };
  return {
    title: taskCopy.title,
    detail: taskCopy.detail,
    why: item.why,
    effect: item.effect,
    neededByLabel: item.neededBy,
    windowLabel: copy.windows[item.serviceWindow],
    verificationLabel: copy.verification[item.verificationMethod],
    kindLabel: copy.kinds[item.kind],
    completionResult: item.completionResult,
    reprioritizationReason: item.reprioritization
      ? copy.reprioritization[item.reprioritization.code](item.reprioritization.reason)
      : null,
    evidenceOnly: taskCopy.evidenceOnly
  };
}

function formatQuantity(locale: AppLocale, value: number) {
  return formatLocalizedNumber(locale, value, { maximumFractionDigits: 2 });
}

function formatInteger(locale: AppLocale, value: number) {
  return formatLocalizedNumber(locale, value, { maximumFractionDigits: 0 });
}

function formatPercent(locale: AppLocale, value: number) {
  return formatLocalizedNumber(locale, value / 100, { style: "percent", maximumFractionDigits: 0 });
}

function sentenceCase(value: string, locale: AppLocale) {
  if (locale === "zh-Hans" || value.length === 0) return value;
  return `${value.charAt(0).toLocaleUpperCase(locale)}${value.slice(1)}`;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported operations presentation code: ${String(value)}`);
}

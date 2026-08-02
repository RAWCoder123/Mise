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
  OperationalTodayTask,
  OperationalTodayTaskActionIntent
} from "../domain/todayTasks";

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
    beginCountSessionTitle: string;
    beginCountSessionDetail: (riskItemCount: string) => string;
    continueCountSessionTitle: string;
    continueCountSessionDetail: string;
    approveCountSessionTitle: string;
    approveCountSessionDetail: string;
    sendOrderTitle: (supplierName: string) => string;
    receiveOrderTitle: (supplierName: string) => string;
    reviewOrderTitle: (supplierName: string) => string;
    orderDeliveryDetail: string;
    orderReceiveDetail: string;
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
    mapUnmappedRecipesTitle: (unmappedCount: number, unmappedCountLabel: string, sampleItemName: string | null) => string;
    mapUnmappedRecipesDetail: (unmappedCount: number, unmappedCountLabel: string, sampleItemName: string | null) => string;
    repairIncompatibleRecipesTitle: (
      incompatibleCount: number,
      incompatibleCountLabel: string,
      sampleItemName: string | null
    ) => string;
    repairIncompatibleRecipesDetail: (
      incompatibleCount: number,
      incompatibleCountLabel: string,
      sampleItemName: string | null
    ) => string;
    chronicShortShipTitle: (itemName: string) => string;
    chronicShortShipDetail: (
      supplierName: string,
      fillPercentLabel: string,
      sampleCountLabel: string
    ) => string;
    chronicWasteTitle: (itemName: string) => string;
    chronicWasteDetail: (lossPercentLabel: string, sampleCountLabel: string) => string;
    chronicCountShrinkTitle: (itemName: string) => string;
    chronicCountShrinkDetail: (lossPercentLabel: string, sampleCountLabel: string) => string;
    chronicManagerCorrectionTitle: (itemName: string) => string;
    chronicManagerCorrectionDetail: (lossPercentLabel: string, sampleCountLabel: string) => string;
    actions: {
      updateInventoryCount: string;
      beginCountSession: string;
      continueCountSession: string;
      reviewCountSession: string;
      reviewRecommendation: string;
      prepareDraft: string;
      sendOrder: string;
      receiveOrder: string;
      finishSetup: string;
      connectPos: string;
      managePosConnection: string;
      repairPosConnection: string;
      reviewInsight: string;
      mapUnmappedPosItems: string;
      repairIncompatibleRecipeUnits: string;
      reviewShortShips: string;
      reviewWaste: string;
      startRecount: string;
      reviewCorrections: string;
    };
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
    shortShipTitle: (itemName: string) => string;
    shortShipDescription: (
      supplierName: string,
      itemName: string,
      fillPercentLabel: string,
      sampleCountLabel: string
    ) => string;
    shortShipWhy: string;
    shortShipAction: (supplierName: string) => string;
    chronicWasteTitle: (itemName: string) => string;
    chronicWasteDescription: (
      itemName: string,
      lossPercentLabel: string,
      sampleCountLabel: string
    ) => string;
    chronicWasteWhy: string;
    chronicWasteAction: (itemName: string) => string;
    chronicCountShrinkTitle: (itemName: string) => string;
    chronicCountShrinkDescription: (
      itemName: string,
      lossPercentLabel: string,
      sampleCountLabel: string
    ) => string;
    chronicCountShrinkWhy: string;
    chronicCountShrinkAction: (itemName: string) => string;
    chronicManagerCorrectionTitle: (itemName: string) => string;
    chronicManagerCorrectionDescription: (
      itemName: string,
      lossPercentLabel: string,
      sampleCountLabel: string
    ) => string;
    chronicManagerCorrectionWhy: string;
    chronicManagerCorrectionAction: (itemName: string) => string;
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
      beginCountSessionTitle: "Start inventory count",
      beginCountSessionDetail: (riskItemCount) =>
        `${riskItemCount} stock-risk items need a multi-item count. Begin the session and submit it for manager approval.`,
      continueCountSessionTitle: "Continue inventory count",
      continueCountSessionDetail:
        "An inventory count session is in progress. Finish counting items and submit for approval.",
      approveCountSessionTitle: "Approve inventory count",
      approveCountSessionDetail:
        "A submitted multi-item count is waiting for manager approval before stock is updated.",
      sendOrderTitle: (supplierName) => `Send ${supplierName} order`,
      receiveOrderTitle: (supplierName) => `Receive ${supplierName} delivery`,
      reviewOrderTitle: (supplierName) => `Review ${supplierName} order`,
      orderDeliveryDetail: "A supplier delivery commitment is recorded for this order.",
      orderReceiveDetail: "Confirm received quantities so Mise updates on-hand inventory.",
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
      reviewInsightDetail: "Open the evidence and recommended action before the next service window.",
      mapUnmappedRecipesTitle: (unmappedCount, unmappedCountLabel, sampleItemName) =>
        unmappedCount === 1 && sampleItemName
          ? `Map ${sampleItemName} to ingredients`
          : sampleItemName
            ? `Map ${unmappedCountLabel} unmapped POS menu items, starting with ${sampleItemName}`
            : `Map ${unmappedCountLabel} unmapped POS menu items`,
      mapUnmappedRecipesDetail: (unmappedCount, unmappedCountLabel, sampleItemName) =>
        unmappedCount === 1 && sampleItemName
          ? `${sampleItemName} sold without a recipe baseline, so Mise cannot deplete inventory from those sales.`
          : sampleItemName
            ? `${unmappedCountLabel} sold POS menu items lack recipe baselines, including ${sampleItemName}, so Mise cannot deplete inventory from those sales.`
            : `${unmappedCountLabel} sold POS menu items lack recipe baselines, so Mise cannot deplete inventory from those sales.`,
      repairIncompatibleRecipesTitle: (incompatibleCount, incompatibleCountLabel, sampleItemName) =>
        incompatibleCount === 1 && sampleItemName
          ? `Fix recipe units for ${sampleItemName}`
          : sampleItemName
            ? `Fix units on ${incompatibleCountLabel} recipe mappings, starting with ${sampleItemName}`
            : `Fix units on ${incompatibleCountLabel} recipe mappings`,
      repairIncompatibleRecipesDetail: (incompatibleCount, incompatibleCountLabel, sampleItemName) =>
        incompatibleCount === 1 && sampleItemName
          ? `${sampleItemName} has a recipe unit that does not match its inventory item, so Mise cannot deplete stock from those sales.`
          : sampleItemName
            ? `${incompatibleCountLabel} recipe mappings use units that do not match inventory, including ${sampleItemName}, so Mise cannot deplete stock from those sales.`
            : `${incompatibleCountLabel} recipe mappings use units that do not match inventory, so Mise cannot deplete stock from those sales.`,
      chronicShortShipTitle: (itemName) => `${itemName} is often short-shipped`,
      chronicShortShipDetail: (supplierName, fillPercentLabel, sampleCountLabel) =>
        `Recent ${supplierName} deliveries averaged about ${fillPercentLabel} of ordered across ${sampleCountLabel} receives.`,
      chronicWasteTitle: (itemName) => `${itemName} has a chronic waste pattern`,
      chronicWasteDetail: (lossPercentLabel, sampleCountLabel) =>
        `Recent waste averaged about ${lossPercentLabel} of on-hand across ${sampleCountLabel} records.`,
      chronicCountShrinkTitle: (itemName) => `${itemName} often shrinks between counts`,
      chronicCountShrinkDetail: (lossPercentLabel, sampleCountLabel) =>
        `Recent counts averaged about ${lossPercentLabel} below system across ${sampleCountLabel} counts.`,
      chronicManagerCorrectionTitle: (itemName) => `${itemName} is often corrected down`,
      chronicManagerCorrectionDetail: (lossPercentLabel, sampleCountLabel) =>
        `Recent manager corrections averaged about ${lossPercentLabel} below system across ${sampleCountLabel} edits.`,
      actions: {
        updateInventoryCount: "Review count",
        beginCountSession: "Start count",
        continueCountSession: "Continue count",
        reviewCountSession: "Review count",
        reviewRecommendation: "Review recommendation",
        prepareDraft: "Prepare draft",
        sendOrder: "Review order",
        receiveOrder: "Receive delivery",
        finishSetup: "Continue setup",
        connectPos: "Connect POS",
        managePosConnection: "Manage connection",
        repairPosConnection: "Repair connection",
        reviewInsight: "Review insight",
        mapUnmappedPosItems: "Map recipes",
        repairIncompatibleRecipeUnits: "Fix recipe units",
        reviewShortShips: "Review short-ships",
        reviewWaste: "Review waste",
        startRecount: "Start recount",
        reviewCorrections: "Review corrections"
      }
    },
    insight: {
      inventoryCriticalTitle: (itemName) => `${itemName} may run out today`,
      inventoryLowTitle: (itemName) => `${itemName} is below its normal level`,
      inventoryDescription: (itemName, quantity, unit) => `${itemName} is projected at ${quantity} ${unit} after mapped POS demand.`,
      inventoryWhy: "Low ingredient coverage can interrupt prep or service.",
      inventoryAction: (supplierName, quantity, unit) => `Review the ${supplierName} order and add ${quantity} ${unit}.`,
      salesTitle: (itemName) => `${itemName} demand is rising`,
      salesDescription: (itemName, lift) => `${itemName} is ${lift} above its recent service-day baseline.`,
      salesWhy: "Linked ingredients may deplete faster than the usual ordering rhythm.",
      salesAction: (itemName) => `Review inventory tied to ${itemName} before the next prep window.`,
      prepTitle: (menuItemName) => `${menuItemName} depends on low stock`,
      prepDescription: (menuItemName, inventoryItemName) => `${menuItemName} is selling strongly and uses ${inventoryItemName}, which is below its reorder level.`,
      prepWhy: "A strong seller depends on an ingredient that may not cover the next service.",
      prepAction: (supplierName) => `Review the next ${supplierName} order.`,
      wasteTitle: (itemName) => `${itemName} may be overstocked`,
      wasteDescription: (itemName, quantity, unit) => `${itemName} has about ${quantity} ${unit}, more than projected use.`,
      wasteWhy: "Excess stock can tie up cash or increase waste risk.",
      wasteAction: (itemName) => `Delay the next ${itemName} order unless sales increase.`,
      shortShipTitle: (itemName) => `${itemName} is often short-shipped`,
      shortShipDescription: (supplierName, itemName, fillPercentLabel, sampleCountLabel) =>
        `Recent ${supplierName} deliveries for ${itemName} averaged about ${fillPercentLabel} of the ordered quantity across ${sampleCountLabel} receives.`,
      shortShipWhy: "Chronic short-ships leave less on hand than Mise ordered and can create avoidable stockouts.",
      shortShipAction: (supplierName) =>
        `Order slightly more from ${supplierName}, or confirm counts carefully when receiving.`,
      chronicWasteTitle: (itemName) => `${itemName} has a chronic waste pattern`,
      chronicWasteDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `Recent waste records for ${itemName} averaged about ${lossPercentLabel} of on-hand across ${sampleCountLabel} events.`,
      chronicWasteWhy: "Repeated waste silently reduces usable stock and can make par-based orders too light.",
      chronicWasteAction: (itemName) =>
        `Review prep and storage for ${itemName}, and confirm the next order covers expected loss.`,
      chronicCountShrinkTitle: (itemName) => `${itemName} often shrinks between counts`,
      chronicCountShrinkDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `Recent inventory counts for ${itemName} averaged about ${lossPercentLabel} below system across ${sampleCountLabel} counts.`,
      chronicCountShrinkWhy:
        "Unexplained shrink means Mise’s on-hand is drifting high and orders may understock the next service.",
      chronicCountShrinkAction: (itemName) =>
        `Investigate count process and theft/spoilage risk for ${itemName}, then recount before ordering.`,
      chronicManagerCorrectionTitle: (itemName) => `${itemName} is often corrected down`,
      chronicManagerCorrectionDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `Recent manager corrections for ${itemName} averaged about ${lossPercentLabel} below system across ${sampleCountLabel} edits.`,
      chronicManagerCorrectionWhy:
        "Repeated downward corrections mean Mise’s on-hand is drifting high and orders may understock the next service.",
      chronicManagerCorrectionAction: (itemName) =>
        `Review receiving, transfers, and counts for ${itemName}, then adjust par or recount before ordering.`
    },
    memory: {
      reliableLabel: "Mise memory is reliable",
      buildingLabel: "Mise memory is building",
      needsProofLabel: "Mise needs more proof",
      reliableCopy: "Recipe baselines, POS depletion, and manager decisions give Mise enough evidence to explain recommendations.",
      buildingCopy: "Mise is collecting recipe, sales, count, and ordering evidence before more workflow can be automated.",
      nextSteps: {
        "memory.next.recipe_coverage": "Map missing POS items to ingredients before relying on automated ordering.",
        "memory.next.demand_history": "Collect at least seven service days so Mise can learn restaurant-specific demand.",
        "memory.next.send_approved": "Send approved supplier drafts so Mise can remember the operator’s ordering judgment.",
        "memory.next.first_order": "Approve and send the first supplier draft to create ordering history.",
        "memory.next.keep_counts_current": "Keep updating counts after service so Mise can refine reorder timing."
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
      beginCountSessionTitle: "Iniciar conteo de inventario",
      beginCountSessionDetail: (riskItemCount) =>
        `${riskItemCount} artículos con riesgo de inventario necesitan un conteo de varios ítems. Inicia la sesión y envíala para aprobación del gerente.`,
      continueCountSessionTitle: "Continuar conteo de inventario",
      continueCountSessionDetail:
        "Hay una sesión de conteo en curso. Termina de contar y envíala para aprobación.",
      approveCountSessionTitle: "Aprobar conteo de inventario",
      approveCountSessionDetail:
        "Un conteo de varios artículos enviado espera aprobación del gerente antes de actualizar el stock.",
      sendOrderTitle: (supplierName) => `Enviar pedido a ${supplierName}`,
      receiveOrderTitle: (supplierName) => `Recibir entrega de ${supplierName}`,
      reviewOrderTitle: (supplierName) => `Revisar pedido de ${supplierName}`,
      orderDeliveryDetail: "Este pedido tiene un compromiso de entrega del proveedor.",
      orderReceiveDetail: "Confirma las cantidades recibidas para que Mise actualice el inventario disponible.",
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
      reviewInsightDetail: "Abre la evidencia y la acción recomendada antes del próximo servicio.",
      mapUnmappedRecipesTitle: (unmappedCount, unmappedCountLabel, sampleItemName) =>
        unmappedCount === 1 && sampleItemName
          ? `Vincular ${sampleItemName} con ingredientes`
          : sampleItemName
            ? `Vincular ${unmappedCountLabel} artículos POS sin receta, empezando por ${sampleItemName}`
            : `Vincular ${unmappedCountLabel} artículos POS sin receta`,
      mapUnmappedRecipesDetail: (unmappedCount, unmappedCountLabel, sampleItemName) =>
        unmappedCount === 1 && sampleItemName
          ? `${sampleItemName} se vendió sin una receta base, así que Mise no puede descontar inventario de esas ventas.`
          : sampleItemName
            ? `${unmappedCountLabel} artículos POS vendidos no tienen receta base, incluido ${sampleItemName}, así que Mise no puede descontar inventario de esas ventas.`
            : `${unmappedCountLabel} artículos POS vendidos no tienen receta base, así que Mise no puede descontar inventario de esas ventas.`,
      repairIncompatibleRecipesTitle: (incompatibleCount, incompatibleCountLabel, sampleItemName) =>
        incompatibleCount === 1 && sampleItemName
          ? `Corregir unidades de receta de ${sampleItemName}`
          : sampleItemName
            ? `Corregir unidades en ${incompatibleCountLabel} vínculos de receta, empezando por ${sampleItemName}`
            : `Corregir unidades en ${incompatibleCountLabel} vínculos de receta`,
      repairIncompatibleRecipesDetail: (incompatibleCount, incompatibleCountLabel, sampleItemName) =>
        incompatibleCount === 1 && sampleItemName
          ? `${sampleItemName} tiene una unidad de receta que no coincide con su artículo de inventario, así que Mise no puede descontar existencias de esas ventas.`
          : sampleItemName
            ? `${incompatibleCountLabel} vínculos de receta usan unidades que no coinciden con el inventario, incluido ${sampleItemName}, así que Mise no puede descontar existencias de esas ventas.`
            : `${incompatibleCountLabel} vínculos de receta usan unidades que no coinciden con el inventario, así que Mise no puede descontar existencias de esas ventas.`,
      chronicShortShipTitle: (itemName) => `${itemName} suele llegar incompleto`,
      chronicShortShipDetail: (supplierName, fillPercentLabel, sampleCountLabel) =>
        `Las entregas recientes de ${supplierName} promedian cerca del ${fillPercentLabel} de lo pedido en ${sampleCountLabel} recepciones.`,
      chronicWasteTitle: (itemName) => `${itemName} tiene un patrón crónico de merma`,
      chronicWasteDetail: (lossPercentLabel, sampleCountLabel) =>
        `La merma reciente promedió cerca de ${lossPercentLabel} del stock en ${sampleCountLabel} registros.`,
      chronicCountShrinkTitle: (itemName) => `${itemName} suele bajar entre conteos`,
      chronicCountShrinkDetail: (lossPercentLabel, sampleCountLabel) =>
        `Los conteos recientes promedian cerca de ${lossPercentLabel} por debajo del sistema en ${sampleCountLabel} conteos.`,
      chronicManagerCorrectionTitle: (itemName) => `${itemName} suele corregirse hacia abajo`,
      chronicManagerCorrectionDetail: (lossPercentLabel, sampleCountLabel) =>
        `Las correcciones recientes de gerencia promedian cerca de ${lossPercentLabel} por debajo del sistema en ${sampleCountLabel} ediciones.`,
      actions: {
        updateInventoryCount: "Revisar conteo",
        beginCountSession: "Iniciar conteo",
        continueCountSession: "Continuar conteo",
        reviewCountSession: "Revisar conteo",
        reviewRecommendation: "Revisar recomendación",
        prepareDraft: "Preparar borrador",
        sendOrder: "Revisar pedido",
        receiveOrder: "Recibir entrega",
        finishSetup: "Continuar configuración",
        connectPos: "Conectar POS",
        managePosConnection: "Gestionar conexión",
        repairPosConnection: "Reparar conexión",
        reviewInsight: "Revisar análisis",
        mapUnmappedPosItems: "Vincular recetas",
        repairIncompatibleRecipeUnits: "Corregir unidades",
        reviewShortShips: "Revisar faltantes",
        reviewWaste: "Revisar merma",
        startRecount: "Iniciar reconteo",
        reviewCorrections: "Revisar correcciones"
      }
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
      wasteAction: (itemName) => `Retrasa el próximo pedido de ${itemName} salvo que aumenten las ventas.`,
      shortShipTitle: (itemName) => `${itemName} suele llegar incompleto`,
      shortShipDescription: (supplierName, itemName, fillPercentLabel, sampleCountLabel) =>
        `Las entregas recientes de ${supplierName} para ${itemName} promedian cerca del ${fillPercentLabel} de lo pedido en ${sampleCountLabel} recepciones.`,
      shortShipWhy: "Los faltantes crónicos dejan menos existencias de las pedidas y pueden causar quiebres evitables.",
      shortShipAction: (supplierName) =>
        `Pide un poco más a ${supplierName}, o confirma con cuidado las cantidades al recibir.`,
      chronicWasteTitle: (itemName) => `${itemName} tiene un patrón crónico de merma`,
      chronicWasteDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `Los registros recientes de merma de ${itemName} promedian cerca del ${lossPercentLabel} del stock en ${sampleCountLabel} eventos.`,
      chronicWasteWhy: "La merma repetida reduce el stock usable y puede hacer que los pedidos por par sean demasiado bajos.",
      chronicWasteAction: (itemName) =>
        `Revisa la preparación y el almacenamiento de ${itemName}, y confirma que el próximo pedido cubra la pérdida esperada.`,
      chronicCountShrinkTitle: (itemName) => `${itemName} suele bajar entre conteos`,
      chronicCountShrinkDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `Los conteos recientes de ${itemName} promedian cerca del ${lossPercentLabel} por debajo del sistema en ${sampleCountLabel} conteos.`,
      chronicCountShrinkWhy:
        "Una merma sin explicación indica que el stock en sistema está alto y los pedidos pueden quedar cortos.",
      chronicCountShrinkAction: (itemName) =>
        `Investiga el proceso de conteo y el riesgo de merma o robo de ${itemName}, luego recontea antes de pedir.`,
      chronicManagerCorrectionTitle: (itemName) => `${itemName} suele corregirse hacia abajo`,
      chronicManagerCorrectionDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `Las correcciones recientes de gerencia de ${itemName} promedian cerca de ${lossPercentLabel} por debajo del sistema en ${sampleCountLabel} ediciones.`,
      chronicManagerCorrectionWhy:
        "Las correcciones repetidas hacia abajo indican que el stock en Mise está alto y los pedidos pueden quedar cortos.",
      chronicManagerCorrectionAction: (itemName) =>
        `Revisa recepción, traslados y conteos de ${itemName}; luego ajusta el par o recontea antes de pedir.`
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
      beginCountSessionTitle: "开始库存盘点",
      beginCountSessionDetail: (riskItemCount) =>
        `有 ${riskItemCount} 个库存风险品项需要多项目盘点。请开始会话并提交给经理审批。`,
      continueCountSessionTitle: "继续库存盘点",
      continueCountSessionDetail: "库存盘点会话进行中。请完成盘点并提交审批。",
      approveCountSessionTitle: "批准库存盘点",
      approveCountSessionDetail: "已提交的多项目盘点等待经理批准后才会更新库存。",
      sendOrderTitle: (supplierName) => `发送 ${supplierName} 订单`,
      receiveOrderTitle: (supplierName) => `接收 ${supplierName} 送货`,
      reviewOrderTitle: (supplierName) => `审核 ${supplierName} 订单`,
      orderDeliveryDetail: "此订单已记录供应商交货承诺。",
      orderReceiveDetail: "确认实收数量，以便 Mise 更新现有库存。",
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
      reviewInsightDetail: "请在下一个营业时段前查看依据和建议操作。",
      mapUnmappedRecipesTitle: (unmappedCount, unmappedCountLabel, sampleItemName) =>
        unmappedCount === 1 && sampleItemName
          ? `将 ${sampleItemName} 关联到原料`
          : sampleItemName
            ? `关联 ${unmappedCountLabel} 个未映射的 POS 菜品，先从 ${sampleItemName} 开始`
            : `关联 ${unmappedCountLabel} 个未映射的 POS 菜品`,
      mapUnmappedRecipesDetail: (unmappedCount, unmappedCountLabel, sampleItemName) =>
        unmappedCount === 1 && sampleItemName
          ? `${sampleItemName} 已售出但没有配方基线，因此 Mise 无法根据这些销售扣减库存。`
          : sampleItemName
            ? `有 ${unmappedCountLabel} 个已售 POS 菜品缺少配方基线（包括 ${sampleItemName}），因此 Mise 无法根据这些销售扣减库存。`
            : `有 ${unmappedCountLabel} 个已售 POS 菜品缺少配方基线，因此 Mise 无法根据这些销售扣减库存。`,
      repairIncompatibleRecipesTitle: (incompatibleCount, incompatibleCountLabel, sampleItemName) =>
        incompatibleCount === 1 && sampleItemName
          ? `修复 ${sampleItemName} 的配方单位`
          : sampleItemName
            ? `修复 ${incompatibleCountLabel} 个配方单位，先从 ${sampleItemName} 开始`
            : `修复 ${incompatibleCountLabel} 个配方单位`,
      repairIncompatibleRecipesDetail: (incompatibleCount, incompatibleCountLabel, sampleItemName) =>
        incompatibleCount === 1 && sampleItemName
          ? `${sampleItemName} 的配方单位与库存单位不一致，因此 Mise 无法根据这些销售扣减库存。`
          : sampleItemName
            ? `有 ${incompatibleCountLabel} 个配方单位与库存不一致（包括 ${sampleItemName}），因此 Mise 无法根据这些销售扣减库存。`
            : `有 ${incompatibleCountLabel} 个配方单位与库存不一致，因此 Mise 无法根据这些销售扣减库存。`,
      chronicShortShipTitle: (itemName) => `${itemName} 经常短交`,
      chronicShortShipDetail: (supplierName, fillPercentLabel, sampleCountLabel) =>
        `最近 ${supplierName} 的到货量约为订购量的 ${fillPercentLabel}（基于 ${sampleCountLabel} 次收货）。`,
      chronicWasteTitle: (itemName) => `${itemName} 存在长期损耗模式`,
      chronicWasteDetail: (lossPercentLabel, sampleCountLabel) =>
        `最近损耗约占在手库存的 ${lossPercentLabel}（基于 ${sampleCountLabel} 条记录）。`,
      chronicCountShrinkTitle: (itemName) => `${itemName} 在盘点间经常缩水`,
      chronicCountShrinkDetail: (lossPercentLabel, sampleCountLabel) =>
        `最近盘点平均低于系统约 ${lossPercentLabel}（基于 ${sampleCountLabel} 次盘点）。`,
      chronicManagerCorrectionTitle: (itemName) => `${itemName} 经常被向下修正`,
      chronicManagerCorrectionDetail: (lossPercentLabel, sampleCountLabel) =>
        `最近经理修正平均低于系统约 ${lossPercentLabel}（基于 ${sampleCountLabel} 次编辑）。`,
      actions: {
        updateInventoryCount: "检查盘点",
        beginCountSession: "开始盘点",
        continueCountSession: "继续盘点",
        reviewCountSession: "检查盘点",
        reviewRecommendation: "审核建议",
        prepareDraft: "准备草稿",
        sendOrder: "审核订单",
        receiveOrder: "接收送货",
        finishSetup: "继续设置",
        connectPos: "连接 POS",
        managePosConnection: "管理连接",
        repairPosConnection: "修复连接",
        reviewInsight: "查看洞察",
        mapUnmappedPosItems: "关联配方",
        repairIncompatibleRecipeUnits: "修复配方单位",
        reviewShortShips: "查看短交",
        reviewWaste: "查看损耗",
        startRecount: "开始复盘",
        reviewCorrections: "查看修正"
      }
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
      wasteAction: (itemName) => `除非销量上升，否则请推迟下一次 ${itemName} 订货。`,
      shortShipTitle: (itemName) => `${itemName} 经常短交`,
      shortShipDescription: (supplierName, itemName, fillPercentLabel, sampleCountLabel) =>
        `最近 ${supplierName} 的 ${itemName} 到货量约为订购量的 ${fillPercentLabel}（基于 ${sampleCountLabel} 次收货）。`,
      shortShipWhy: "长期短交会让实际库存低于订购量，并可能导致可避免的缺货。",
      shortShipAction: (supplierName) =>
        `可适当增加向 ${supplierName} 的订货量，或在收货时仔细核对数量。`,
      chronicWasteTitle: (itemName) => `${itemName} 存在长期损耗模式`,
      chronicWasteDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `最近 ${itemName} 的损耗约占在手库存的 ${lossPercentLabel}（基于 ${sampleCountLabel} 次记录）。`,
      chronicWasteWhy: "反复损耗会悄然降低可用库存，并可能让按安全库存下的订单偏少。",
      chronicWasteAction: (itemName) =>
        `请检查 ${itemName} 的备餐与储存，并确认下次订货覆盖预期损耗。`,
      chronicCountShrinkTitle: (itemName) => `${itemName} 在盘点间经常缩水`,
      chronicCountShrinkDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `最近 ${itemName} 的盘点平均低于系统约 ${lossPercentLabel}（基于 ${sampleCountLabel} 次盘点）。`,
      chronicCountShrinkWhy: "无法解释的缩水意味着系统库存偏高，订单可能不足以支撑下一营业时段。",
      chronicCountShrinkAction: (itemName) =>
        `请排查 ${itemName} 的盘点流程与损耗/失窃风险，并在订货前重新盘点。`,
      chronicManagerCorrectionTitle: (itemName) => `${itemName} 经常被向下修正`,
      chronicManagerCorrectionDescription: (itemName, lossPercentLabel, sampleCountLabel) =>
        `最近 ${itemName} 的经理修正平均低于系统约 ${lossPercentLabel}（基于 ${sampleCountLabel} 次编辑）。`,
      chronicManagerCorrectionWhy: "反复向下修正意味着 Mise 的在手库存偏高，订单可能不足以支撑下一营业时段。",
      chronicManagerCorrectionAction: (itemName) =>
        `请检查 ${itemName} 的收货、转移和盘点，然后在订货前调整安全库存或重新盘点。`
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

export function presentOperationalTodayTaskAction(
  locale: AppLocale,
  task: Pick<OperationalTodayTask, "action" | "presentation">
): string {
  const actions = copyByLocale[locale].today.actions;
  const intent: OperationalTodayTaskActionIntent = task.action.intent;
  switch (intent) {
    case "update_inventory_count":
      return actions.updateInventoryCount;
    case "begin_inventory_count_session":
      return task.presentation?.code === "today.inventory.chronic_count_shrink"
        ? actions.startRecount
        : actions.beginCountSession;
    case "continue_inventory_count_session":
      return task.presentation?.code === "today.inventory_count_session.approve"
        ? actions.reviewCountSession
        : actions.continueCountSession;
    case "review_recommendation":
      return actions.reviewRecommendation;
    case "prepare_supplier_draft":
      return actions.prepareDraft;
    case "send_supplier_order":
      return actions.sendOrder;
    case "receive_supplier_order":
      return actions.receiveOrder;
    case "finish_setup":
      return actions.finishSetup;
    case "connect_pos":
      return actions.connectPos;
    case "manage_pos_connection":
      return task.presentation?.code === "today.integration.repair"
        ? actions.repairPosConnection
        : actions.managePosConnection;
    case "repair_pos_connection":
      return actions.repairPosConnection;
    case "review_insight":
      if (task.presentation?.code === "today.ordering.chronic_short_ship") {
        return actions.reviewShortShips;
      }
      if (task.presentation?.code === "today.waste.chronic_waste") {
        return actions.reviewWaste;
      }
      if (task.presentation?.code === "today.inventory.chronic_manager_correction") {
        return actions.reviewCorrections;
      }
      return actions.reviewInsight;
    case "map_unmapped_pos_items":
      return actions.mapUnmappedPosItems;
    case "repair_incompatible_recipe_units":
      return actions.repairIncompatibleRecipeUnits;
    default: {
      const _exhaustive: never = intent;
      throw new Error(`Unsupported Today task action intent: ${String(_exhaustive)}`);
    }
  }
}

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
  if (code === "today.inventory_count_session.begin") {
    return result(
      copy.today.beginCountSessionTitle,
      copy.today.beginCountSessionDetail(quantity(values.riskItemCount))
    );
  }
  if (code === "today.inventory_count_session.continue") {
    return result(copy.today.continueCountSessionTitle, copy.today.continueCountSessionDetail);
  }
  if (code === "today.inventory_count_session.approve") {
    return result(copy.today.approveCountSessionTitle, copy.today.approveCountSessionDetail);
  }
  if (code === "today.order.send" || code === "today.order.receive" || code === "today.order.review") {
    const title =
      code === "today.order.send"
        ? copy.today.sendOrderTitle(values.supplierName)
        : code === "today.order.receive"
          ? copy.today.receiveOrderTitle(values.supplierName)
          : copy.today.reviewOrderTitle(values.supplierName);
    const detail =
      code === "today.order.receive"
        ? values.deliveryDate
          ? copy.today.orderDeliveryDetail
          : copy.today.orderReceiveDetail
        : values.deliveryDate
          ? copy.today.orderDeliveryDetail
          : copy.today.orderDraftDetail;
    return result(title, detail);
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
  if (code === "today.recipe.map_unmapped") {
    return result(
      copy.today.mapUnmappedRecipesTitle(
        values.unmappedCount,
        quantity(values.unmappedCount),
        values.sampleItemName
      ),
      copy.today.mapUnmappedRecipesDetail(
        values.unmappedCount,
        quantity(values.unmappedCount),
        values.sampleItemName
      )
    );
  }
  if (code === "today.recipe.repair_incompatible_units") {
    return result(
      copy.today.repairIncompatibleRecipesTitle(
        values.incompatibleCount,
        quantity(values.incompatibleCount),
        values.sampleItemName
      ),
      copy.today.repairIncompatibleRecipesDetail(
        values.incompatibleCount,
        quantity(values.incompatibleCount),
        values.sampleItemName
      )
    );
  }
  if (code === "today.ordering.chronic_short_ship") {
    return result(
      copy.today.chronicShortShipTitle(values.itemName),
      copy.today.chronicShortShipDetail(
        values.supplierName,
        formatPercent(locale, values.fillPercent),
        quantity(values.sampleCount)
      )
    );
  }
  if (code === "today.waste.chronic_waste") {
    return result(
      copy.today.chronicWasteTitle(values.itemName),
      copy.today.chronicWasteDetail(
        formatPercent(locale, values.lossPercent),
        quantity(values.sampleCount)
      )
    );
  }
  if (code === "today.inventory.chronic_count_shrink") {
    return result(
      copy.today.chronicCountShrinkTitle(values.itemName),
      copy.today.chronicCountShrinkDetail(
        formatPercent(locale, values.lossPercent),
        quantity(values.sampleCount)
      )
    );
  }
  if (code === "today.inventory.chronic_manager_correction") {
    return result(
      copy.today.chronicManagerCorrectionTitle(values.itemName),
      copy.today.chronicManagerCorrectionDetail(
        formatPercent(locale, values.lossPercent),
        quantity(values.sampleCount)
      )
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
  if (code === "insight.rule.ordering.chronic_short_ship") {
    return {
      title: copy.insight.shortShipTitle(values.itemName),
      description: copy.insight.shortShipDescription(
        values.supplierName,
        values.itemName,
        formatPercent(locale, values.fillPercent),
        formatQuantity(locale, values.sampleCount)
      ),
      whyItMatters: copy.insight.shortShipWhy,
      recommendedAction: copy.insight.shortShipAction(values.supplierName),
      evidenceOnly: false
    };
  }
  if (code === "insight.rule.waste.chronic_waste") {
    return {
      title: copy.insight.chronicWasteTitle(values.itemName),
      description: copy.insight.chronicWasteDescription(
        values.itemName,
        formatPercent(locale, values.lossPercent),
        formatQuantity(locale, values.sampleCount)
      ),
      whyItMatters: copy.insight.chronicWasteWhy,
      recommendedAction: copy.insight.chronicWasteAction(values.itemName),
      evidenceOnly: false
    };
  }
  if (code === "insight.rule.inventory.chronic_count_shrink") {
    return {
      title: copy.insight.chronicCountShrinkTitle(values.itemName),
      description: copy.insight.chronicCountShrinkDescription(
        values.itemName,
        formatPercent(locale, values.lossPercent),
        formatQuantity(locale, values.sampleCount)
      ),
      whyItMatters: copy.insight.chronicCountShrinkWhy,
      recommendedAction: copy.insight.chronicCountShrinkAction(values.itemName),
      evidenceOnly: false
    };
  }
  if (code === "insight.rule.inventory.chronic_manager_correction") {
    return {
      title: copy.insight.chronicManagerCorrectionTitle(values.itemName),
      description: copy.insight.chronicManagerCorrectionDescription(
        values.itemName,
        formatPercent(locale, values.lossPercent),
        formatQuantity(locale, values.sampleCount)
      ),
      whyItMatters: copy.insight.chronicManagerCorrectionWhy,
      recommendedAction: copy.insight.chronicManagerCorrectionAction(values.itemName),
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

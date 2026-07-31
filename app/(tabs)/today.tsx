import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Lightbulb,
  LockKeyhole,
  Package,
  PlugZap,
  Settings,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { CompactMetricStrip, type CompactMetric } from "../../components/ui/CompactMetricStrip";
import { EmptyState } from "../../components/ui/EmptyState";
import { InventoryHealth } from "../../components/ui/InventoryHealth";
import { ProduceCrateIllustration } from "../../components/ui/MiseIllustrations";
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, inventoryStatusColors, inventoryStatusSoftColors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { DEMO_DATASET } from "../../services/demoData";
import {
  canRestaurantRoleActOnTodayTask,
  classifyOperationalTodayTaskTiming,
  type OperationalTodayTask,
  type OperationalTodayTaskTiming
} from "../../services/domain/todayTasks";
import {
  fetchTodaySummary,
  type TodayCommandCenterSummary
} from "../../services/miseService";
import { captureMiseError } from "../../services/telemetry";
import {
  presentOperationalTodayTask,
  presentOperationalTodayTaskAction
} from "../../services/presentation/operationsPresentation";
import { buildConciseTrendDateLabels } from "../../services/presentation/salesTrendLabels";
import { canRecordInventoryWaste } from "../../services/tenantAccess";
import type { RestaurantRole } from "../../types/mise";
import type { AppLocale } from "../../i18n/catalog";

const COMPACT_TASK_COUNT = 3;

export default function TodayScreen() {
  const { canUseDemoMode, memberships, restaurant, role, continueWithDemo } = useMiseSession();
  const { locale, t, formatCompactCurrency, formatDate, formatNumber } = useLocale();
  const copy = todayCopy[locale];
  const showStaffWasteTip =
    role === "staff" && canRecordInventoryWaste(memberships, restaurant?.id ?? "");
  const [summary, setSummary] = useState<TodayCommandCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const loadedRestaurantIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  const dateLabel = useMemo(
    () => formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" }),
    [formatDate]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    loadedRestaurantIdRef.current = null;
    setLoadedRestaurantId(null);
    setSummary(null);
    setError(null);
    setShowAllTasks(false);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    if (loadedRestaurantIdRef.current !== restaurantId) setLoading(true);
    setError(null);
    try {
      const nextSummary = await fetchTodaySummary(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSummary(nextSummary);
      loadedRestaurantIdRef.current = restaurantId;
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, {
        flow: "today",
        operation: "load",
        restaurant_id: restaurantId
      });
      setError(copy.loadError);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [copy.loadError, restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function openDemo() {
    await continueWithDemo({
      preset: DEMO_DATASET.id,
      name: DEMO_DATASET.restaurant.name,
      cuisine_type: DEMO_DATASET.restaurant.cuisineType,
      posProvider: DEMO_DATASET.defaultPosProvider
    });
    router.replace("/today");
  }

  const visibleSummary = loadedRestaurantId === restaurant?.id ? summary : null;

  if (!restaurant) {
    return (
      <Screen title={t("nav.today")} subtitle={copy.commandSubtitle}>
        <EmptyState
          title={copy.noRestaurantTitle}
          body={canUseDemoMode ? copy.noRestaurantDemoBody : copy.noRestaurantBody}
          illustration={<ProduceCrateIllustration />}
        />
        <Button
          title={canUseDemoMode ? copy.openDemo : copy.openSetup}
          onPress={canUseDemoMode ? openDemo : () => router.replace("/setup")}
          fullWidth
          style={styles.emptyButton}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t("nav.today")} subtitle={`${restaurant.name} · ${dateLabel}`} loading={loading}>
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={copy.refreshErrorTitle}
            message={error}
            retryLabel={t("common.retry")}
            accessibilityLabel={copy.retryAccessibilityLabel}
            onRetry={() => void load()}
          />
        ) : null}
        {visibleSummary ? (
          <>
            <MotionView delay={20} distance={4} duration={240}>
              <ServicePulse summary={visibleSummary} formatNumber={formatNumber} copy={copy} />
            </MotionView>
            <MotionView delay={55} distance={4} duration={260}>
              <ServiceMetrics
                summary={visibleSummary}
                formatCompactCurrency={formatCompactCurrency}
                formatNumber={formatNumber}
                copy={copy}
              />
            </MotionView>
            <MotionView delay={90} distance={5} duration={280}>
              <SectionSurface
                title={copy.inventoryHealthTitle}
                action={copy.viewInventory}
                actionAccessibilityLabel={copy.viewInventoryAccessibilityLabel}
                onAction={() => router.push("/inventory")}
                separatedHeader={false}
              >
                <InventoryHealth
                  counts={visibleSummary.inventoryHealth}
                  labels={copy.inventoryHealthLabels}
                />
              </SectionSurface>
            </MotionView>
            {showStaffWasteTip ? (
              <MotionView delay={110} distance={4} duration={280}>
                <SectionSurface
                  title={t("today.waste.cardTitle")}
                  subtitle={t("today.waste.cardSubtitle")}
                  action={t("today.waste.openInventoryAction")}
                  actionAccessibilityLabel={t("today.waste.openInventoryAccessibility")}
                  onAction={() => router.push("/inventory")}
                />
              </MotionView>
            ) : null}
            <MotionView delay={125} distance={5} duration={300}>
              <TaskSection
                tasks={visibleSummary.operationalTasks}
                restaurantTimeZone={visibleSummary.restaurantTimeZone}
                role={role ?? "staff"}
                showAll={showAllTasks}
                onToggle={() => setShowAllTasks((current) => !current)}
                copy={copy}
                locale={locale}
              />
            </MotionView>
            <MotionView delay={160} distance={5} duration={320}>
              <SalesMovement summary={visibleSummary} copy={copy} />
            </MotionView>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function ServicePulse({
  summary,
  formatNumber,
  copy
}: {
  summary: TodayCommandCenterSummary;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  copy: TodayCopy;
}) {
  const stockRisk = summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const hasOrderReview = summary.pendingRecommendations > 0;
  const hasRisk = stockRisk > 0 || hasOrderReview;
  const tone: StatusNoticeTone = summary.inventoryHealth.critical > 0
    ? "danger"
    : hasRisk
      ? "warning"
      : "success";
  const message = stockRisk > 0
    ? copy.stockItemsNeedAttention(formatNumber(stockRisk))
    : hasOrderReview
      ? copy.recommendationsAwaitingReview(formatNumber(summary.pendingRecommendations))
      : copy.serviceReadyDetail;
  const actionLabel = stockRisk > 0 ? copy.viewInventory : hasOrderReview ? copy.reviewOrders : copy.viewInventory;

  return (
    <StatusNotice
      title={hasRisk ? copy.serviceNeedsAttention : copy.serviceReady}
      message={message}
      tone={tone}
      actionLabel={actionLabel}
      actionAccessibilityLabel={hasOrderReview && stockRisk === 0
        ? copy.reviewOrdersAccessibilityLabel
        : copy.viewInventoryAccessibilityLabel}
      onAction={() => router.push(stockRisk > 0 ? "/inventory" : hasOrderReview ? "/orders" : "/inventory")}
    />
  );
}

function ServiceMetrics({
  summary,
  formatCompactCurrency,
  formatNumber,
  copy
}: {
  summary: TodayCommandCenterSummary;
  formatCompactCurrency: (value: number, currency?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  copy: TodayCopy;
}) {
  const stockRisk = summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const stockTone = summary.inventoryHealth.critical > 0
    ? "danger"
    : summary.inventoryHealth.low > 0
      ? "warning"
      : "success";
  const stockColor = summary.inventoryHealth.critical > 0
    ? inventoryStatusColors.Critical
    : summary.inventoryHealth.low > 0
      ? inventoryStatusColors.Low
      : inventoryStatusColors.Good;
  const metrics: CompactMetric[] = [
    {
      id: "sales",
      label: copy.salesToday,
      value: formatCompactCurrency(summary.salesToday, summary.restaurantCurrency),
      icon: <ShoppingBag size={16} color={colors.text} strokeWidth={2.1} />
    },
    {
      id: "items",
      label: copy.itemsSold,
      value: formatNumber(summary.itemsSold),
      icon: <BarChart3 size={16} color={colors.text} strokeWidth={2.1} />
    },
    {
      id: "stock",
      label: copy.stockRisk,
      value: formatNumber(stockRisk),
      tone: stockTone,
      icon: (
        <Package
          size={16}
          color={stockColor}
          strokeWidth={2.1}
        />
      )
    },
    {
      id: "orders",
      label: copy.orderReview,
      value: formatNumber(summary.pendingRecommendations),
      tone: summary.pendingRecommendations > 0 ? "caution" : "success",
      icon: (
        <ClipboardList
          size={16}
          color={summary.pendingRecommendations > 0 ? colors.caution : colors.success}
          strokeWidth={2.1}
        />
      )
    }
  ];

  return <CompactMetricStrip metrics={metrics} accessibilityLabel={copy.serviceMetricsAccessibilityLabel} />;
}

function TaskSection({
  tasks,
  restaurantTimeZone,
  role,
  showAll,
  onToggle,
  copy,
  locale
}: {
  tasks: OperationalTodayTask[];
  restaurantTimeZone: string;
  role: RestaurantRole;
  showAll: boolean;
  onToggle: () => void;
  copy: TodayCopy;
  locale: AppLocale;
}) {
  const hasMore = tasks.length > COMPACT_TASK_COUNT;
  const visibleTasks = showAll ? tasks : tasks.slice(0, COMPACT_TASK_COUNT);
  const action = hasMore ? (showAll ? copy.showLess : copy.viewAll) : copy.taskCount(String(tasks.length));

  return (
    <SectionSurface
      title={copy.tasksTitle}
      subtitle={copy.tasksSubtitle}
      action={action}
      onAction={hasMore ? onToggle : undefined}
      actionAccessibilityLabel={showAll ? copy.collapseTasksAccessibilityLabel : copy.expandTasksAccessibilityLabel}
      padding="none"
    >
      {visibleTasks.length === 0 ? (
        <View style={styles.clearRow}>
          <CheckCircle2 size={21} color={colors.success} strokeWidth={2.2} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{copy.clearTitle}</Text>
            <Text style={styles.rowDetail}>{copy.clearDetail}</Text>
          </View>
        </View>
      ) : (
        <MotionView key={showAll ? "expanded" : "compact"} distance={4} duration={180}>
          {visibleTasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              role={role}
              restaurantTimeZone={restaurantTimeZone}
              divided={index > 0}
              copy={copy}
              locale={locale}
            />
          ))}
        </MotionView>
      )}
    </SectionSurface>
  );
}

function TaskRow({
  task,
  role,
  restaurantTimeZone,
  divided,
  copy,
  locale
}: {
  task: OperationalTodayTask;
  role: RestaurantRole;
  restaurantTimeZone: string;
  divided: boolean;
  copy: TodayCopy;
  locale: AppLocale;
}) {
  const { formatDate, formatDueTime, t } = useLocale();
  const canAct = canRestaurantRoleActOnTodayTask(role, task);
  const presentation = presentOperationalTodayTask(locale, task);
  const timing = classifyOperationalTodayTaskTiming(task, { restaurantTimeZone });
  const timingLabel = taskTimingLabel({
    task,
    timing,
    restaurantTimeZone,
    formatDate,
    formatDueTime,
    overdueLabel: t("relative.overdue"),
    todayLabel: t("relative.today"),
    noDeadlineLabel: copy.noDeadline
  });
  const roleLabel = task.requiredRole === "owner_admin" ? copy.ownerAdminOnly : copy.managerOnly;
  const actionLabel = presentOperationalTodayTaskAction(locale, task);
  const accessibleAction = canAct ? actionLabel : roleLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${presentation.title}. ${timingLabel}. ${accessibleAction}`}
      accessibilityState={{ disabled: !canAct }}
      disabled={!canAct}
      onPress={() => router.push(task.action.route)}
      style={({ pressed }) => [
        styles.taskRow,
        divided && styles.dividedRow,
        pressed && canAct && styles.rowPressed
      ]}
    >
      <View style={[styles.rowIcon, taskToneStyle(task)]}>
        {taskIcon(task, taskToneColor(task))}
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={2}>{presentation.title}</Text>
        <Text style={styles.rowDetail} numberOfLines={2}>{presentation.detail}</Text>
      </View>
      <View style={styles.taskMeta}>
        <Text
          numberOfLines={2}
          style={[
            styles.timingLabel,
            timing === "overdue" && styles.timingDanger,
            timing === "due_soon" && styles.timingWarning
          ]}
        >
          {timingLabel}
        </Text>
        {canAct ? (
          <ChevronRight size={19} color={colors.faint} strokeWidth={2.2} />
        ) : (
          <View style={styles.restrictedAction}>
            <LockKeyhole size={13} color={colors.muted} strokeWidth={2.1} />
            <Text style={styles.restrictedLabel} numberOfLines={2}>{roleLabel}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function SalesMovement({ summary, copy }: { summary: TodayCommandCenterSummary; copy: TodayCopy }) {
  const { formatCurrency, formatDate, formatNumber } = useLocale();
  const points = summary.salesTrend;
  const todayKey = summary.operatingDate;
  const maximum = Math.max(1, ...points.map((point) => point.sales));
  const todayPoint = points.find((point) => point.label === todayKey);
  const current = todayPoint?.sales ?? summary.salesToday;
  const previous = points.filter((point) => point.label < todayKey).at(-1)?.sales ?? 0;
  const change = todayPoint && previous > 0 ? ((current - previous) / previous) * 100 : null;
  const hasSales = points.some((point) => point.sales > 0);
  const dateLabels = buildConciseTrendDateLabels(
    points.map((point) => point.label),
    todayKey,
    copy.todayShort,
    formatDate
  );
  const movementColor = change === null || change === 0
    ? colors.muted
    : change > 0
      ? colors.success
      : colors.danger;

  return (
    <SectionSurface
      title={copy.salesMovementTitle}
      action={copy.viewInsights}
      actionAccessibilityLabel={copy.viewInsightsAccessibilityLabel}
      onAction={() => router.push("/insights")}
    >
      <View style={styles.trendSummary}>
        <Text style={styles.trendValue}>
          {formatCurrency(current, {
            currency: summary.restaurantCurrency,
            maximumFractionDigits: 0
          })}
        </Text>
        <View style={styles.movementRow}>
          {change !== null && change > 0 ? <TrendingUp size={15} color={movementColor} strokeWidth={2.2} /> : null}
          {change !== null && change < 0 ? <TrendingDown size={15} color={movementColor} strokeWidth={2.2} /> : null}
          <Text style={[styles.movementLabel, { color: movementColor }]}>
            {change === null
              ? copy.itemsRecorded(formatNumber(summary.itemsSold))
              : copy.vsPreviousDay(`${change > 0 ? "+" : ""}${formatNumber(change, { maximumFractionDigits: 0 })}%`)}
          </Text>
        </View>
      </View>

      {hasSales ? (
        <View
          accessible
          accessibilityLabel={copy.salesChartAccessibilityLabel}
          style={styles.chart}
        >
          {points.map((point, index) => (
            <View key={point.label} style={styles.chartPoint}>
              <View style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    index === points.length - 1 && styles.currentBar,
                    { height: Math.max(4, Math.round((point.sales / maximum) * 68)) }
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, index === points.length - 1 && styles.currentBarLabel]}>
                {dateLabels[index]}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyTrend}>{copy.emptySalesTrend}</Text>
      )}
    </SectionSurface>
  );
}

function taskTimingLabel({
  task,
  timing,
  restaurantTimeZone,
  formatDate,
  formatDueTime,
  overdueLabel,
  todayLabel,
  noDeadlineLabel
}: {
  task: OperationalTodayTask;
  timing: OperationalTodayTaskTiming;
  restaurantTimeZone: string;
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions & { timeZone?: string }) => string;
  formatDueTime: (value: Date | number | string, options?: { timeZone?: string }) => string;
  overdueLabel: string;
  todayLabel: string;
  noDeadlineLabel: string;
}) {
  if (task.dueAt) return formatDueTime(task.dueAt, { timeZone: restaurantTimeZone });
  if (timing === "overdue") return overdueLabel;
  if (timing === "today") return todayLabel;
  if (task.dueDate) {
    return formatDate(`${task.dueDate}T12:00:00.000Z`, {
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  }
  return noDeadlineLabel;
}

function taskToneStyle(task: OperationalTodayTask) {
  if (task.source.kind === "inventory" && task.source.status === "Watch") return styles.watchIcon;
  if (task.priority === "urgent") return styles.urgentIcon;
  if (task.priority === "high") return styles.highIcon;
  return styles.normalIcon;
}

function taskToneColor(task: OperationalTodayTask) {
  if (task.source.kind === "inventory") {
    if (task.source.status === "Critical") return inventoryStatusColors.Critical;
    if (task.source.status === "Low") return inventoryStatusColors.Low;
    if (task.source.status === "Watch") return inventoryStatusColors.Watch;
  }
  if (task.priority === "urgent") return colors.danger;
  if (task.priority === "high") return colors.warning;
  return colors.text;
}

function taskIcon(task: OperationalTodayTask, color: string): ReactNode {
  const props = { size: 19, color, strokeWidth: 2.15 } as const;
  if (task.source.kind === "inventory") return <Package {...props} />;
  if (task.source.kind === "recommendation" || task.source.kind === "order") return <ShoppingCart {...props} />;
  if (task.source.kind === "integration") return <PlugZap {...props} />;
  if (task.source.kind === "setup") return <Settings {...props} />;
  return <Lightbulb {...props} />;
}

interface TodayCopy {
  commandSubtitle: string;
  noRestaurantTitle: string;
  noRestaurantDemoBody: string;
  noRestaurantBody: string;
  openDemo: string;
  openSetup: string;
  loadError: string;
  refreshErrorTitle: string;
  retryAccessibilityLabel: string;
  salesToday: string;
  itemsSold: string;
  stockRisk: string;
  orderReview: string;
  serviceMetricsAccessibilityLabel: string;
  serviceNeedsAttention: string;
  serviceReady: string;
  serviceReadyDetail: string;
  stockItemsNeedAttention: (count: string) => string;
  recommendationsAwaitingReview: (count: string) => string;
  reviewOrders: string;
  reviewOrdersAccessibilityLabel: string;
  inventoryHealthTitle: string;
  viewInventory: string;
  viewInventoryAccessibilityLabel: string;
  inventoryHealthLabels: {
    good: string;
    watch: string;
    low: string;
    critical: string;
    wellStocked: string;
    empty: string;
  };
  tasksTitle: string;
  tasksSubtitle: string;
  taskCount: (count: string) => string;
  viewAll: string;
  showLess: string;
  expandTasksAccessibilityLabel: string;
  collapseTasksAccessibilityLabel: string;
  clearTitle: string;
  clearDetail: string;
  noDeadline: string;
  ownerAdminOnly: string;
  managerOnly: string;
  salesMovementTitle: string;
  viewInsights: string;
  viewInsightsAccessibilityLabel: string;
  itemsRecorded: (count: string) => string;
  vsPreviousDay: (change: string) => string;
  salesChartAccessibilityLabel: string;
  todayShort: string;
  emptySalesTrend: string;
}

const todayCopy: Readonly<Record<AppLocale, TodayCopy>> = {
  en: {
    commandSubtitle: "Your restaurant command board starts here.",
    noRestaurantTitle: "No restaurant selected",
    noRestaurantDemoBody: "Open the demo data to explore a complete shift with sample sales and inventory.",
    noRestaurantBody: "Create or select a restaurant workspace to view today’s operations.",
    openDemo: "Open demo kitchen",
    openSetup: "Open setup",
    loadError: "Could not load today.",
    refreshErrorTitle: "Today could not refresh",
    retryAccessibilityLabel: "Retry loading today",
    salesToday: "Sales today",
    itemsSold: "Items sold",
    stockRisk: "Stock risk",
    orderReview: "Order review",
    serviceMetricsAccessibilityLabel: "Today’s service metrics",
    serviceNeedsAttention: "Service needs attention",
    serviceReady: "Service is on track",
    serviceReadyDetail: "No immediate stock or supplier work is waiting right now.",
    stockItemsNeedAttention: (count) => `${count} stock-risk items need an operator review.`,
    recommendationsAwaitingReview: (count) => `${count} supplier recommendations are waiting for review.`,
    reviewOrders: "Review orders",
    reviewOrdersAccessibilityLabel: "Open supplier order review",
    inventoryHealthTitle: "Inventory Health",
    viewInventory: "View inventory",
    viewInventoryAccessibilityLabel: "Open inventory",
    inventoryHealthLabels: {
      good: "Good",
      watch: "Watch",
      low: "Low",
      critical: "Critical",
      wellStocked: "Well stocked",
      empty: "No items"
    },
    tasksTitle: "Today’s Tasks",
    tasksSubtitle: "Generated from current restaurant operations",
    taskCount: (count) => `${count} open`,
    viewAll: "View all",
    showLess: "Show less",
    expandTasksAccessibilityLabel: "Show all of today’s tasks",
    collapseTasksAccessibilityLabel: "Show fewer of today’s tasks",
    clearTitle: "No operational work is waiting",
    clearDetail: "Mise will surface inventory, supplier, setup, and integration work here.",
    noDeadline: "No set time",
    ownerAdminOnly: "Owner or admin",
    managerOnly: "Manager only",
    salesMovementTitle: "Sales Movement",
    viewInsights: "View insights",
    viewInsightsAccessibilityLabel: "Open sales insights",
    itemsRecorded: (count) => `${count} items sold today`,
    vsPreviousDay: (change) => `${change} vs previous recorded service day`,
    salesChartAccessibilityLabel: "Observed gross sales across the latest recorded service days",
    todayShort: "Today",
    emptySalesTrend: "No recorded sales are available yet."
  },
  es: {
    commandSubtitle: "Tu panel de operaciones del restaurante comienza aquí.",
    noRestaurantTitle: "Ningún restaurante seleccionado",
    noRestaurantDemoBody: "Abre los datos de demostración para explorar un turno con ventas e inventario de ejemplo.",
    noRestaurantBody: "Crea o selecciona un restaurante para ver las operaciones de hoy.",
    openDemo: "Abrir cocina de demostración",
    openSetup: "Abrir configuración",
    loadError: "No se pudo cargar el día de hoy.",
    refreshErrorTitle: "No se pudo actualizar el día de hoy",
    retryAccessibilityLabel: "Reintentar la carga de hoy",
    salesToday: "Ventas de hoy",
    itemsSold: "Artículos vendidos",
    stockRisk: "Riesgo de inventario",
    orderReview: "Pedidos por revisar",
    serviceMetricsAccessibilityLabel: "Métricas del servicio de hoy",
    serviceNeedsAttention: "El servicio necesita atención",
    serviceReady: "El servicio está en orden",
    serviceReadyDetail: "No hay trabajo inmediato de inventario o proveedores pendiente.",
    stockItemsNeedAttention: (count) => `${count} artículos con riesgo de inventario necesitan revisión.`,
    recommendationsAwaitingReview: (count) => `${count} recomendaciones de proveedores esperan revisión.`,
    reviewOrders: "Revisar pedidos",
    reviewOrdersAccessibilityLabel: "Abrir revisión de pedidos de proveedores",
    inventoryHealthTitle: "Estado del inventario",
    viewInventory: "Ver inventario",
    viewInventoryAccessibilityLabel: "Abrir inventario",
    inventoryHealthLabels: {
      good: "Bien",
      watch: "Vigilar",
      low: "Bajo",
      critical: "Crítico",
      wellStocked: "Bien abastecido",
      empty: "Sin artículos"
    },
    tasksTitle: "Tareas de hoy",
    tasksSubtitle: "Generadas a partir de las operaciones actuales",
    taskCount: (count) => `${count} pendientes`,
    viewAll: "Ver todo",
    showLess: "Ver menos",
    expandTasksAccessibilityLabel: "Mostrar todas las tareas de hoy",
    collapseTasksAccessibilityLabel: "Mostrar menos tareas de hoy",
    clearTitle: "No hay trabajo operativo pendiente",
    clearDetail: "Mise mostrará aquí el trabajo de inventario, proveedores, configuración e integraciones.",
    noDeadline: "Sin hora fijada",
    ownerAdminOnly: "Propietario o admin",
    managerOnly: "Solo gerente",
    salesMovementTitle: "Movimiento de ventas",
    viewInsights: "Ver análisis",
    viewInsightsAccessibilityLabel: "Abrir análisis de ventas",
    itemsRecorded: (count) => `${count} artículos vendidos hoy`,
    vsPreviousDay: (change) => `${change} frente al día de servicio registrado anterior`,
    salesChartAccessibilityLabel: "Ventas brutas observadas en los días de servicio registrados más recientes",
    todayShort: "Hoy",
    emptySalesTrend: "Todavía no hay ventas registradas disponibles."
  },
  "zh-Hans": {
    commandSubtitle: "从这里开始查看餐厅运营面板。",
    noRestaurantTitle: "未选择餐厅",
    noRestaurantDemoBody: "打开演示数据，查看包含示例销售和库存的完整班次。",
    noRestaurantBody: "创建或选择餐厅工作区以查看今日运营。",
    openDemo: "打开演示厨房",
    openSetup: "打开设置",
    loadError: "无法加载今日数据。",
    refreshErrorTitle: "无法刷新今日数据",
    retryAccessibilityLabel: "重试加载今日数据",
    salesToday: "今日销售额",
    itemsSold: "已售商品",
    stockRisk: "库存风险",
    orderReview: "待审核订单",
    serviceMetricsAccessibilityLabel: "今日服务指标",
    serviceNeedsAttention: "服务需要关注",
    serviceReady: "服务运行正常",
    serviceReadyDetail: "目前没有需要立即处理的库存或供应商工作。",
    stockItemsNeedAttention: (count) => `${count} 项库存风险需要操作员检查。`,
    recommendationsAwaitingReview: (count) => `${count} 项供应商建议等待审核。`,
    reviewOrders: "审核订单",
    reviewOrdersAccessibilityLabel: "打开供应商订单审核",
    inventoryHealthTitle: "库存健康度",
    viewInventory: "查看库存",
    viewInventoryAccessibilityLabel: "打开库存",
    inventoryHealthLabels: {
      good: "良好",
      watch: "关注",
      low: "偏低",
      critical: "紧急",
      wellStocked: "库存充足",
      empty: "暂无商品"
    },
    tasksTitle: "今日任务",
    tasksSubtitle: "根据当前餐厅运营生成",
    taskCount: (count) => `${count} 项待处理`,
    viewAll: "查看全部",
    showLess: "收起",
    expandTasksAccessibilityLabel: "显示所有今日任务",
    collapseTasksAccessibilityLabel: "显示较少今日任务",
    clearTitle: "暂无待处理运营工作",
    clearDetail: "Mise 会在此显示库存、供应商、设置和集成工作。",
    noDeadline: "未设时间",
    ownerAdminOnly: "仅所有者或管理员",
    managerOnly: "仅经理",
    salesMovementTitle: "销售趋势",
    viewInsights: "查看洞察",
    viewInsightsAccessibilityLabel: "打开销售洞察",
    itemsRecorded: (count) => `今日售出 ${count} 件商品`,
    vsPreviousDay: (change) => `较上一个有记录营业日 ${change}`,
    salesChartAccessibilityLabel: "最近有记录营业日的实际销售总额",
    todayShort: "今天",
    emptySalesTrend: "目前还没有可用的销售记录。"
  }
};

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  emptyButton: {
    marginTop: 12
  },
  clearRow: {
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  taskRow: {
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  dividedRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  rowPressed: {
    backgroundColor: colors.surfaceWarm
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  urgentIcon: {
    backgroundColor: colors.dangerSoft
  },
  highIcon: {
    backgroundColor: colors.warningSoft
  },
  watchIcon: {
    backgroundColor: inventoryStatusSoftColors.Watch
  },
  normalIcon: {
    backgroundColor: colors.panel
  },
  rowCopy: {
    flex: 1,
    minWidth: 0
  },
  rowTitle: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 14,
    lineHeight: 19
  },
  rowDetail: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
  taskMeta: {
    width: 82,
    minHeight: 50,
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 5
  },
  timingLabel: {
    color: colors.muted,
    ...typography.caption,
    textAlign: "right"
  },
  timingWarning: {
    color: colors.warning
  },
  timingDanger: {
    color: colors.danger
  },
  restrictedAction: {
    maxWidth: 82,
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4
  },
  restrictedLabel: {
    flexShrink: 1,
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 9,
    lineHeight: 12,
    textAlign: "right"
  },
  trendSummary: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 13
  },
  trendValue: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 24,
    lineHeight: 29
  },
  movementRow: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4
  },
  movementLabel: {
    flexShrink: 1,
    ...typography.caption,
    textAlign: "right"
  },
  chart: {
    height: 94,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 7
  },
  chartPoint: {
    flex: 1,
    minWidth: 0,
    alignItems: "center"
  },
  barColumn: {
    height: 72,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  bar: {
    width: "54%",
    minWidth: 8,
    maxWidth: 22,
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    backgroundColor: colors.panelStrong
  },
  currentBar: {
    backgroundColor: colors.accent
  },
  barLabel: {
    color: colors.muted,
    ...typography.caption,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 5
  },
  currentBarLabel: {
    color: colors.text
  },
  emptyTrend: {
    color: colors.muted,
    ...typography.body,
    paddingVertical: 12
  }
});

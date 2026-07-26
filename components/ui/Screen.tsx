import { type ReactNode } from "react";
import { router, usePathname } from "expo-router";
import { Bell, ChevronDown, Menu } from "lucide-react-native";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { BrandLockup } from "./BrandLockup";
import { MotionView } from "./Motion";

interface ScreenProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  scroll?: boolean;
  keyboardAware?: boolean;
}

export function Screen({ title, subtitle, action, children, loading, scroll = true, keyboardAware = false }: ScreenProps) {
  const { restaurant } = useMiseSession();
  const { t } = useLocale();
  const pathname = usePathname();
  const isInsightsRoute = pathname === "/insights";
  const isSettingsRoute = pathname === "/settings";
  const content = (
    <MotionView style={styles.content} distance={6}>
      {title || subtitle || action ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {loading ? (
        <View
          style={styles.loading}
          accessibilityLabel={t("common.loading")}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
        >
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : children}
    </MotionView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={[styles.appBar, restaurant && styles.workspaceAppBar]}>
        <View style={styles.topBar}>
          {restaurant && !isSettingsRoute ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("screen.openSettings")}
              hitSlop={8}
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [styles.headerAction, pressed && styles.headerActionPressed]}
            >
              <Menu size={21} color={colors.text} strokeWidth={1.9} />
            </Pressable>
          ) : (
            <View style={styles.headerAction} />
          )}
          <BrandLockup size="small" showTagline={false} />
          {restaurant && !isInsightsRoute ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("screen.openInsights")}
              accessibilityHint={t("screen.openInsightsHint")}
              hitSlop={8}
              onPress={() => router.push("/insights")}
              style={({ pressed }) => [styles.headerAction, pressed && styles.headerActionPressed]}
            >
              <Bell size={20} color={colors.text} strokeWidth={1.9} />
            </Pressable>
          ) : (
            <View style={styles.headerAction} />
          )}
        </View>
        {restaurant ? (
          isSettingsRoute ? (
            <View
              accessible
              style={styles.restaurantBar}
              accessibilityLabel={t("screen.currentRestaurant", { restaurant: restaurant.name })}
            >
              <Text style={styles.restaurantName} numberOfLines={1}>{restaurant.name}</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("screen.openRestaurantSettings", { restaurant: restaurant.name })}
              accessibilityHint={t("screen.openRestaurantSettingsHint")}
              hitSlop={{ top: 8, bottom: 9, left: 0, right: 0 }}
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [styles.restaurantBar, pressed && styles.restaurantBarPressed]}
            >
              <Text style={styles.restaurantName} numberOfLines={1}>{restaurant.name}</Text>
              <ChevronDown size={14} color={colors.text} strokeWidth={2} />
            </Pressable>
          )
        ) : null}
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={keyboardAware}
        style={styles.body}
      >
        {scroll ? (
          <ScrollView
            automaticallyAdjustKeyboardInsets={keyboardAware && Platform.OS === "ios"}
            contentContainerStyle={[styles.scrollContent, keyboardAware && styles.keyboardAwareScrollContent]}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface
  },
  appBar: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  workspaceAppBar: {
    height: 98
  },
  topBar: {
    height: 54,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  headerActionPressed: {
    opacity: 0.5
  },
  restaurantBar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 56
  },
  restaurantName: {
    maxWidth: 260,
    color: colors.text,
    ...typography.caption,
    fontSize: 12
  },
  restaurantBarPressed: {
    backgroundColor: colors.surfaceWarm
  },
  body: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingBottom: 96
  },
  keyboardAwareScrollContent: {
    paddingBottom: 160
  },
  content: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: 18
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.text,
    ...typography.screenTitle
  },
  subtitle: {
    color: colors.muted,
    ...typography.body,
    marginTop: spacing.xs,
    maxWidth: 480
  },
  loading: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center"
  }
});

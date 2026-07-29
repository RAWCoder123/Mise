import { type ReactNode } from "react";
import { router, usePathname } from "expo-router";
import { Bell } from "lucide-react-native";
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

export type ScreenChrome = "brand" | "title";

interface ScreenProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  scroll?: boolean;
  keyboardAware?: boolean;
  /** Home uses brand lockup; other tabs use the screen title in the top bar. */
  chrome?: ScreenChrome;
  /** Title bar alignment when `chrome="title"`. Defaults to centered for main tabs. */
  titleAlign?: "left" | "center";
}

function resolveChrome(pathname: string, chrome?: ScreenChrome): ScreenChrome {
  if (chrome) return chrome;
  if (pathname === "/home" || pathname === "/") return "brand";
  return "title";
}

export function Screen({
  title,
  subtitle,
  action,
  children,
  loading,
  scroll = true,
  keyboardAware = false,
  chrome,
  titleAlign
}: ScreenProps) {
  const { restaurant } = useMiseSession();
  const { t } = useLocale();
  const pathname = usePathname();
  const resolvedChrome = resolveChrome(pathname, chrome);
  const isBrand = resolvedChrome === "brand";
  const isInsightsRoute = pathname === "/insights";
  const align = titleAlign ?? (pathname === "/more" || pathname.startsWith("/settings") ? "left" : "center");
  const showBodyTitle = Boolean(title) && isBrand;
  const showBodySubtitle = Boolean(subtitle);

  const content = (
    <MotionView style={styles.content} distance={4}>
      {showBodyTitle || showBodySubtitle || (action && isBrand) ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {showBodyTitle ? <Text style={styles.title}>{title}</Text> : null}
            {showBodySubtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {isBrand ? action : null}
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
      <View style={styles.appBar}>
        {isBrand ? (
          <View style={styles.topBar}>
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
        ) : (
          <View style={styles.topBar}>
            {align === "center" ? (
              <View style={[styles.barSide, styles.barSideStart]}>
                <View style={styles.headerAction} />
              </View>
            ) : null}
            <View style={[styles.titleSlot, align === "left" && styles.titleSlotLeft]}>
              {title ? (
                <Text
                  accessibilityRole="header"
                  numberOfLines={1}
                  style={[styles.appBarTitle, align === "center" && styles.appBarTitleCentered]}
                >
                  {title}
                </Text>
              ) : null}
            </View>
            <View style={[styles.barSide, styles.barSideEnd]}>
              {action ?? (align === "center" ? <View style={styles.headerAction} /> : null)}
            </View>
          </View>
        )}
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
    backgroundColor: colors.background
  },
  appBar: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  topBar: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  barSide: {
    minWidth: 44,
    minHeight: 44,
    flexShrink: 0,
    justifyContent: "center"
  },
  barSideStart: {
    alignItems: "flex-start"
  },
  barSideEnd: {
    alignItems: "flex-end"
  },
  titleSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  titleSlotLeft: {
    alignItems: "flex-start",
    paddingHorizontal: 0
  },
  appBarTitle: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2
  },
  appBarTitleCentered: {
    textAlign: "center"
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
  body: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingBottom: 88
  },
  keyboardAwareScrollContent: {
    paddingBottom: 160
  },
  content: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: 12
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
    marginTop: 2,
    maxWidth: 480
  },
  loading: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center"
  }
});

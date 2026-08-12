import { Tabs } from "expo-router";
import { CalendarDays, Home, MoreHorizontal, Package, ShoppingCart } from "lucide-react-native";
import { StyleSheet } from "react-native";

import { colors, density, fontFamilies, iconStroke } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";

export default function TabsLayout() {
  const { t } = useLocale();

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("nav.home"),
          tabBarAccessibilityLabel: t("nav.home"),
          tabBarIcon: ({ color }) => <Home size={density.tabIcon} color={color} strokeWidth={iconStroke} />
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: t("nav.today"),
          tabBarAccessibilityLabel: t("nav.today"),
          tabBarIcon: ({ color }) => <CalendarDays size={density.tabIcon} color={color} strokeWidth={iconStroke} />
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t("nav.inventory"),
          tabBarAccessibilityLabel: t("nav.inventory"),
          tabBarIcon: ({ color }) => <Package size={density.tabIcon} color={color} strokeWidth={iconStroke} />
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("nav.orders"),
          tabBarAccessibilityLabel: t("nav.orders"),
          tabBarIcon: ({ color }) => <ShoppingCart size={density.tabIcon} color={color} strokeWidth={iconStroke} />
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("nav.more"),
          tabBarAccessibilityLabel: t("nav.more"),
          tabBarIcon: ({ color }) => <MoreHorizontal size={density.tabIcon} color={color} strokeWidth={iconStroke} />
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    // Measured off the concept: the bar is ~60pt tall at 390x844, which is what
    // fits an 18pt icon over a 9pt label without clipping the label. Dropping
    // to 56 cut the labels off. design:static locks this — keep density.tabBar
    // in sync.
    height: 60,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  tabBarItem: {
    // No minHeight here. React Navigation lays the item out inside the bar's
    // content box; forcing 44 against a 60pt bar with padding pushed the label
    // past the bar's bottom edge and clipped it on every tab. The 44pt target
    // comes from the bar height itself, which is already above it.
    paddingVertical: 0
  },
  tabBarLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: density.tabLabel,
    lineHeight: 14,
    marginTop: 3,
    marginBottom: 0,
    includeFontPadding: false,
    // React Navigation's web tab item is a flex column, and the label was the
    // flexible child: it collapsed to a 6px box with overflow:hidden and cut
    // every glyph in half, on all five tabs. Measured, not guessed — lineHeight
    // alone does not survive a flex squeeze, so pin the box and refuse to shrink.
    height: 14,
    flexShrink: 0,
    flexGrow: 0
  }
});

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
    // design:static locks this to 62 — keep in sync with density.tabBar
    height: 62,
    paddingTop: 5,
    paddingBottom: 3,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  tabBarItem: {
    minHeight: density.hitTarget
  },
  tabBarLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: density.tabLabel,
    lineHeight: 11,
    marginTop: 1
  }
});

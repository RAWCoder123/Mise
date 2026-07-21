import { Tabs } from "expo-router";
import { ChartNoAxesColumnIncreasing, Home, Package, Settings, ShoppingCart } from "lucide-react-native";
import { Platform, StyleSheet } from "react-native";

import { colors, fontFamilies } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";

export default function TabsLayout() {
  const { t } = useLocale();

  return (
    <Tabs
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t("nav.today"),
          tabBarAccessibilityLabel: t("nav.today"),
          tabBarIcon: ({ color }) => <Home size={20} color={color} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t("nav.inventory"),
          tabBarAccessibilityLabel: t("nav.inventory"),
          tabBarIcon: ({ color }) => <Package size={20} color={color} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("nav.orders"),
          tabBarAccessibilityLabel: t("nav.orders"),
          tabBarIcon: ({ color }) => <ShoppingCart size={20} color={color} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t("nav.insights"),
          tabBarAccessibilityLabel: t("nav.insights"),
          tabBarIcon: ({ color }) => <ChartNoAxesColumnIncreasing size={20} color={color} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav.settings"),
          tabBarAccessibilityLabel: t("nav.settings"),
          tabBarIcon: ({ color }) => <Settings size={20} color={color} strokeWidth={1.9} />
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 62,
    paddingTop: 7,
    paddingBottom: 4,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    ...Platform.select({
      android: { elevation: 0 },
      web: { boxShadow: "none" },
      default: { shadowOpacity: 0 }
    })
  },
  tabBarItem: {
    minHeight: 50
  },
  tabBarLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1
  }
});

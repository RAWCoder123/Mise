import { Tabs } from "expo-router";
import { CalendarDays, Home, MoreHorizontal, Package, ShoppingCart } from "lucide-react-native";
import { Platform, StyleSheet } from "react-native";

import { colors, fontFamilies } from "../../constants/theme";
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
          tabBarIcon: ({ color }) => <Home size={20} color={color} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: t("nav.today"),
          tabBarAccessibilityLabel: t("nav.today"),
          tabBarIcon: ({ color }) => <CalendarDays size={20} color={color} strokeWidth={1.9} />
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
        name="more"
        options={{
          title: t("nav.more"),
          tabBarAccessibilityLabel: t("nav.more"),
          tabBarIcon: ({ color }) => <MoreHorizontal size={20} color={color} strokeWidth={1.9} />
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
    height: 62,
    paddingTop: 7,
    paddingBottom: 4,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    ...Platform.select({
      android: { elevation: 8 },
      web: { boxShadow: "0 -2px 10px rgba(23, 23, 21, 0.06)" },
      default: {
        shadowColor: "#171715",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8
      }
    })
  },
  tabBarItem: {
    minHeight: 50
  },
  tabBarLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1
  }
});

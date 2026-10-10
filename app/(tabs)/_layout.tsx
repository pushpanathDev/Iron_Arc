import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, Tabs } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";

// Forces Expo Router to always reset to "index" on reload/state restore.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function TabLayout() {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  // Consume hardware back presses at the tab root so the unhandled-action
  // warning doesn't fire in dev when there is nothing to go back to.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, []),
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <Tabs
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          animation: "shift",
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.cardBorder,
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: Math.max(8, insets.bottom),
            minHeight: 60 + Math.max(0, insets.bottom),
            ...shadows.sm,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "500",
          },
          tabBarHideOnKeyboard: true,
        }}
      >
        {/* Hidden tab — declared first so it doesn't shift visible indices */}
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="index"
          options={{
            href: "/(tabs)",
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="body-weight"
          options={{
            href: "/(tabs)/body-weight",
            title: "Weight",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="scale-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="analytics"
          options={{
            href: "/(tabs)/analytics",
            title: "Analytics",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            href: "/(tabs)/history",
            title: "History",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

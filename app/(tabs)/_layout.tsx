import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, Tabs } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppTabBar } from "../../components/ui/AppTabBar";
import { useTheme } from "../../theme/theme";

// Forces Expo Router to always reset to "index" on reload/state restore.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function TabLayout() {
  const { colors } = useTheme();
  const router = useRouter();

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
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <Tabs
        initialRouteName="index"
        tabBar={(props) => (
          <AppTabBar {...props} onLogPress={() => router.push("/add-workout")} />
        )}
        screenOptions={{
          headerShown: false,
          animation: "shift",
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

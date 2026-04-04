import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";

export default function TabLayout() {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <Tabs
        screenOptions={{
          headerShown: false,
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
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="body-weight"
          options={{
            title: "Weight",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="scale-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="analytics"
          options={{
            title: "Analytics",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Profile is now accessed via icon on Home page header */}
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // Hide from tab bar
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { useRouter, Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfflineBanner } from "../../components/ui/OfflineBanner";
import { AppTabBar } from "../../components/ui/AppTabBar";
import { useTheme } from "../../theme/theme";
import { perfStart } from "../../utils/perf";

// Forces Expo Router to always reset to "index" on reload/state restore.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function TabLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // The status-bar inset is applied here, outside every tab's ScrollView (as on
  // Sign In), so scrolled content stops at the status bar instead of under it.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <OfflineBanner />
      <Tabs
        initialRouteName="index"
        // Back returns to the tab you came from (e.g. Analytics → History → back = Analytics); back on the first one exits.
        backBehavior="history"
        tabBar={(props) => (
          <AppTabBar {...props} onLogPress={() => {
            perfStart("open picker");
            router.push("/workout/pick");
          }} />
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
    </View>
  );
}

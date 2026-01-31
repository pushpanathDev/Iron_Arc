import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../auth/AuthContext";
import { AnimatedSplashScreen } from "../components/AnimatedSplashScreen";
import { SyncProvider } from "../context/SyncContext";
import { getUserProfile } from "../db/profiles";
import { initDB } from "../db/schema";
import { initSyncMeta } from "../db/syncMeta";
import { useAppReady } from "../hooks/useAppReady";
import { useDailySync } from "../hooks/useDailySync";
import { logDBStartup } from "../utils/diagnostics";

// Prevent native splash from hiding until we're ready
SplashScreen.preventAutoHideAsync();

/**
 * Root Navigator
 * ==============
 * Handles auth-based navigation and coordinates with splash screen.
 *
 * Key behaviors:
 * - Shows animated splash until app is fully ready
 * - Redirects based on auth state after splash completes
 * - Prevents navigation until splash animation finishes
 */
function RootNavigator({ dbReady }: { dbReady: boolean }) {
  const {
    user,
    loading: authLoading,
    isSyncing: isAuthSyncing,
    syncError,
  } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Track splash visibility (starts true, set false after animation completes)
  const [splashVisible, setSplashVisible] = useState(true);

  // Calculate app readiness from multiple conditions
  const { isReady } = useAppReady({
    authLoading,
    dbInitialized: dbReady,
  });

  // 🌅 Run daily sync on app focus (MUST be called before conditional return)
  useDailySync(user?.uid);

  // 📊 Log DB state on user change
  useEffect(() => {
    if (user?.uid) {
      logDBStartup(user.uid).catch(console.error);
    }
  }, [user?.uid]);

  /**
   * Handle splash animation completion.
   * Only called when animation fully finishes (opacity → 0).
   */
  const handleSplashComplete = useCallback(() => {
    setSplashVisible(false);
  }, []);

  /**
   * Auth-based navigation.
   * Only runs after splash is dismissed to prevent visual jank.
   * Includes onboarding check for new users.
   */
  useEffect(() => {
    // Don't navigate while splash is visible or auth is loading
    if (splashVisible || authLoading) return;

    const currentSegment = segments[0] as string;
    const isProtectedRoute =
      currentSegment === "(tabs)" ||
      currentSegment === "add-workout" ||
      currentSegment === "modal";
    const isLoginRoute = currentSegment === "login";
    const isOnboardingRoute = currentSegment === "onboarding";

    const handleNavigation = async () => {
      if (!user && isProtectedRoute) {
        // User logged out while on protected route
        router.replace("/login");
      } else if (user && isLoginRoute) {
        // User logged in - check if needs onboarding
        try {
          const profile = await getUserProfile(user.uid);
          if (!profile?.height) {
            // New user or missing height - go to onboarding
            router.replace("/onboarding" as any);
          } else {
            // Returning user with complete profile
            router.replace("/(tabs)");
          }
        } catch (error) {
          console.error("Failed to check profile:", error);
          router.replace("/(tabs)");
        }
      } else if (
        user &&
        !isProtectedRoute &&
        !isOnboardingRoute &&
        !isLoginRoute
      ) {
        // User on unknown route - go to tabs
        router.replace("/(tabs)");
      }
    };

    handleNavigation();
  }, [user, authLoading, segments, splashVisible, router]);

  // Render animated splash overlay when visible
  // The splash handles its own exit animation based on isReady
  if (splashVisible) {
    return (
      <AnimatedSplashScreen
        isAppReady={isReady}
        onAnimationComplete={handleSplashComplete}
      />
    );
  }

  // Don't render navigation until auth state is known
  if (authLoading) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-workout" options={{ presentation: "modal" }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>

      {/* Auth sync overlay - shown during login/logout sync */}
      {isAuthSyncing && (
        <View style={styles.syncOverlay}>
          <View style={styles.syncCard}>
            <ActivityIndicator size="large" color="#22C55E" />
            <Text style={styles.syncTitle}>Syncing your data...</Text>
            <Text style={styles.syncSubtitle}>
              Please wait while we sync your workouts
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

/**
 * Root Layout
 * ===========
 * Entry point for the app. Handles:
 * - Database initialization
 * - Theme provider setup
 * - Auth provider wrapping
 * - Native splash screen coordination
 *
 * Performance considerations:
 * - DB init runs once on mount
 * - Native splash hides only after DB is ready
 * - Animated splash takes over for smooth transition
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize database and hide native splash
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        console.log("[RootLayout] Starting DB initialization...");

        // Initialize SQLite database
        await initDB();
        console.log("[RootLayout] initDB complete");

        await initSyncMeta();
        console.log("[RootLayout] initSyncMeta complete");

        if (mounted) {
          setDbReady(true);
          console.log("[RootLayout] DB ready, hiding native splash...");
        }

        // Hide native splash (animated splash will be visible)
        try {
          await SplashScreen.hideAsync();
          console.log("[RootLayout] Native splash hidden");
        } catch (e) {
          console.log("[RootLayout] Splash already hidden or error:", e);
        }
      } catch (error: any) {
        console.error("[RootLayout] Failed to initialize app:", error);
        setInitError(error?.message || "Unknown error");

        // Still set ready to show error state
        if (mounted) {
          setDbReady(true);
          try {
            await SplashScreen.hideAsync();
          } catch (e) {
            // Ignore
          }
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  // Show error if initialization failed
  if (initError) {
    return (
      <GestureHandlerRootView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <StatusBar style="light" />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <AuthProvider>
            <SyncProvider>
              <RootNavigator dbReady={dbReady} />
            </SyncProvider>
          </AuthProvider>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  syncOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  syncCard: {
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 250,
  },
  syncTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  syncSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});

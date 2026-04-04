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
import { BatteryOptimizationPrompt } from "../components/BatteryOptimizationPrompt";
import { SyncProvider } from "../context/SyncContext";
import { refreshExerciseCatalogOnLaunch } from "../data/exerciseCatalog";
import { getUserProfile } from "../db/profiles";
import { initDB } from "../db/schema";
import { initSyncMeta } from "../db/syncMeta";
import { useAppReady } from "../hooks/useAppReady";
import { useDailySync } from "../hooks/useDailySync";
import { logDBStartup } from "../utils/diagnostics";
import { initNotifications } from "../notifications/notificationService";

const SPLASH_TEST_MS = 0; // Set to 4000 in dev to force full splash playback

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
    awaitingEmailVerification,
  } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Track splash visibility (starts true, set false after animation completes)
  const [splashVisible, setSplashVisible] = useState(true);
  const [forceSplashHoldUntil, setForceSplashHoldUntil] = useState<
    number | null
  >(null);

  // Calculate app readiness from multiple conditions
  const { isReady } = useAppReady({
    authLoading,
    dbInitialized: dbReady,
  });
  const isReadyForSplash = isReady && forceSplashHoldUntil === null;

  const runSplashTest = useCallback((ms = 4500) => {
    const duration = Math.max(0, ms);
    if (duration === 0) {
      setForceSplashHoldUntil(null);
      return;
    }
    setForceSplashHoldUntil(Date.now() + duration);
    setSplashVisible(true);
    console.log(`[SplashTest] Forcing splash for ${duration}ms`);
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as any).runSplashTest = runSplashTest;
    console.log(
      "[SplashTest] Dev helper ready. Run `runSplashTest(5000)` in console.",
    );
    return () => {
      delete (globalThis as any).runSplashTest;
    };
  }, [runSplashTest]);

  useEffect(() => {
    if (forceSplashHoldUntil === null) return;
    const remaining = Math.max(0, forceSplashHoldUntil - Date.now());
    const timer = setTimeout(() => {
      setForceSplashHoldUntil(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [forceSplashHoldUntil]);

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

    // Don't navigate away from login if awaiting email verification
    if (awaitingEmailVerification) return;

    const currentSegment = segments[0] as string;
    const isProtectedRoute =
      currentSegment === "(tabs)" ||
      currentSegment === "add-workout" ||
      currentSegment === "modal" ||
      currentSegment === "admin-catalog";
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
  }, [user, authLoading, segments, splashVisible, router, awaitingEmailVerification]);

  // Render animated splash overlay when visible
  // The splash handles its own exit animation based on isReady
  if (splashVisible) {
    return (
      <AnimatedSplashScreen
        isAppReady={isReadyForSplash}
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
        <Stack.Screen name="admin-catalog" />
      </Stack>

      {/* Auth sync overlay - shown during login/logout sync */}
      {isAuthSyncing && !awaitingEmailVerification && (
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
 * - Native Expo splash screen coordination
 * - Theme provider setup
 * - Auth provider wrapping
 *
 * Splash Screen Flow:
 * 1. App launches → Native splash visible (preventAutoHideAsync)
 * 2. DB init starts in background
 * 3. DB ready → Hide native splash (hideAsync)
 * 4. Animated splash takes over (visible for minimum 3s)
 * 5. When both conditions met (min time + app ready) → Exit animated splash
 * 6. App interface becomes visible
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  // Initialize database and manage native splash screen lifecycle
  useEffect(() => {
    let mounted = true;
    let initStartTime = Date.now();

    const initialize = async () => {
      try {
        console.log("[RootLayout] Starting app initialization...");

        // Initialize background notifications (Notifee + expo-notifications)
        console.log("[RootLayout] Initializing notifications...");
        await initNotifications();
        console.log(`[RootLayout] ✓ initNotifications complete (${Date.now() - initStartTime}ms)`);

        // Initialize SQLite database
        await initDB();
        console.log(`[RootLayout] ✓ initDB complete (${Date.now() - initStartTime}ms)`);

        // Initialize sync metadata
        await initSyncMeta();
        console.log(`[RootLayout] ✓ initSyncMeta complete (${Date.now() - initStartTime}ms)`);

        // Optional: Add artificial delay in dev for testing splash duration
        if (SPLASH_TEST_MS > 0 && __DEV__) {
          console.log(`[RootLayout] TEST MODE: Adding ${SPLASH_TEST_MS}ms delay`);
          await sleep(SPLASH_TEST_MS);
        }

        // Mark DB as ready (animated splash minimum timer still running at this point)
        if (mounted) {
          setDbReady(true);
          console.log(`[RootLayout] ✓ DB ready (${Date.now() - initStartTime}ms)`);
        }

        // Hide the native splash screen now (allow animated splash to show)
        if (mounted) {
          try {
            await SplashScreen.hideAsync();
            setNativeSplashHidden(true);
            console.log(`[RootLayout] ✓ Native splash hidden (${Date.now() - initStartTime}ms)`);
          } catch (e) {
            console.warn("[RootLayout] Native splash already hidden or error:", e);
            setNativeSplashHidden(true);
          }
        }

        // Refresh exercise catalog in background (non-blocking)
        refreshExerciseCatalogOnLaunch().catch((e) => {
          console.warn("[RootLayout] Exercise catalog refresh failed:", e);
        });
      } catch (error: any) {
        console.error("[RootLayout] Initialization error:", error?.message || error);
        setInitError(error?.message || "Unknown error");

        // Still mark as ready to allow recovery UI or fallback
        if (mounted) {
          setDbReady(true);
          try {
            await SplashScreen.hideAsync();
            setNativeSplashHidden(true);
          } catch (e) {
            // Ignore nested errors
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
              <BatteryOptimizationPrompt />
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

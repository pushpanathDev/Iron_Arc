import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {
  focusManager,
  onlineManager,
  QueryClient,
} from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform, View } from "react-native";
import type { AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../auth/AuthContext";
import { AnimatedSplashScreen } from "../components/AnimatedSplashScreen";
import { BadgeUnlockHost } from "../components/achievements/BadgeUnlockHost";
import { BatteryOptimizationPrompt } from "../components/BatteryOptimizationPrompt";
import { CantReachScreen } from "../components/connection/CantReachScreen";
import { StartupScreen } from "../components/connection/StartupScreen";
import { ConnectionProvider, useConnection } from "../context/ConnectionContext";
import { ThemeProvider as AppThemeProvider } from "../context/ThemeContext";
import { ToastProvider, useToast } from "../context/ToastContext";
import { useAppReady } from "../hooks/useAppReady";
import { useProfile } from "../hooks/useProfile";
import { configureWorkoutDeleteQueue, recoverWorkoutDeletes } from "../hooks/workoutDeleteQueue";
import { useNotificationScheduling } from "../hooks/useNotificationScheduling";
import { useNotificationTaps } from "../hooks/useNotificationTaps";
import { initNotifications } from "../notifications/notificationService";
import { isNetworkApiError } from "../services/api";
import { fontAssets } from "../theme/fonts";
import { useTheme } from "../theme/theme";
import { configureGoogle } from "../utils/googleSignin";

configureGoogle();

// Ensures Expo Router always starts at (tabs) even after dev reload state restore
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// --- Online / Focus managers (run once at module level) ---

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: (failureCount, error) => isNetworkApiError(error) && failureCount < 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
    },
    mutations: {
      // Never auto-retry writes: a request that timed out on the client may
      // already have succeeded on the server, so a retry creates duplicates.
      retry: 0,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "IRON_ARC_QUERY_CACHE",
  throttleTime: 1000,
});

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
    profile,
    loading: authLoading,
    status,
    retryBootstrap,
    awaitingEmailVerification,
  } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { data: cachedProfile } = useProfile();
  const availableProfile = profile ?? cachedProfile;
  useNotificationScheduling();
  useNotificationTaps();
  const { isDark } = useTheme();
  const connection = useConnection();
  const { showToast } = useToast();

  // Workout deletes run outside any screen (see hooks/workoutDeleteQueue).
  useEffect(() => {
    configureWorkoutDeleteQueue(queryClient, (_id, error) =>
      showToast({
        type: "error",
        message: "Couldn't delete workout",
        subtitle: isNetworkApiError(error) ? "Can't reach the server. It's back in your list." : "It's back in your list.",
      }),
    );
  }, [showToast]);
  // Deletes still pending when the app was killed are sent once signed in.
  const userId = user?.uid;
  useEffect(() => {
    if (userId) void recoverWorkoutDeletes(queryClient);
  }, [userId]);

  const [openSavedData, setOpenSavedData] = useState(false);
  // Whether saved data existed when the app opened (for dev outage simulation).
  const startedWithCache = useRef<boolean | null>(null);
  if (startedWithCache.current === null) startedWithCache.current = connection.hasCachedData;

  // When the server comes back after a failed start, load the account again.
  const authFailed = status === "backendUnreachable" || status === "bootstrapError";
  useEffect(() => {
    if (connection.serverReachable && authFailed) void retryBootstrap();
  }, [connection.serverReachable, authFailed, retryBootstrap]);

  // Track splash visibility (starts true, set false after animation completes)
  const [splashVisible, setSplashVisible] = useState(true);
  const [navigatorMounted, setNavigatorMounted] = useState(false);
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


  /**
   * Handle splash animation completion.
   * Only called when animation fully finishes (opacity → 0).
   */
  const handleSplashComplete = useCallback(() => {
    setSplashVisible(false);
  }, []);

  useEffect(() => {
    if (!splashVisible && !authLoading) {
      setNavigatorMounted(true);
    }
  }, [splashVisible, authLoading]);

  /**
   * Auth-based navigation.
   * Only runs after splash is dismissed to prevent visual jank.
   * Includes onboarding check for new users.
   */
  useEffect(() => {
    // Don't navigate while splash is visible or auth is loading
    if (!navigatorMounted || splashVisible || authLoading) return;

    // Don't navigate away from login if awaiting email verification
    if (awaitingEmailVerification || status === "bootstrapping" || status === "loading") return;

    const currentSegment = segments[0] as string;
    const isProtectedRoute =
      currentSegment === "(tabs)" ||
      currentSegment === "log" ||
      currentSegment === "admin-catalog" ||
      currentSegment === "ai-plan" ||
      currentSegment === "notification-settings" ||
      currentSegment === "plan-detail" ||
      currentSegment === "plan-chat" ||
      currentSegment === "achievements" ||
      currentSegment === "exercise" ||
      (__DEV__ && currentSegment === "dev-components");
    const isLoginRoute = currentSegment === "login";
    const isOnboardingRoute = currentSegment === "onboarding";

    const handleNavigation = async () => {
      if (!user && isProtectedRoute) {
        router.replace("/login");
      } else if (user && status === "needsOnboarding" && !isOnboardingRoute) {
        router.replace("/onboarding");
      } else if (user && isLoginRoute) {
        router.replace("/");
      } else if (
        user &&
        !isProtectedRoute &&
        !isOnboardingRoute &&
        !isLoginRoute
      ) {
        router.replace("/");
      }
    };

    handleNavigation();
  }, [user, authLoading, navigatorMounted, segments, splashVisible, router, awaitingEmailVerification, status]);

  // Render animated splash overlay when visible
  // The splash handles its own exit animation based on isReady
  const retryStartup = useCallback(() => {
    connection.retry();
    void retryBootstrap();
  }, [connection, retryBootstrap]);

  if (splashVisible) {
    return (
      <>
        <StatusBar style="light" />
        <AnimatedSplashScreen
          isAppReady={isReadyForSplash}
          onAnimationComplete={handleSplashComplete}
        />
      </>
    );
  }

  // Cold start with nothing saved: gate the app behind the startup screens.
  // With a saved profile we skip this and refresh in the background.
  const bootstrapping = authLoading || status === "loading" || status === "bootstrapping";
  const simulatedOutage =
    __DEV__ && connection.simulation !== "none" && !connection.serverReachable && !startedWithCache.current;
  const coldStart =
    !!user && !openSavedData && (simulatedOutage || (!availableProfile && (bootstrapping || authFailed)));
  const startFailed =
    connection.state === "offline" || connection.state === "unreachable" || (authFailed && !simulatedOutage);
  const stagesDone = !connection.networkUp ? 0 : connection.serverReachable ? 2 : 1;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 280,
          gestureEnabled: true,
          gestureDirection: "horizontal",
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="log/pick" options={{ animation: "slide_from_bottom" }} />
        {/* Back is intercepted to protect completed sets (Leave workout?). */}
        <Stack.Screen name="log/session" options={{ animation: "slide_from_right", fullScreenGestureEnabled: false }} />
        <Stack.Screen name="log/edit" options={{ animation: "slide_from_right", fullScreenGestureEnabled: false }} />
        <Stack.Screen name="exercise/[name]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="admin-catalog" />
        <Stack.Screen name="ai-plan" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="plan-detail" />
        <Stack.Screen name="plan-chat" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="dev-components" />
      </Stack>
      <BadgeUnlockHost />
      {coldStart && (
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 }}>
          {startFailed && !connection.hasCachedData ? (
            <CantReachScreen
              offline={connection.state === "offline"}
              retrying={connection.checking}
              onRetry={retryStartup}
              lastSyncedAt={connection.lastSyncedAt}
            />
          ) : (
            <StartupScreen
              stagesDone={stagesDone}
              showActions={startFailed}
              hasCachedData={connection.hasCachedData}
              retrying={connection.checking}
              onRetry={retryStartup}
              onOpenSaved={() => setOpenSavedData(true)}
            />
          )}
        </View>
      )}
    </View>
  );
}

/** React Navigation's theme follows the in-app theme, not only the system setting. */
function NavigationThemeBridge({ children }: { children: ReactNode }) {
  const { colors, isDark } = useTheme();
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.bg,
        card: colors.card,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [isDark, colors]);
  return <ThemeProvider value={navTheme}>{children}</ThemeProvider>;
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
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // A font failure falls back to the system font rather than blocking startup.
  const fontsReady = fontsLoaded || !!fontError;

  // Subscribe to AppState changes for focusManager
  useEffect(() => {
    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, []);

  // Initialize database and manage native splash screen lifecycle
  useEffect(() => {
    let mounted = true;
    let initStartTime = Date.now();

    const initialize = async () => {
      try {
        console.log("[RootLayout] Starting app initialization...");

        // Local notifications set up in the background: they took 3.5–7 s on a phone and
        // must never hold the splash (reminders are re-planned once data loads anyway).
        console.log("[RootLayout] Initializing notifications (background)...");
        void initNotifications().then(() => console.log(`[RootLayout] ✓ initNotifications complete (${Date.now() - initStartTime}ms)`));

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

      } catch (error: any) {
        console.error("[RootLayout] Initialization error:", error?.message || error);
        setInitError(error?.message || "Unknown error");

        // Still mark as ready to allow recovery UI or fallback
        if (mounted) {
          setDbReady(true);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  // Hide the native splash only once init has finished and fonts are loaded.
  useEffect(() => {
    if (!dbReady || !fontsReady) return;
    if (fontError) console.warn("[RootLayout] Font loading failed, using system font:", fontError);
    SplashScreen.hideAsync()
      .catch((e) => console.warn("[RootLayout] Native splash already hidden or error:", e))
      .finally(() => setNativeSplashHidden(true));
  }, [dbReady, fontsReady, fontError]);

  // Keep the native splash up until fonts are ready.
  if (!fontsReady) return null;

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
        <KeyboardProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncStoragePersister }}
        >
          <AppThemeProvider>
            <NavigationThemeBridge>
              <ConnectionProvider>
              <AuthProvider>
                <ToastProvider>
                  <BatteryOptimizationPrompt />
                  <RootNavigator dbReady={dbReady} />
                </ToastProvider>
              </AuthProvider>
              </ConnectionProvider>
            </NavigationThemeBridge>
          </AppThemeProvider>
        </PersistQueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

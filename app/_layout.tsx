import { useColorScheme } from "@/hooks/use-color-scheme";
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
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated as NativeAnimated, AppState, Platform, Pressable, Text, View } from "react-native";
import type { AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../auth/AuthContext";
import { AnimatedSplashScreen } from "../components/AnimatedSplashScreen";
import { BatteryOptimizationPrompt } from "../components/BatteryOptimizationPrompt";
import { ThemeProvider as AppThemeProvider } from "../context/ThemeContext";
import { ToastProvider } from "../context/ToastContext";
import { useAppReady } from "../hooks/useAppReady";
import { useProfile } from "../hooks/useProfile";
import { useNotificationScheduling } from "../hooks/useNotificationScheduling";
import { initNotifications } from "../notifications/notificationService";
import { isNetworkApiError } from "../services/api";

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
    bootstrapError,
    retryBootstrap,
    awaitingEmailVerification,
  } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { data: cachedProfile } = useProfile();
  const availableProfile = profile ?? cachedProfile;
  useNotificationScheduling();

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
      currentSegment === "add-workout" ||
      currentSegment === "modal" ||
      currentSegment === "admin-catalog" ||
      currentSegment === "ai-plan" ||
      currentSegment === "notification-settings" ||
      currentSegment === "plan-detail" ||
      currentSegment === "achievements";
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
  if (splashVisible) {
    return (
      <AnimatedSplashScreen
        isAppReady={isReadyForSplash}
        onAnimationComplete={handleSplashComplete}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {status === "backendUnreachable" && <OfflineBanner />}
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
        <Stack.Screen
          name="add-workout"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="admin-catalog" />
        <Stack.Screen name="ai-plan" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="plan-detail" />
        <Stack.Screen name="achievements" />
      </Stack>
      {(authLoading || status === "loading" || status === "bootstrapping") && (
        <View style={stateOverlayStyle}>
          <BootstrapState />
        </View>
      )}
      {!authLoading &&
        (status === "backendUnreachable" || status === "bootstrapError") &&
        !availableProfile && (
          <View style={stateOverlayStyle}>
            <BackendUnavailableState
              title={status === "backendUnreachable" ? "Can't reach the server" : "Couldn't load your account"}
              message={bootstrapError}
              onRetry={retryBootstrap}
            />
          </View>
        )}
    </View>
  );
}

function BootstrapState() {
  const [loaderMessage, setLoaderMessage] = useState("Waking up the server...");
  const pulse = useRef(new NativeAnimated.Value(0)).current;

  useEffect(() => {
    const firstNoticeTimer = setTimeout(
      () => setLoaderMessage("The first launch can take up to a minute while the server wakes up."),
      10_000,
    );
    const stillTryingTimer = setTimeout(
      () => setLoaderMessage("Still trying..."),
      25_000,
    );
    const animation = NativeAnimated.loop(
      NativeAnimated.sequence([
        NativeAnimated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        NativeAnimated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => {
      clearTimeout(firstNoticeTimer);
      clearTimeout(stillTryingTimer);
      animation.stop();
    };
  }, [pulse]);

  return (
    <View style={stateContainerStyle}>
      <View style={loaderStyle}>
        <ActivityIndicator size="large" color="#10B981" />
        <NativeAnimated.View
          style={{
            ...loaderPulseStyle,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
          }}
        />
      </View>
      <Text style={stateTitleStyle}>Getting your account ready</Text>
      <Text style={stateMessageStyle}>{loaderMessage}</Text>
    </View>
  );
}

function BackendUnavailableState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string | null;
  onRetry: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={stateContainerStyle}>
      <Text style={stateTitleStyle}>{title}</Text>
      <Text style={stateMessageStyle}>
        {message || "Check your connection and try again."}
      </Text>
      <Pressable onPress={retry} disabled={retrying} style={retryButtonStyle}>
        <Text style={retryButtonTextStyle}>{retrying ? "Retrying..." : "Retry"}</Text>
      </Pressable>
    </View>
  );
}

function OfflineBanner() {
  return (
    <View style={offlineBannerStyle}>
      <Text style={offlineBannerTextStyle}>Offline: showing cached data</Text>
    </View>
  );
}

const stateContainerStyle = {
  flex: 1,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  padding: 24,
  backgroundColor: "#0B1220",
};

const stateOverlayStyle = {
  ...stateContainerStyle,
  position: "absolute" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 10,
};

const stateTitleStyle = {
  color: "#FFFFFF",
  fontSize: 22,
  fontWeight: "700" as const,
  textAlign: "center" as const,
};

const loaderStyle = {
  width: 76,
  height: 76,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginBottom: 24,
};

const loaderPulseStyle = {
  position: "absolute" as const,
  width: 68,
  height: 68,
  borderRadius: 34,
  borderWidth: 2,
  borderColor: "#10B981",
};

const stateMessageStyle = {
  color: "#B8C2D1",
  fontSize: 15,
  textAlign: "center" as const,
  marginTop: 10,
  maxWidth: 340,
};

const retryButtonStyle = {
  marginTop: 22,
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 8,
  backgroundColor: "#10B981",
};

const retryButtonTextStyle = {
  color: "#FFFFFF",
  fontSize: 16,
  fontWeight: "700" as const,
};

const offlineBannerStyle = {
  backgroundColor: "#7C2D12",
  paddingVertical: 8,
  paddingHorizontal: 16,
};

const offlineBannerTextStyle = {
  color: "#FFEDD5",
  textAlign: "center" as const,
  fontSize: 13,
};

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

        // Initialize local Expo notifications
        console.log("[RootLayout] Initializing notifications...");
        await initNotifications();
        console.log(`[RootLayout] ✓ initNotifications complete (${Date.now() - initStartTime}ms)`);

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
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncStoragePersister }}
        >
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <AppThemeProvider>
              <AuthProvider>
                <ToastProvider>
                  <BatteryOptimizationPrompt />
                  <RootNavigator dbReady={dbReady} />
                </ToastProvider>
              </AuthProvider>
            </AppThemeProvider>
            <StatusBar style="auto" />
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

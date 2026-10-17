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
import { AppState, View } from "react-native";
import type { AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Animated, { FadeOut } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../providers/AuthContext";
import { AnimatedSplashScreen } from "../components/startup/AnimatedSplashScreen";
import { BadgeUnlockHost } from "../components/achievements/BadgeUnlockHost";
import { BatteryOptimizationPrompt } from "../components/startup/BatteryOptimizationPrompt";
import { CantReachScreen } from "../components/startup/CantReachScreen";
import { StartupScreen } from "../components/startup/StartupScreen";
import { ConnectionProvider, useConnection } from "../providers/ConnectionContext";
import { ThemeProvider as AppThemeProvider } from "../providers/ThemeContext";
import { ToastProvider, useToast } from "../providers/ToastContext";
import { useProfile } from "../hooks/useProfile";
import { configureWorkoutDeleteQueue, recoverWorkoutDeletes } from "../hooks/workoutDeleteQueue";
import { useNotificationScheduling } from "../hooks/useNotificationScheduling";
import { useNotificationTaps } from "../hooks/useNotificationTaps";
import { initNotifications } from "../notifications/notificationService";
import { isNetworkApiError } from "../services/api";
import { fontAssets } from "../theme/fonts";
import { useTheme } from "../theme/theme";
import { darkColors, motion } from "../theme/tokens";
import { configureGoogle } from "../services/googleSignin";

configureGoogle();

// Always start at the tabs, even when a dev reload restores another route.
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Queries pause offline and refetch when the app comes back to the foreground.
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === "active");
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

// Release builds log nothing. babel.config.js already removes console calls;
// this also quiets any that reach the console another way.
if (!__DEV__) {
  for (const level of ["log", "info", "debug", "warn", "error"] as const) console[level] = () => {};
}

// The native splash stays until the fonts load (see RootLayout).
SplashScreen.preventAutoHideAsync();

/** Screens that need a signed-in user. */
const PROTECTED_SEGMENTS = new Set(["(tabs)", "workout", "ai-plan", "notification-settings", "plan-detail", "plan-chat", "achievements", "exercise"]);

/**
 * Plays the animated splash, then routes by auth state (login, onboarding or
 * the app) and covers a first sign-in with the startup screen.
 */
function RootNavigator() {
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
  const { colors, isDark } = useTheme();
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

  const [splashVisible, setSplashVisible] = useState(true);
  const handleSplashComplete = useCallback(() => setSplashVisible(false), []);

  // Route by auth state once the splash has gone (never away from login while an email is being verified).
  useEffect(() => {
    if (splashVisible || authLoading || awaitingEmailVerification) return;
    if (status === "bootstrapping" || status === "loading") return;

    const segment = segments[0] as string;
    const inApp = PROTECTED_SEGMENTS.has(segment) || (__DEV__ && segment === "dev-components");
    if (!user) {
      if (inApp) router.replace("/login");
    } else if (status === "needsOnboarding") {
      if (segment !== "onboarding") router.replace("/onboarding");
    } else if (status === "unverified" && segment === "login") {
      // Signed in to an unverified account: its prompt is on the login screen.
      // Firebase reports the sign-in before the "awaiting verification" flag is
      // saved, and that gap used to send people to Home past onboarding.
    } else if (!inApp && segment !== "onboarding") {
      router.replace("/");
    }
  }, [user, authLoading, segments, splashVisible, router, awaitingEmailVerification, status]);

  const retryStartup = useCallback(() => {
    connection.retry();
    void retryBootstrap();
  }, [connection, retryBootstrap]);

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
  const showCantReach = coldStart && startFailed && !connection.hasCachedData;

  // Once the startup screen has shown, it stays until its ring reaches 100%
  // after the account loads; it closes at once on sign-out or "Open saved data".
  // The profile can land a moment before the status turns "ready", so either counts.
  const accountLoaded = !!user && (!!availableProfile || status === "ready" || status === "needsOnboarding");
  const [startupOpen, setStartupOpen] = useState(false);
  useEffect(() => {
    if (coldStart && !showCantReach) setStartupOpen(true);
    else if (!coldStart && !accountLoaded) setStartupOpen(false);
  }, [coldStart, showCantReach, accountLoaded]);

  if (splashVisible) {
    return (
      <>
        <StatusBar style="light" />
        <AnimatedSplashScreen
          isAppReady={!authLoading}
          onAnimationComplete={handleSplashComplete}
        />
      </>
    );
  }

  return (
    // Painted behind every screen: during transitions Android would otherwise show its
    // window, which follows the phone's light/dark setting (white in light mode).
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
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
        <Stack.Screen name="workout/pick" options={{ animation: "slide_from_bottom" }} />
        {/* Back is intercepted to protect completed sets (Leave workout?). */}
        <Stack.Screen name="workout/session" options={{ animation: "slide_from_right", fullScreenGestureEnabled: false }} />
        <Stack.Screen name="workout/edit" options={{ animation: "slide_from_right", fullScreenGestureEnabled: false }} />
        <Stack.Screen name="exercise/[name]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="ai-plan" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="plan-detail" />
        <Stack.Screen name="plan-chat" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="dev-components" />
      </Stack>
      <BadgeUnlockHost />
      {(coldStart || startupOpen) && (
        <Animated.View exiting={FadeOut.duration(motion.slideMs)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 }}>
          {showCantReach ? (
            <CantReachScreen
              offline={connection.state === "offline"}
              retrying={connection.checking}
              onRetry={retryStartup}
              lastSyncedAt={connection.lastSyncedAt}
            />
          ) : (
            <StartupScreen
              stagesDone={coldStart ? stagesDone : 3}
              onComplete={() => setStartupOpen(false)}
              showActions={startFailed}
              hasCachedData={connection.hasCachedData}
              retrying={connection.checking}
              onRetry={retryStartup}
              onOpenSaved={() => setOpenSavedData(true)}
            />
          )}
        </Animated.View>
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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // A font failure falls back to the system font rather than blocking startup.
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, []);

  // Notification setup took 3.5–7 s on a phone, so it never holds the splash
  // (reminders are re-planned once data loads anyway).
  useEffect(() => {
    void initNotifications();
  }, []);

  useEffect(() => {
    if (!fontsReady) return;
    if (fontError) console.warn("[RootLayout] Font loading failed, using system font:", fontError);
    SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, fontError]);

  // Keep the native splash up until fonts are ready.
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: darkColors.bg }}>
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
                  <RootNavigator />
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

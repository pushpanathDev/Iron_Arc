/**
 * useAppReady Hook
 * ================
 * Tracks app initialization state for splash screen coordination.
 * 
 * Design Philosophy:
 * - Single source of truth for "app ready" state
 * - Event-driven (no setTimeout-based readiness)
 * - Composable: each readiness condition tracked independently
 * - Memory-safe: cleanup handled automatically
 * - Dual-condition compatible: works with minimum time gates
 * 
 * Readiness Conditions (ALL must be true):
 * 1. Auth state resolved (user object or null confirmed)
 * 2. Database initialized (SQLite ready)
 * 3. Theme loaded (colors/fonts available)
 * 
 * The splash screen will exit when:
 * - All conditions here return isReady = true
 * - AND minimum splash duration (3s) has passed
 */

import { useEffect, useMemo, useState } from "react";

export interface AppReadyState {
  /** Auth state has been resolved (user or null confirmed) */
  authReady: boolean;
  /** SQLite database is initialized and accessible */
  dbReady: boolean;
  /** Theme/assets are loaded */
  themeReady: boolean;
  /** All conditions met - app is fully ready for main UI */
  isReady: boolean;
}

interface UseAppReadyOptions {
  /** Override auth ready state (from AuthContext) */
  authLoading?: boolean;
  /** Override db ready state */
  dbInitialized?: boolean;
}

/**
 * Hook to track app initialization readiness.
 * Returns true only when ALL conditions are met.
 * 
 * Safe for use in splash screen coordination:
 * - Combines with minimum display time timer
 * - Never blocks app permanently
 * - Works with safety timeouts
 * 
 * @example
 * ```tsx
 * const { isReady, authReady, dbReady } = useAppReady({ 
 *   authLoading: loading,      // from useAuth()
 *   dbInitialized: dbReady     // from _layout.tsx
 * });
 * 
 * // Use in splash screen
 * if (minTimePassed && isReady) {
 *   // Exit splash and show main app
 * }
 * ```
 */
export function useAppReady(options: UseAppReadyOptions = {}): AppReadyState {
  const startTime = useMemo(() => Date.now(), []);
  const { authLoading = true, dbInitialized = false } = options;

  // Track state transitions for debugging
  const [stateDebug, setStateDebug] = useState({
    authReady: false,
    dbReady: false,
    timestamp: Date.now(),
  });

  // Theme is considered ready immediately in this architecture
  // (Colors are static exports, no async loading required)
  const [themeReady] = useState(true);

  // Derive ready states
  const authReady = !authLoading;
  const dbReady = dbInitialized;

  // Log state transitions for debugging splash screen timing
  useEffect(() => {
    const elapsed = Date.now() - startTime;
    if (authReady !== stateDebug.authReady || dbReady !== stateDebug.dbReady) {
      setStateDebug({ authReady, dbReady, timestamp: elapsed });
      console.log(
        `[AppReady] Updated at ${elapsed}ms - auth: ${authReady ? "✓" : "⏳"} | db: ${dbReady ? "✓" : "⏳"}`,
      );
    }
  }, [authReady, dbReady, startTime, stateDebug.authReady, stateDebug.dbReady]);

  // Memoize the final ready state to prevent unnecessary re-renders
  const isReady = useMemo(() => {
    return authReady && dbReady && themeReady;
  }, [authReady, dbReady, themeReady]);

  // Log when app becomes fully ready
  useEffect(() => {
    if (isReady) {
      const elapsed = Date.now() - startTime;
      console.log(`[AppReady] ✓ APP FULLY READY (${elapsed}ms elapsed)`);
    }
  }, [isReady, startTime]);

  return {
    authReady,
    dbReady,
    themeReady,
    isReady,
  };
}

/**
 * Standalone function to check if app is ready.
 * Useful for imperative checks outside of React.
 */
export function checkAppReady(state: Omit<AppReadyState, "isReady">): boolean {
  return state.authReady && state.dbReady && state.themeReady;
}

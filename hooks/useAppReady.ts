/**
 * useAppReady Hook
 * ================
 * Tracks app initialization state for splash screen coordination.
 * 
 * Design Philosophy:
 * - Single source of truth for "app ready" state
 * - No setTimeout-based readiness (event-driven only)
 * - Composable: each readiness condition is tracked independently
 * - Memory-safe: cleanup handled automatically
 * 
 * Readiness Conditions:
 * 1. Auth state resolved (user object or null confirmed)
 * 2. Database initialized (SQLite ready)
 * 3. Theme loaded (colors/fonts available)
 */

import { useEffect, useMemo, useState } from "react";

export interface AppReadyState {
  /** Auth state has been resolved (user or null) */
  authReady: boolean;
  /** SQLite database is initialized */
  dbReady: boolean;
  /** Theme/assets are loaded */
  themeReady: boolean;
  /** All conditions met - app is fully ready */
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
 * @example
 * ```tsx
 * const { isReady } = useAppReady({ 
 *   authLoading: loading,  // from useAuth()
 *   dbInitialized: true    // from initDB() completion
 * });
 * ```
 */
export function useAppReady(options: UseAppReadyOptions = {}): AppReadyState {
  const { authLoading = true, dbInitialized = false } = options;

  // Theme is considered ready immediately in this architecture
  // (Colors are static exports, no async loading required)
  const [themeReady] = useState(true);

  // Derive ready states
  const authReady = !authLoading;
  const dbReady = dbInitialized;

  // Memoize the final ready state to prevent unnecessary re-renders
  const isReady = useMemo(() => {
    return authReady && dbReady && themeReady;
  }, [authReady, dbReady, themeReady]);

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

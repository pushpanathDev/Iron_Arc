import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { SyncLoader } from "../components/SyncLoader";
import { syncAllData } from "../db/syncQueue";
import { syncWorkoutsFromFirebase } from "../firebase/sync";
import { pullWeightsFromFirebase } from "../firebase/weights";

interface SyncContextType {
  isSyncing: boolean;
  syncMessage: string | null;
  startSync: (message?: string) => void;
  endSync: () => void;
  /** Triggers a global sync that refreshes ALL data across the app */
  globalSync: (userId: string) => Promise<void>;
  /** Subscribe to refresh notifications - returns unsubscribe function */
  subscribeToRefresh: (callback: () => void) => () => void;
  /** Version counter that increments on each global sync */
  refreshVersion: number;
}

const SyncContext = createContext<SyncContextType>({
  isSyncing: false,
  syncMessage: null,
  startSync: () => {},
  endSync: () => {},
  globalSync: async () => {},
  subscribeToRefresh: () => () => {},
  refreshVersion: 0,
});

/**
 * Provider for global sync state
 * Shows floating loader when syncing anywhere in the app
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshCallbacksRef = useRef<Set<() => void>>(new Set());

  const startSync = useCallback((message?: string) => {
    setIsSyncing(true);
    setSyncMessage(message || null);
  }, []);

  const endSync = useCallback(() => {
    setIsSyncing(false);
    setSyncMessage(null);
  }, []);

  const subscribeToRefresh = useCallback((callback: () => void) => {
    refreshCallbacksRef.current.add(callback);
    return () => {
      refreshCallbacksRef.current.delete(callback);
    };
  }, []);

  const notifyRefresh = useCallback(() => {
    setRefreshVersion((v) => v + 1);
    refreshCallbacksRef.current.forEach((cb) => cb());
  }, []);

  /**
   * Global sync - FIRST pushes local changes, THEN pulls from Firebase
   * This ensures no local data is lost during sync
   */
  const globalSync = useCallback(
    async (userId: string) => {
      if (isSyncing) return; // Prevent concurrent syncs

      try {
        setIsSyncing(true);

        // STEP 1: Push all local changes to Firebase first
        setSyncMessage("Pushing local changes...");
        console.log("⬆️ Global sync: pushing local changes...");
        const pushResult = await syncAllData(userId);
        console.log("⬆️ Push complete:", pushResult);

        // STEP 2: Pull workouts from Firebase
        setSyncMessage("Pulling workouts...");
        console.log("⬇️ Global sync: pulling workouts...");
        await syncWorkoutsFromFirebase(userId);

        // STEP 3: Pull weights from Firebase
        setSyncMessage("Pulling body weights...");
        console.log("⬇️ Global sync: pulling weights...");
        await pullWeightsFromFirebase(userId);

        // Notify all screens to refresh their data
        notifyRefresh();

        console.log("✅ Global sync complete");
      } catch (error) {
        console.error("❌ Global sync error:", error);
        throw error;
      } finally {
        setIsSyncing(false);
        setSyncMessage(null);
      }
    },
    [isSyncing, notifyRefresh],
  );

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        syncMessage,
        startSync,
        endSync,
        globalSync,
        subscribeToRefresh,
        refreshVersion,
      }}
    >
      {children}
      <SyncLoader visible={isSyncing} message={syncMessage ?? undefined} />
    </SyncContext.Provider>
  );
}

/**
 * Hook to access global sync state
 */
export function useGlobalSync() {
  return useContext(SyncContext);
}

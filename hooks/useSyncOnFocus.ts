import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { getSyncStatus, syncWeightQueue } from "../db/syncQueue";

export interface SyncStatus {
  pendingCount: number;
  isPending: boolean;
  lastSyncTime: number | null;
  failedCount: number;
}

/**
 * Hook to automatically sync weights when screen comes into focus
 * Also exposes sync status for UI indicators
 *
 * Usage:
 *   const syncStatus = useSyncOnFocus(user?.uid);
 *
 *   if (syncStatus.isPending) {
 *     <Badge>{syncStatus.pendingCount} syncing...</Badge>
 *   }
 */
export function useSyncOnFocus(userId?: string) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pendingCount: 0,
    isPending: false,
    lastSyncTime: null,
    failedCount: 0,
  });

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      const syncWeights = async () => {
        try {
          // Sync in background
          await syncWeightQueue(userId);

          // Update status
          const status = await getSyncStatus(userId);
          setSyncStatus(status);

          if (status.pendingCount > 0) {
            console.log(
              `⚠️ ${status.pendingCount} weight(s) still pending sync`,
            );
          }
        } catch (error) {
          console.error("Failed to sync weights on focus:", error);
        }
      };

      syncWeights();
    }, [userId]),
  );

  return syncStatus;
}

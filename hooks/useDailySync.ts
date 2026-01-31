/* ======================================================
   DAILY AUTO-SYNC HOOK
   
   Runs once per calendar day to ensure backup to Firebase
   ====================================================== */

import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getLastSync, setLastSync } from "../db/syncMeta";
import { syncWeightQueue } from "../db/syncQueue";
import { logger } from "../utils/logger";
import { formatDate } from "../utils/weekUtils";

/**
 * Auto-syncs weights once per calendar day
 * Runs when app comes into focus if date has changed
 *
 * Usage:
 *   useDailySync(user?.uid);
 *
 * ⚠️ IMPORTANT: Hook is ALWAYS called, even if userId is undefined
 * This prevents React Hook order violations
 */
export function useDailySync(userId?: string) {
  // ✅ ALWAYS call the hook, regardless of userId
  // Only skip the actual sync if userId is undefined
  useFocusEffect(
    useCallback(() => {
      // Only proceed if userId is available
      if (!userId) return;

      checkAndRunDailySync(userId);
    }, [userId]),
  );
}

/**
 * Check if daily sync should run (once per calendar date)
 * Runs silently in background
 */
export async function checkAndRunDailySync(userId: string) {
  try {
    const lastSyncTs = await getLastSync("weights_daily_sync");
    const lastSyncDate = lastSyncTs ? formatDate(new Date(lastSyncTs)) : null;
    const todayDate = formatDate(new Date());

    // Only sync if date has changed
    if (todayDate !== lastSyncDate) {
      logger.sync("Daily sync", `Running for ${todayDate}`);

      const result = await syncWeightQueue(userId);

      if (result.success) {
        logger.success(
          "Daily sync complete",
          `Synced ${result.synced} records`,
        );
      } else if (result.failed > 0) {
        logger.warn("Daily sync partial", `${result.failed} records failed`);
      }

      // Record sync date
      await setLastSync("weights_daily_sync", Date.now());
    } else {
      // Already synced today, skip
      logger.debug("Daily sync already ran today");
    }
  } catch (error) {
    // Silently fail, will retry on next app open
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn("Daily sync check failed", errorMsg);
  }
}

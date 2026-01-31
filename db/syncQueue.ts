import { syncWeightAdd, syncWeightDelete } from "../firebase/weights";
import { pushWorkoutToFirebase, deleteWorkoutFromFirebase } from "../firebase/workout";
import { getLastSync, setLastSync } from "./syncMeta";
import {
  deleteWeightById,
  getUnsyncedWeights,
  markWeightSynced,
  markWeightSyncError,
} from "./weights";
import {
  getUnsyncedWorkouts,
  hardDeleteWorkout,
  markWorkoutSynced,
  markWorkoutSyncError,
  resetAllFailedWorkouts,
} from "./workouts";

/* ======================================================
   SYNC QUEUE MANAGER
   
   Batches unsynced weights and syncs them to Firebase.
   Handles retries, errors, and soft-deleted records.
   
   SAFETY GUARANTEES:
   ✅ Hard deletes only after Firebase confirms
   ✅ Max retry count prevents runaway queue growth
   ✅ Exponential backoff with ceiling
   ✅ Sync state tracked for observability
   ====================================================== */

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
  timestamp: number;
  pendingCount?: number; // How many still need sync after this operation
}

const MAX_RETRIES_PER_RECORD = 5;
const MAX_BACKOFF_SECONDS = 60;
const MAX_QUEUE_SIZE = 1000; // Safety limit

/**
 * Sync all unsynced weights for a user to Firebase
 *
 * SAFETY:
 * - Only hard deletes AFTER Firebase confirms deletion
 * - Tracks retry count to prevent infinite loops
 * - Enforces queue size limit
 * - Records timestamp for observability
 */
export async function syncWeightQueue(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
    timestamp: Date.now(),
  };

  try {
    const unsynced = await getUnsyncedWeights(userId);

    if (unsynced.length === 0) {
      console.log("✅ Weight queue is up to date");
      result.pendingCount = 0;
      await setLastSync("weights", Date.now());
      return result;
    }

    // Safety: Prevent runaway queue growth
    if (unsynced.length > MAX_QUEUE_SIZE) {
      result.success = false;
      result.errors.push(
        `Queue size (${unsynced.length}) exceeds limit (${MAX_QUEUE_SIZE}). Manual intervention needed.`,
      );
      console.error("❌ Sync queue too large:", unsynced.length);
      return result;
    }

    console.log(`🔄 Syncing ${unsynced.length} weight records...`);

    for (const weight of unsynced) {
      try {
        // Check retry count before attempting
        const retryCount = extractRetryCount(weight.syncError);
        if (retryCount >= MAX_RETRIES_PER_RECORD) {
          result.failed++;
          result.errors.push(
            `Weight ${weight.id}: Max retries (${MAX_RETRIES_PER_RECORD}) exceeded`,
          );
          console.warn(`⚠️ Weight ${weight.id} max retries exceeded, skipping`);
          continue;
        }

        if (weight.isDeleted === 1) {
          // CRITICAL: Only hard delete AFTER Firebase confirms
          await syncWeightDelete(userId, weight.id);
          // Firebase deletion confirmed - now safe to hard delete
          await deleteWeightById(weight.id);
          console.log(
            `✅ Deleted weight ${weight.id} from both Firebase and local`,
          );
        } else {
          // Sync add/update
          await syncWeightAdd(userId, weight);
          await markWeightSynced(weight.id);
          console.log(`✅ Synced weight ${weight.id}`);
        }
        result.synced++;
      } catch (error) {
        result.failed++;
        result.success = false;

        const errorMsg = error instanceof Error ? error.message : String(error);
        const newError = `[Retry ${extractRetryCount(weight.syncError) + 1}/${MAX_RETRIES_PER_RECORD}] ${errorMsg}`;
        result.errors.push(`Weight ${weight.id}: ${newError}`);

        // Mark with error and increment retry counter
        await markWeightSyncError(weight.id, newError);

        console.warn(`❌ Failed to sync weight ${weight.id}:`, error);
      }
    }

    // Record final pending count
    const finalUnsynced = await getUnsyncedWeights(userId);
    result.pendingCount = finalUnsynced.length;

    // Only update last sync if we made progress
    if (result.synced > 0) {
      await setLastSync("weights", Date.now());
    }

    const summary = `Synced: ${result.synced}, Failed: ${result.failed}, Pending: ${result.pendingCount}`;
    if (result.success) {
      console.log(`✅ Weight sync complete - ${summary}`);
    } else {
      console.warn(`⚠️ Weight sync partial - ${summary}`);
    }
  } catch (error) {
    result.success = false;
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Sync queue error: ${errorMsg}`);
    console.error("❌ Weight sync queue error:", error);
  }

  return result;
}

/**
 * Retry failed syncs with exponential backoff and ceiling
 */
export async function retryFailedSyncs(
  userId: string,
  maxAttempts: number = 3,
): Promise<SyncResult> {
  let attempt = 0;
  let result: SyncResult;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`🔄 Retry attempt ${attempt}/${maxAttempts}...`);

    result = await syncWeightQueue(userId);

    if (result.success || result.pendingCount === 0) {
      return result;
    }

    // Exponential backoff with ceiling: 2s, 4s, 8s, 16s, 60s, 60s...
    const backoffSeconds = Math.min(Math.pow(2, attempt), MAX_BACKOFF_SECONDS);
    console.log(
      `⏳ Waiting ${backoffSeconds}s before retry ${attempt + 1}/${maxAttempts}...`,
    );
    await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
  }

  console.error(
    `❌ Retries exhausted. Still ${result!.pendingCount} items pending sync.`,
  );
  return result!;
}

/**
 * Get sync status for UI indicators
 */
export async function getSyncStatus(userId: string) {
  const unsynced = await getUnsyncedWeights(userId);
  const lastSync = await getLastSync("weights");

  return {
    pendingCount: unsynced.length,
    isPending: unsynced.length > 0,
    lastSyncTime: lastSync,
    failedCount: unsynced.filter((w) => w.syncError).length,
  };
}

/**
 * Extract retry count from error message
 * Format: "[Retry 2/5] Network error..."
 */
function extractRetryCount(errorMsg: string | null | undefined): number {
  if (!errorMsg) return 0;
  const match = errorMsg.match(/\[Retry (\d+)\//);
  return match ? parseInt(match[1], 10) : 0;
}

/* ======================================================
   WORKOUT SYNC QUEUE
   
   Batches unsynced workouts and syncs them to Firebase.
   Same safety guarantees as weight sync.
   ====================================================== */

/**
 * Sync all unsynced workouts for a user to Firebase
 */
/**
 * Option to reset failed records before syncing
 */
export async function syncWorkoutQueue(userId: string, resetFailed: boolean = false): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
    timestamp: Date.now(),
  };

  try {
    // Reset failed records if requested (allows retry after code fixes)
    if (resetFailed) {
      await resetAllFailedWorkouts(userId);
    }

    const unsynced = await getUnsyncedWorkouts(userId);

    if (unsynced.length === 0) {
      console.log("✅ Workout queue is up to date");
      result.pendingCount = 0;
      await setLastSync("workouts", Date.now());
      return result;
    }

    // Safety: Prevent runaway queue growth
    if (unsynced.length > MAX_QUEUE_SIZE) {
      result.success = false;
      result.errors.push(
        `Workout queue size (${unsynced.length}) exceeds limit (${MAX_QUEUE_SIZE}). Manual intervention needed.`,
      );
      console.error("❌ Workout sync queue too large:", unsynced.length);
      return result;
    }

    console.log(`🔄 Syncing ${unsynced.length} workout records...`);

    for (const workout of unsynced) {
      try {
        // Check retry count before attempting
        const retryCount = extractRetryCount(workout.syncError);
        if (retryCount >= MAX_RETRIES_PER_RECORD) {
          result.failed++;
          result.errors.push(
            `Workout ${workout.id}: Max retries (${MAX_RETRIES_PER_RECORD}) exceeded`,
          );
          console.warn(`⚠️ Workout ${workout.id} max retries exceeded, skipping`);
          continue;
        }

        if (workout.isDeleted === 1) {
          // CRITICAL: Only hard delete AFTER Firebase confirms
          await deleteWorkoutFromFirebase(userId, workout.id);
          // Firebase deletion confirmed - now safe to hard delete
          await hardDeleteWorkout(workout.id);
          console.log(
            `✅ Deleted workout ${workout.id} from both Firebase and local`,
          );
        } else {
          // Sync add/update - prepare data for Firebase
          // Firebase doesn't accept undefined, convert to null
          const workoutData = {
            id: workout.id,
            date: workout.date,
            exercise: workout.exercise,
            category: workout.category ?? null,
            notes: workout.notes ?? null,
            createdAt: workout.createdAt,
            sets: workout.sets ?? [],
          };
          await pushWorkoutToFirebase(userId, workoutData);
          await markWorkoutSynced(workout.id);
          console.log(`✅ Synced workout ${workout.id}`);
        }
        result.synced++;
      } catch (error) {
        result.failed++;
        result.success = false;

        const errorMsg = error instanceof Error ? error.message : String(error);
        const newError = `[Retry ${extractRetryCount(workout.syncError) + 1}/${MAX_RETRIES_PER_RECORD}] ${errorMsg}`;
        result.errors.push(`Workout ${workout.id}: ${newError}`);

        // Mark with error and increment retry counter
        await markWorkoutSyncError(workout.id, newError);

        console.warn(`❌ Failed to sync workout ${workout.id}:`, error);
      }
    }

    // Record final pending count
    const finalUnsynced = await getUnsyncedWorkouts(userId);
    result.pendingCount = finalUnsynced.length;

    // Only update last sync if we made progress
    if (result.synced > 0) {
      await setLastSync("workouts", Date.now());
    }

    const summary = `Synced: ${result.synced}, Failed: ${result.failed}, Pending: ${result.pendingCount}`;
    if (result.success) {
      console.log(`✅ Workout sync complete - ${summary}`);
    } else {
      console.warn(`⚠️ Workout sync partial - ${summary}`);
    }
  } catch (error) {
    result.success = false;
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Workout sync queue error: ${errorMsg}`);
    console.error("❌ Workout sync queue error:", error);
  }

  return result;
}

/**
 * Get workout sync status for UI indicators
 */
export async function getWorkoutSyncStatus(userId: string) {
  const unsynced = await getUnsyncedWorkouts(userId);
  const lastSync = await getLastSync("workouts");

  return {
    pendingCount: unsynced.length,
    isPending: unsynced.length > 0,
    lastSyncTime: lastSync,
    failedCount: unsynced.filter((w) => w.syncError).length,
  };
}

/**
 * Sync ALL data (weights + workouts) - master sync function
 * @param resetFailed - if true, reset max-retry records to allow another attempt
 */
export async function syncAllData(userId: string, resetFailed: boolean = false): Promise<{
  weights: SyncResult;
  workouts: SyncResult;
}> {
  const [weights, workouts] = await Promise.all([
    syncWeightQueue(userId),
    syncWorkoutQueue(userId, resetFailed),
  ]);

  return { weights, workouts };
}

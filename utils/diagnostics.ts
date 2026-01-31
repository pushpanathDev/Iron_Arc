/* ======================================================
   DATABASE STARTUP DIAGNOSTICS
   
   Logs initial state of SQLite on app startup
   ====================================================== */

import { getAllWeights, getUnsyncedWeights } from "../db/weights";
import { getAllWorkouts } from "../db/workouts";
import { logger } from "./logger";

export interface DBStartupState {
  totalWeights: number;
  unSyncedWeights: number;
  totalWorkouts: number;
  dbSize: string;
  timestamp: number;
}

export async function logDBStartup(userId?: string): Promise<DBStartupState> {
  console.log("\n" + "═".repeat(60));
  console.log("🚀 APP STARTUP - DATABASE STATE");
  console.log("═".repeat(60));

  const startTime = Date.now();

  try {
    if (!userId) {
      console.log("⏳ Waiting for user authentication...");
      return {
        totalWeights: 0,
        unSyncedWeights: 0,
        totalWorkouts: 0,
        dbSize: "N/A",
        timestamp: Date.now(),
      };
    }

    // Get counts
    const weights = await getAllWeights(userId);
    const unsynced = await getUnsyncedWeights(userId);
    const workouts = await getAllWorkouts(userId);

    // Format display
    console.log(`\n📊 Data Summary`);
    console.log(`  • Total Weights:      ${weights.length}`);
    console.log(`  • Pending Sync:       ${unsynced.length}`);
    console.log(`  • Total Workouts:     ${workouts.length}`);

    if (unsynced.length > 0) {
      console.log(`\n⚠️ Unsynced Records:`);
      unsynced.forEach((w) => {
        console.log(`    - Weight ${w.id.slice(0, 8)}... (${w.date})`);
      });
    }

    // Show recent weights
    if (weights.length > 0) {
      console.log(`\n📈 Recent Weights:`);
      weights.slice(0, 3).forEach((w) => {
        const status = w.isSynced ? "✅" : "⏳";
        console.log(`    ${status} ${w.date}: ${w.weight}kg`);
      });
    }

    // Show recent workouts
    if (workouts.length > 0) {
      console.log(`\n💪 Recent Workouts:`);
      workouts.slice(0, 3).forEach((w) => {
        console.log(`    ${w.date}: ${w.exercise} (${w.sets.length} sets)`);
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Startup diagnostics completed in ${elapsed}ms`);
    console.log("═".repeat(60) + "\n");

    return {
      totalWeights: weights.length,
      unSyncedWeights: unsynced.length,
      totalWorkouts: workouts.length,
      dbSize: `${(weights.length + workouts.length) * 0.5}KB (est)`,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("❌ Startup diagnostics failed:", error);
    throw error;
  }
}

/* ======================================================
   PAGE-LEVEL SUMMARY LOGS
   ====================================================== */

export async function logPageState(
  pageName: string,
  userId: string,
): Promise<void> {
  try {
    switch (pageName) {
      case "BodyWeight":
        await logBodyWeightPageState(userId);
        break;
      case "Workout":
        await logWorkoutPageState(userId);
        break;
      case "Analytics":
        await logAnalyticsPageState(userId);
        break;
    }
  } catch (error) {
    logger.error(
      "Failed to log page state",
      String(error),
      undefined,
      pageName,
    );
  }
}

async function logBodyWeightPageState(userId: string) {
  const weights = await getAllWeights(userId);
  const unsynced = await getUnsyncedWeights(userId);

  logger.info(
    "Page loaded",
    `${weights.length} records, ${unsynced.length} pending sync`,
    "BodyWeight",
  );

  if (unsynced.length > 0) {
    logger.warn(
      "Pending sync detected",
      `${unsynced.length} record(s) need syncing`,
      "BodyWeight",
    );
  }
}

async function logWorkoutPageState(userId: string) {
  const workouts = await getAllWorkouts(userId);
  logger.info("Page loaded", `${workouts.length} workouts`, "Workout");
}

async function logAnalyticsPageState(userId: string) {
  const weights = await getAllWeights(userId);
  logger.info(
    "Page loaded",
    `${weights.length} weight records available`,
    "Analytics",
  );
}

/* ======================================================
   DEBUG HELPERS
   ====================================================== */

/**
 * Get all logs as formatted string (for sharing/debugging)
 */
export function getLogs(): string {
  return logger.export();
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logger.clear();
  console.log("🗑️ Logs cleared");
}

/**
 * Print logs table to console
 */
export function printLogs(): void {
  logger.table();
}

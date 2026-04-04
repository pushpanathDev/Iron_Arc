/**
 * Workout Drafts Management
 * =========================
 * Auto-save and recovery system for workout sessions.
 * Prevents data loss from crashes or unexpected interruptions.
 *
 * Features:
 * - Auto-save on changes
 * - Draft recovery on app restart
 * - Automatic cleanup of old drafts
 * - Per-user draft isolation
 */

import { sqliteDb } from "./sqlite";

export interface WorkoutDraft {
  id: string;
  userId: string;
  date?: string;
  exercise?: string;
  category?: string;
  notes?: string;
  sets: Array<{ reps: string; weight: string }>;
  lastSavedAt: number;
  createdAt: number;
}

/**
 * Save or update a workout draft
 * Called automatically when form state changes
 */
export async function saveWorkoutDraft(
  userId: string,
  draftId: string,
  data: Partial<Omit<WorkoutDraft, "lastSavedAt" | "createdAt" | "userId">>,
): Promise<void> {
  try {
    const now = Date.now();
    
    // Check if draft exists
    const existing = await sqliteDb.getFirstAsync<{ id: string }>(
      "SELECT id FROM workout_drafts WHERE id = ? AND userId = ?",
      [draftId, userId],
    );

    if (existing) {
      // Update existing draft
      await sqliteDb.runAsync(
        `UPDATE workout_drafts 
         SET date = ?, 
             exercise = ?, 
             category = ?, 
             notes = ?, 
             sets = ?,
             lastSavedAt = ?
         WHERE id = ? AND userId = ?`,
        [
          data.date || null,
          data.exercise || null,
          data.category || null,
          data.notes || null,
          JSON.stringify(data.sets || []),
          now,
          draftId,
          userId,
        ],
      );
    } else {
      // Insert new draft
      await sqliteDb.runAsync(
        `INSERT INTO workout_drafts (id, userId, date, exercise, category, notes, sets, lastSavedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          draftId,
          userId,
          data.date || null,
          data.exercise || null,
          data.category || null,
          data.notes || null,
          JSON.stringify(data.sets || []),
          now,
          now,
        ],
      );
    }

    console.log("✅ Workout draft auto-saved:", draftId);
  } catch (error) {
    console.error("Failed to save workout draft:", error);
    // Non-critical error - don't throw, let app continue
  }
}

/**
 * Load a workout draft
 * Used to restore draft when user returns to the form
 */
export async function getWorkoutDraft(
  userId: string,
  draftId: string,
): Promise<WorkoutDraft | null> {
  try {
    const result = await sqliteDb.getFirstAsync<{
      id: string;
      userId: string;
      date: string | null;
      exercise: string | null;
      category: string | null;
      notes: string | null;
      sets: string;
      lastSavedAt: number;
      createdAt: number;
    }>(
      "SELECT * FROM workout_drafts WHERE id = ? AND userId = ?",
      [draftId, userId],
    );

    if (!result) return null;

    return {
      ...result,
      date: result.date || undefined,
      exercise: result.exercise || undefined,
      category: result.category || undefined,
      notes: result.notes || undefined,
      sets: JSON.parse(result.sets || "[]"),
    };
  } catch (error) {
    console.error("Failed to load workout draft:", error);
    return null;
  }
}

/**
 * Get all drafts for a user
 * Used to show recovery options or cleanup old drafts
 */
export async function getUserWorkoutDrafts(
  userId: string,
): Promise<WorkoutDraft[]> {
  try {
    const results = await sqliteDb.getAllAsync<{
      id: string;
      userId: string;
      date: string | null;
      exercise: string | null;
      category: string | null;
      notes: string | null;
      sets: string;
      lastSavedAt: number;
      createdAt: number;
    }>(
      "SELECT * FROM workout_drafts WHERE userId = ? ORDER BY lastSavedAt DESC",
      [userId],
    );

    return results.map((result) => ({
      ...result,
      date: result.date || undefined,
      exercise: result.exercise || undefined,
      category: result.category || undefined,
      notes: result.notes || undefined,
      sets: JSON.parse(result.sets || "[]"),
    }));
  } catch (error) {
    console.error("Failed to load drafts:", error);
    return [];
  }
}

/**
 * Delete a specific workout draft
 * Called when user completes the workout or explicitly deletes the draft
 */
export async function deleteWorkoutDraft(
  userId: string,
  draftId: string,
): Promise<void> {
  try {
    await sqliteDb.runAsync(
      "DELETE FROM workout_drafts WHERE id = ? AND userId = ?",
      [draftId, userId],
    );
    console.log("✅ Workout draft deleted:", draftId);
  } catch (error) {
    console.error("Failed to delete workout draft:", error);
  }
}

/**
 * Clean up old drafts (older than 30 days)
 * Call periodically to prevent database bloat
 */
export async function cleanupOldDrafts(userId: string): Promise<number> {
  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const result = await sqliteDb.runAsync(
      "DELETE FROM workout_drafts WHERE userId = ? AND lastSavedAt < ?",
      [userId, thirtyDaysAgo],
    );

    const deletedCount = result.changes || 0;
    if (deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount} old workout drafts`);
    }

    return deletedCount;
  } catch (error) {
    console.error("Failed to cleanup old drafts:", error);
    return 0;
  }
}

/**
 * Check if there's a draft that can be recovered
 * Used on app start to offer recovery option
 */
export async function hasRecoverableDraft(userId: string): Promise<boolean> {
  try {
    const result = await sqliteDb.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM workout_drafts WHERE userId = ?",
      [userId],
    );

    return (result?.count || 0) > 0;
  } catch (error) {
    console.error("Failed to check for drafts:", error);
    return false;
  }
}

/**
 * Get the most recent draft (if any)
 * Used for recovery suggestions
 */
export async function getLatestDraft(
  userId: string,
): Promise<WorkoutDraft | null> {
  try {
    const result = await sqliteDb.getFirstAsync<{
      id: string;
      userId: string;
      date: string | null;
      exercise: string | null;
      category: string | null;
      notes: string | null;
      sets: string;
      lastSavedAt: number;
      createdAt: number;
    }>(
      "SELECT * FROM workout_drafts WHERE userId = ? ORDER BY lastSavedAt DESC LIMIT 1",
      [userId],
    );

    if (!result) return null;

    return {
      ...result,
      date: result.date || undefined,
      exercise: result.exercise || undefined,
      category: result.category || undefined,
      notes: result.notes || undefined,
      sets: JSON.parse(result.sets || "[]"),
    };
  } catch (error) {
    console.error("Failed to get latest draft:", error);
    return null;
  }
}

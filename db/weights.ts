import { sqliteDb } from "./sqlite";

/* =========================
   TYPES
   ========================= */

export type BodyWeight = {
  id: string;
  userId: string;
  date: string; // Actual date user logged (YYYY-MM-DD)
  weekStart?: string; // Week start for grouping (YYYY-MM-DD)
  weight: number;
  createdAt: number;
  isSynced?: number; // 0 or 1
  syncError?: string | null;
  isDeleted?: number; // 0 or 1 (soft delete)
};

/* =========================
   INSERT / UPDATE
   ========================= */

export async function insertWeight(weight: BodyWeight) {
  await sqliteDb.runAsync(
    `INSERT OR REPLACE INTO body_weight 
     (id, userId, date, weekStart, weight, createdAt, isSynced, isDeleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      weight.id,
      weight.userId,
      weight.date,
      weight.weekStart ?? null, // Optional week grouping
      weight.weight,
      weight.createdAt,
      weight.isSynced ?? 0, // Not synced by default
      0, // Not deleted
    ],
  );
}

/* =========================
   MARK AS SYNCED / UPDATE SYNC STATUS
   ========================= */

export async function markWeightSynced(id: string) {
  await sqliteDb.runAsync(
    `UPDATE body_weight SET isSynced = 1, syncError = NULL WHERE id = ?`,
    [id],
  );
}

export async function markWeightSyncError(id: string, error: string) {
  await sqliteDb.runAsync(`UPDATE body_weight SET syncError = ? WHERE id = ?`, [
    error,
    id,
  ]);
}

/* =========================
   SOFT DELETE (for sync tracking)
   ========================= */

export async function softDeleteWeight(id: string) {
  await sqliteDb.runAsync(
    `UPDATE body_weight SET isDeleted = 1, isSynced = 0 WHERE id = ?`,
    [id],
  );
}

/* =========================
   READ ALL (PER USER)
   ========================= */

export async function getAllWeights(userId: string): Promise<BodyWeight[]> {
  return sqliteDb.getAllAsync<BodyWeight>(
    `SELECT *
     FROM body_weight
     WHERE userId = ? AND isDeleted = 0
     ORDER BY date DESC`,
    [userId],
  );
}

/* =========================
   GET UNSYNCED WEIGHTS (for batch sync)
   ========================= */

export async function getUnsyncedWeights(
  userId: string,
): Promise<BodyWeight[]> {
  return sqliteDb.getAllAsync<BodyWeight>(
    `SELECT *
     FROM body_weight
     WHERE userId = ? AND (isSynced = 0 OR isDeleted = 1)
     ORDER BY createdAt ASC`,
    [userId],
  );
}

/* =========================
   DELETE
   ========================= */

export async function deleteWeightById(id: string) {
  await sqliteDb.runAsync(`DELETE FROM body_weight WHERE id = ?`, [id]);
}

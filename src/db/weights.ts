import { sqliteDb } from "./sqlite";

/* =========================
   TYPES
   ========================= */

export type BodyWeight = {
  id: string;          // weekStart YYYY-MM-DD
  userId: string;
  date: string;        // weekStart YYYY-MM-DD
  weight: number;
  createdAt: number;
};

/* =========================
   INSERT / UPDATE
   ========================= */

export async function insertWeight(weight: BodyWeight) {
  await sqliteDb.runAsync(
    `INSERT OR REPLACE INTO body_weight 
     (id, userId, date, weight, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [
      weight.id,
      weight.userId,
      weight.date,
      weight.weight,
      weight.createdAt,
    ]
  );
}

/* =========================
   READ ALL (PER USER)
   ========================= */

export async function getAllWeights(
  userId: string
): Promise<BodyWeight[]> {
  return sqliteDb.getAllAsync<BodyWeight>(
    `SELECT *
     FROM body_weight
     WHERE userId = ?
     ORDER BY date DESC`,
    [userId]
  );
}

/* =========================
   DELETE
   ========================= */

export async function deleteWeightById(id: string) {
  await sqliteDb.runAsync(
    `DELETE FROM body_weight WHERE id = ?`,
    [id]
  );
}

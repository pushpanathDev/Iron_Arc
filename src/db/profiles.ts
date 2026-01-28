import { sqliteDb } from "./sqlite";

/* ==============================
   TYPES
   ============================== */

export type UserProfile = {
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  height: number | null;
  createdAt: number;
  updatedAt: number;
};

/* ==============================
   CREATE OR UPDATE PROFILE
   ============================== */

/**
 * Create a new user profile on first login
 * If profile exists, this is a no-op
 */
export async function createUserProfile(
  userId: string,
  email: string,
): Promise<void> {
  const now = Date.now();

  await sqliteDb.runAsync(
    `INSERT OR IGNORE INTO user_profiles 
     (userId, email, createdAt, updatedAt)
     VALUES (?, ?, ?, ?)`,
    [userId, email, now, now],
  );
}

/**
 * Get user profile (from SQLite, not Firebase)
 * Returns null if no profile exists
 */
export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const profile = await sqliteDb.getFirstAsync<UserProfile>(
    `SELECT * FROM user_profiles WHERE userId = ?`,
    [userId],
  );

  return profile || null;
}

/**
 * Update user profile fields
 * Only updates specified fields (partial update)
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, "userId" | "createdAt">>,
): Promise<void> {
  const now = Date.now();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.displayName !== undefined) {
    fields.push("displayName = ?");
    values.push(updates.displayName);
  }

  if (updates.avatarUrl !== undefined) {
    fields.push("avatarUrl = ?");
    values.push(updates.avatarUrl);
  }

  if (updates.height !== undefined) {
    fields.push("height = ?");
    values.push(updates.height);
  }

  // Always update the updatedAt timestamp
  fields.push("updatedAt = ?");
  values.push(now);

  if (fields.length === 1) {
    // Only updatedAt would be set, skip the query
    return;
  }

  values.push(userId);

  const sql = `UPDATE user_profiles SET ${fields.join(", ")} WHERE userId = ?`;
  await sqliteDb.runAsync(sql, values);
}

/**
 * Get all user profiles (for debugging/admin)
 */
export async function getAllProfiles(): Promise<UserProfile[]> {
  const profiles = await sqliteDb.getAllAsync<UserProfile>(
    `SELECT * FROM user_profiles ORDER BY createdAt DESC`,
  );

  return profiles;
}

/**
 * Delete user profile on logout
 * Soft delete: keep the record but clear sensitive data
 */
export async function clearUserProfile(userId: string): Promise<void> {
  // Soft delete: clear display name but keep email and timestamps
  // This preserves the account history but makes it inactive
  await sqliteDb.runAsync(
    `UPDATE user_profiles 
     SET displayName = NULL, avatarUrl = NULL
     WHERE userId = ?`,
    [userId],
  );
}

/**
 * Hard delete profile (use only when explicitly deleting account)
 */
export async function deleteUserProfile(userId: string): Promise<void> {
  await sqliteDb.runAsync(`DELETE FROM user_profiles WHERE userId = ?`, [
    userId,
  ]);
}

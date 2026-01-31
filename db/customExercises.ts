import { sqliteDb } from "./sqlite";
import { ExerciseCategory } from "../data/exercises";

/* ==============================
   TYPES
   ============================== */

export interface CustomExercise {
  id: string;
  userId: string;
  category: ExerciseCategory;
  name: string;
  createdAt: number;
}

/* ==============================
   CRUD OPERATIONS
   ============================== */

/**
 * Add a custom exercise for a user
 */
export async function addCustomExercise(
  userId: string,
  category: ExerciseCategory,
  name: string
): Promise<CustomExercise> {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const createdAt = Date.now();
  
  // Trim and normalize the name
  const normalizedName = name.trim();
  
  if (!normalizedName) {
    throw new Error("Exercise name cannot be empty");
  }
  
  await sqliteDb.runAsync(
    `INSERT INTO custom_exercises (id, userId, category, name, createdAt) 
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, category, normalizedName, createdAt]
  );
  
  return {
    id,
    userId,
    category,
    name: normalizedName,
    createdAt,
  };
}

/**
 * Get all custom exercises for a user in a specific category
 */
export async function getCustomExercises(
  userId: string,
  category: ExerciseCategory
): Promise<string[]> {
  const results = await sqliteDb.getAllAsync<{ name: string }>(
    `SELECT name FROM custom_exercises 
     WHERE userId = ? AND category = ? 
     ORDER BY createdAt DESC`,
    [userId, category]
  );
  
  return results.map((r) => r.name);
}

/**
 * Get all custom exercises for a user (all categories)
 */
export async function getAllCustomExercises(
  userId: string
): Promise<CustomExercise[]> {
  return await sqliteDb.getAllAsync<CustomExercise>(
    `SELECT * FROM custom_exercises 
     WHERE userId = ? 
     ORDER BY category, name`,
    [userId]
  );
}

/**
 * Delete a custom exercise
 */
export async function deleteCustomExercise(
  userId: string,
  category: ExerciseCategory,
  name: string
): Promise<void> {
  await sqliteDb.runAsync(
    `DELETE FROM custom_exercises 
     WHERE userId = ? AND category = ? AND name = ?`,
    [userId, category, name]
  );
}

/**
 * Check if a custom exercise exists
 */
export async function customExerciseExists(
  userId: string,
  category: ExerciseCategory,
  name: string
): Promise<boolean> {
  const result = await sqliteDb.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM custom_exercises 
     WHERE userId = ? AND category = ? AND LOWER(name) = LOWER(?)`,
    [userId, category, name.trim()]
  );
  
  return (result?.count ?? 0) > 0;
}

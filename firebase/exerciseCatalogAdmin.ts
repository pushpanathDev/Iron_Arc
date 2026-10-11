/**
 * Admin Exercise Catalog Module
 * Manages exercise catalog additions and removals
 * 
 * This module allows admins to:
 * - Add new exercises to categories
 * - Remove exercises from categories
 * - Manage bulk changes to the exercise catalog
 */

import { ExerciseCategory } from "../data/exercises";

export interface AdminExerciseCatalog {
  categories: Record<ExerciseCategory, string[]>;
  removed: Record<ExerciseCategory, string[]>;
  lastUpdated?: number;
  updatedBy?: string;
}

/**
 * Get the current admin exercise catalog
 * Includes both custom additions and removed exercises
 */
export async function getExerciseCatalogAdmin(): Promise<AdminExerciseCatalog> {
  try {
    // TODO: Fetch from Firestore
    // For now, return empty catalog structure
    return {
      categories: {
        "Chest": [],
        "Shoulders": [],
        "Back": [],
        "Legs": [],
        "Arms": [],
        "Abs": [],
        "Cardio": [],
        "Full Body": [],
      },
      removed: {
        "Chest": [],
        "Shoulders": [],
        "Back": [],
        "Legs": [],
        "Arms": [],
        "Abs": [],
        "Cardio": [],
        "Full Body": [],
      },
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error("Failed to load exercise catalog:", error);
    // Return empty structure on error
    return {
      categories: {
        "Chest": [],
        "Shoulders": [],
        "Back": [],
        "Legs": [],
        "Arms": [],
        "Abs": [],
        "Cardio": [],
        "Full Body": [],
      },
      removed: {
        "Chest": [],
        "Shoulders": [],
        "Back": [],
        "Legs": [],
        "Arms": [],
        "Abs": [],
        "Cardio": [],
        "Full Body": [],
      },
    };
  }
}

/**
 * Save changes to the admin exercise catalog
 * @param catalog The updated catalog to save
 */
export async function saveExerciseCatalogAdmin(
  catalog: AdminExerciseCatalog
): Promise<void> {
  try {
    // TODO: Save to Firestore
    console.log("Catalog saved:", catalog);
    
    // For now, just log the action
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Exercise catalog updated`);
  } catch (error) {
    console.error("Failed to save exercise catalog:", error);
    throw new Error("Failed to save exercise catalog. Please try again.");
  }
}

/**
 * Add a custom exercise to a category
 */
export async function addCustomExercise(
  category: ExerciseCategory,
  exercise: string,
  catalog: AdminExerciseCatalog
): Promise<AdminExerciseCatalog> {
  const updated = { ...catalog };
  if (!updated.categories[category]) {
    updated.categories[category] = [];
  }

  // Avoid duplicates
  if (!updated.categories[category].includes(exercise)) {
    updated.categories[category].push(exercise);
  }

  return updated;
}

/**
 * Remove an exercise from a category
 */
export async function removeExercise(
  category: ExerciseCategory,
  exercise: string,
  catalog: AdminExerciseCatalog
): Promise<AdminExerciseCatalog> {
  const updated = { ...catalog };

  // Add to removed list if not already there
  if (!updated.removed[category]) {
    updated.removed[category] = [];
  }
  if (!updated.removed[category].includes(exercise)) {
    updated.removed[category].push(exercise);
  }

  // Remove from additions if it exists there
  if (updated.categories[category]) {
    updated.categories[category] = updated.categories[category].filter(
      (e) => e !== exercise
    );
  }

  return updated;
}

/**
 * Bulk update catalog from JSON
 */
export async function bulkUpdateCatalog(
  jsonData: string,
  replace: boolean,
  currentCatalog: AdminExerciseCatalog
): Promise<AdminExerciseCatalog> {
  try {
    const data = JSON.parse(jsonData);

    if (replace) {
      // Replace entire catalog
      return data as AdminExerciseCatalog;
    } else {
      // Merge with existing
      const updated = { ...currentCatalog };
      if (data.categories) {
        Object.keys(data.categories).forEach((key) => {
          const category = key as ExerciseCategory;
          if (updated.categories[category]) {
            updated.categories[category] = [
              ...new Set([
                ...updated.categories[category],
                ...data.categories[category],
              ]),
            ];
          }
        });
      }
      return updated;
    }
  } catch (error) {
    throw new Error("Invalid JSON format");
  }
}

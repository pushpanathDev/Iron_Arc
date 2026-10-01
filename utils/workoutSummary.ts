/**
 * Workout Summary Utilities
 * ========================
 * Provides functions for grouping workouts, calculating metrics, and generating insights
 */

import { Workout } from "../services/api";

export interface ExerciseSummary {
  exerciseName: string;
  category: string;
  totalSets: number;
  setDetails: Array<{
    setNumber: number;
    reps: number;
    weight: number;
  }>;
  totalVolume: number;
  maxWeight: number;
  avgWeight: number;
  totalReps: number;
}

export interface SessionGroup {
  sessionId: string;
  exercises: ExerciseSummary[];
  totalSets: number;
  totalVolume: number;
}

export interface DaySummary {
  totalWorkouts: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  totalExercises: number;
  categories: string[];
  insights: WorkoutInsight[];
}

export interface WorkoutSessionSummary {
  sessionId: string; // Unique identifier for the session
  exercises: ExerciseSummary[];
  totalVolume: number;
  totalSets: number;
  totalExercises: number;
  startTime?: number;
  categories: string[];
}

export interface DaySummaryMetrics {
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  totalExercises: number;
  categories: string[];
  sessions: WorkoutSessionSummary[];
  insights: WorkoutInsight[];
}

export interface WorkoutInsight {
  type?: "pr" | "volume" | "milestone" | "consistency" | "new-exercise";
  message: string;
  icon: string;
  highlight?: boolean;
}

/**
 * Group workouts by exercise to create exercise summaries
 */
function groupByExercise(workouts: Workout[]): Map<string, Workout[]> {
  const grouped = new Map<string, Workout[]>();

  workouts.forEach((workout) => {
    const key = workout.exercise || "Unknown";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    const group = grouped.get(key);
    if (group) {
      group.push(workout);
    }
  });

  return grouped;
}

/**
 * Create exercise summary from grouped workouts
 */
function createExerciseSummary(
  exerciseName: string,
  workoutGroup: Workout[]
): ExerciseSummary {
  let totalVolume = 0;
  let totalReps = 0;
  let totalSets = 0;
  let maxWeight = 0;
  let sumWeight = 0;
  const setDetails: Array<{ setNumber: number; reps: number; weight: number }> =
    [];

  workoutGroup.forEach((workout) => {
    workout.sets?.forEach((set, setIdx) => {
      setDetails.push({
        setNumber: totalSets + setIdx + 1,
        reps: set.reps,
        weight: set.weight,
      });

      totalReps += set.reps;
      totalVolume += set.reps * set.weight;
      maxWeight = Math.max(maxWeight, set.weight);
      sumWeight += set.weight;
    });

    totalSets += workout.sets?.length || 0;
  });

  const avgWeight = totalSets > 0 ? Math.round(sumWeight / totalSets) : 0;

  return {
    exerciseName,
    category: workoutGroup[0].category || "Other",
    totalSets,
    setDetails,
    totalVolume,
    maxWeight,
    avgWeight,
    totalReps,
  };
}

/**
 * Group workouts into sessions (currently by category, can be enhanced for time-based grouping)
 */
export function groupWorkoutsBySession(workouts: Workout[]): SessionGroup[] {
  if (workouts.length === 0) return [];

  // Group by category for now (could be enhanced with time-based grouping)
  const categoryGrouped = new Map<string, Workout[]>();

  workouts.forEach((workout) => {
    const category = workout.category || "Other";
    if (!categoryGrouped.has(category)) {
      categoryGrouped.set(category, []);
    }
    const group = categoryGrouped.get(category);
    if (group) {
      group.push(workout);
    }
  });

  const sessions: SessionGroup[] = [];

  categoryGrouped.forEach((workoutsInCategory, category) => {
    const exerciseGrouped = groupByExercise(workoutsInCategory);
    const exercises: ExerciseSummary[] = [];
    let sessionVolume = 0;
    let sessionSets = 0;

    exerciseGrouped.forEach((workoutGroup, exerciseName) => {
      const summary = createExerciseSummary(exerciseName, workoutGroup);
      exercises.push(summary);
      sessionVolume += summary.totalVolume;
      sessionSets += summary.totalSets;
    });

    sessions.push({
      sessionId: category,
      exercises,
      totalVolume: sessionVolume,
      totalSets: sessionSets,
    });
  });

  return sessions;
}

/**
 * Calculate metrics for a day's workouts
 */
export function calculateDaySummary(workouts: Workout[]): DaySummary {
  if (workouts.length === 0) {
    return {
      totalWorkouts: 0,
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      totalExercises: 0,
      categories: [],
      insights: [],
    };
  }

  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  const categoriesSet = new Set<string>();

  workouts.forEach((workout) => {
    totalSets += workout.sets?.length || 0;
    workout.sets?.forEach((set) => {
      totalVolume += set.reps * set.weight;
      totalReps += set.reps;
    });
    if (workout.category) {
      categoriesSet.add(workout.category);
    }
  });

  const categories = Array.from(categoriesSet);
  const insights = generateInsights(workouts, totalVolume, totalSets);

  return {
    totalWorkouts: workouts.length,
    totalSets,
    totalReps,
    totalVolume,
    totalExercises: workouts.length,
    categories,
    insights,
  };
}

/**
 * Generate workout insights
 */
function generateInsights(
  workouts: Workout[],
  totalVolume: number,
  totalSets: number
): WorkoutInsight[] {
  const insights: WorkoutInsight[] = [];

  // Volume insight
  if (totalVolume > 10000) {
    insights.push({
      type: "volume",
      message: "Massive volume day! 💪",
      icon: "trending-up",
      highlight: true,
    });
  } else if (totalVolume > 5000) {
    insights.push({
      type: "volume",
      message: "Great volume!",
      icon: "trending-up",
    });
  }

  // Set milestone
  if (totalSets >= 20) {
    insights.push({
      type: "milestone",
      message: "20+ sets completed! 🔥",
      icon: "flame",
      highlight: true,
    });
  }

  // Exercise variety
  const uniqueExercises = new Set(workouts.map((w) => w.exercise)).size;
  if (uniqueExercises >= 5) {
    insights.push({
      type: "new-exercise",
      message: `${uniqueExercises} different exercises`,
      icon: "list",
    });
  }

  // Check for new exercises (exercises that appear only once in current day)
  const exerciseCount = new Map<string, number>();
  workouts.forEach((w) => {
    exerciseCount.set(w.exercise, (exerciseCount.get(w.exercise) || 0) + 1);
  });

  const newExercises = Array.from(exerciseCount.entries())
    .filter(([_, count]) => count === 1)
    .map(([name, _]) => name);

  if (newExercises.length > 0 && newExercises.length <= 2) {
    insights.push({
      type: "new-exercise",
      message: `Trying "${newExercises[0]}" for the first time today`,
      icon: "sparkles",
    });
  }

  return insights.slice(0, 3); // Limit to 3 insights
}

/**
 * Format set details for display (e.g., "5×10kg, 4×12kg")
 */
export function formatSetDetails(setDetails: Array<{ setNumber?: number; reps: number; weight: number }>): string {
  if (setDetails.length === 0) return "No sets";
  
  // Show first 3 sets and indicate if there are more
  const displaySets = setDetails.slice(0, 3);
  const remaining = setDetails.length > 3 ? setDetails.length - 3 : 0;
  
  const formatted = displaySets
    .map((set) => `${set.reps}×${set.weight}`)
    .join(", ");
  
  if (remaining > 0) {
    return `${formatted} +${remaining}`;
  }
  
  return formatted;
}

/**
 * Get progress color based on volume
 */
export function getVolumeColor(volume: number): string {
  if (volume > 10000) return "#4CAF50"; // Green
  if (volume > 5000) return "#2196F3"; // Blue
  if (volume > 1000) return "#FF9800"; // Orange
  return "#9E9E9E"; // Gray
}

/**
 * Format volume for display (e.g., "15.2k" for 15200)
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toString();
}

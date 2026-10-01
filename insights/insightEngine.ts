import { Workout, WorkoutSet, BodyWeight } from "../services/api";

/* =========================
   TYPES
   ========================= */

export type InsightType =
  | "streak"
  | "pr"
  | "volume"
  | "consistency"
  | "category"
  | "weight"
  | "motivation"
  | "milestone";

export type InsightPriority = "high" | "medium" | "low";

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  message: string;
  icon: string; // Ionicons name
  priority: InsightPriority;
  data?: Record<string, any>;
  createdAt: number;
}

export interface PRRecord {
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  volume: number; // weight * reps
}

/* =========================
   INSIGHT GENERATION ENGINE
   ========================= */

export function generateInsights(
  workouts: Workout[],
  weights: BodyWeight[],
  goalWeight?: number
): Insight[] {
  const insights: Insight[] = [];
  const now = Date.now();

  // Sort workouts by date (newest first)
  const sortedWorkouts = [...workouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Sort weights by date (newest first)
  const sortedWeights = [...weights].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 1. Streak Insights
  const streakInsights = generateStreakInsights(sortedWorkouts, now);
  insights.push(...streakInsights);

  // 2. PR (Personal Record) Insights
  const prInsights = generatePRInsights(sortedWorkouts, now);
  insights.push(...prInsights);

  // 3. Volume Milestones
  const volumeInsights = generateVolumeInsights(sortedWorkouts, now);
  insights.push(...volumeInsights);

  // 4. Category Analysis
  const categoryInsights = generateCategoryInsights(sortedWorkouts, now);
  insights.push(...categoryInsights);

  // 5. Weight Progress Insights
  const weightInsights = generateWeightInsights(sortedWeights, goalWeight, now);
  insights.push(...weightInsights);

  // 6. Consistency Insights
  const consistencyInsights = generateConsistencyInsights(sortedWorkouts, now);
  insights.push(...consistencyInsights);

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/* =========================
   STREAK INSIGHTS
   ========================= */

function generateStreakInsights(workouts: Workout[], now: number): Insight[] {
  const insights: Insight[] = [];
  const streak = calculateStreak(workouts);

  // Milestone streaks
  const milestones = [3, 7, 14, 21, 30, 60, 100, 365];
  
  for (const milestone of milestones) {
    if (streak === milestone) {
      insights.push({
        id: `streak-${milestone}-${now}`,
        type: "streak",
        title: getStreakMilestoneTitle(milestone),
        message: getStreakMilestoneMessage(milestone),
        icon: milestone >= 30 ? "trophy" : "flame",
        priority: milestone >= 30 ? "high" : "medium",
        data: { streak: milestone },
        createdAt: now,
      });
      break;
    }
  }

  // General streak status
  if (streak > 0 && !milestones.includes(streak)) {
    if (streak >= 7) {
      insights.push({
        id: `streak-active-${now}`,
        type: "streak",
        title: `${streak} Day Streak! 🔥`,
        message: `You're on fire! Keep it going to reach ${getNextMilestone(streak)} days.`,
        icon: "flame",
        priority: "medium",
        data: { streak },
        createdAt: now,
      });
    }
  }

  // Streak at risk (no workout today and had streak yesterday)
  if (streak > 2 && !hasWorkedOutToday(workouts)) {
    insights.push({
      id: `streak-risk-${now}`,
      type: "streak",
      title: "Don't Break Your Streak!",
      message: `You have a ${streak} day streak. Log a workout today to keep it alive!`,
      icon: "warning",
      priority: "high",
      data: { streak },
      createdAt: now,
    });
  }

  return insights;
}

function getStreakMilestoneTitle(days: number): string {
  const titles: Record<number, string> = {
    3: "3 Day Streak! 🎯",
    7: "Week Warrior! 🔥",
    14: "Two Weeks Strong! 💪",
    21: "21 Days - Habit Formed! 🧠",
    30: "Month Master! 🏅",
    60: "60 Day Champion! 🏆",
    100: "Century Club! 💯",
    365: "LEGENDARY! 👑",
  };
  return titles[days] || `${days} Day Streak!`;
}

function getStreakMilestoneMessage(days: number): string {
  const messages: Record<number, string> = {
    3: "Great start! Consistency is the key to results.",
    7: "A full week of training! You're building a habit.",
    14: "Two weeks in! Your body is adapting and getting stronger.",
    21: "They say 21 days makes a habit. You've made it!",
    30: "A whole month of dedication. You're truly committed!",
    60: "Two months strong! Your discipline is inspiring.",
    100: "100 days! You're in the elite club now.",
    365: "A FULL YEAR! You are an absolute legend!",
  };
  return messages[days] || "Keep pushing forward!";
}

function getNextMilestone(current: number): number {
  const milestones = [3, 7, 14, 21, 30, 60, 100, 365];
  return milestones.find((m) => m > current) || current + 10;
}

/* =========================
   PR (PERSONAL RECORD) INSIGHTS
   ========================= */

function generatePRInsights(workouts: Workout[], now: number): Insight[] {
  const insights: Insight[] = [];
  
  // Get PRs by exercise (highest weight for any rep count)
  const prMap = new Map<string, PRRecord>();
  
  for (const workout of workouts) {
    for (const set of workout.sets) {
      const key = workout.exercise;
      const existing = prMap.get(key);
      
      if (!existing || set.weight > existing.weight) {
        prMap.set(key, {
          exercise: workout.exercise,
          weight: set.weight,
          reps: set.reps,
          date: workout.date,
          volume: set.weight * set.reps,
        });
      }
    }
  }

  // Check if any PR was set today
  const today = new Date().toISOString().split("T")[0];
  const todaysWorkouts = workouts.filter((w) => w.date === today);
  
  for (const workout of todaysWorkouts) {
    for (const set of workout.sets) {
      const pr = prMap.get(workout.exercise);
      if (pr && set.weight === pr.weight && workout.date === today) {
        // This is a new PR!
        insights.push({
          id: `pr-${workout.exercise}-${now}`,
          type: "pr",
          title: `New PR! 🏆`,
          message: `${workout.exercise}: ${set.weight}kg × ${set.reps} reps!`,
          icon: "trophy",
          priority: "high",
          data: { exercise: workout.exercise, weight: set.weight, reps: set.reps },
          createdAt: now,
        });
        break; // Only one PR per exercise
      }
    }
  }

  return insights;
}

/* =========================
   VOLUME INSIGHTS
   ========================= */

function generateVolumeInsights(workouts: Workout[], now: number): Insight[] {
  const insights: Insight[] = [];

  // Calculate total volume
  const totalVolume = workouts.reduce((sum, w) => {
    return sum + w.sets.reduce((s, set) => s + set.weight * set.reps, 0);
  }, 0);

  // Volume milestones
  const volumeMilestones = [
    { threshold: 1000, title: "1 Tonne Club! 🏋️", message: "You've lifted 1,000kg total!" },
    { threshold: 10000, title: "10 Tonne Titan! 💪", message: "10,000kg of total volume!" },
    { threshold: 50000, title: "50 Tonne Beast! 🦁", message: "50,000kg lifted! Incredible!" },
    { threshold: 100000, title: "100 Tonne Legend! 👑", message: "100,000kg! You're a legend!" },
    { threshold: 500000, title: "Half Million Club! 🌟", message: "500,000kg total volume!" },
    { threshold: 1000000, title: "MILLIONAIRE! 💎", message: "1,000,000kg! Absolutely insane!" },
  ];

  for (const milestone of volumeMilestones) {
    const prevVolume = totalVolume - getTodaysVolume(workouts);
    if (prevVolume < milestone.threshold && totalVolume >= milestone.threshold) {
      insights.push({
        id: `volume-${milestone.threshold}-${now}`,
        type: "volume",
        title: milestone.title,
        message: milestone.message,
        icon: "barbell",
        priority: "high",
        data: { totalVolume, milestone: milestone.threshold },
        createdAt: now,
      });
      break;
    }
  }

  // Weekly volume comparison
  const thisWeekVolume = getWeekVolume(workouts, 0);
  const lastWeekVolume = getWeekVolume(workouts, 1);

  if (lastWeekVolume > 0 && thisWeekVolume > lastWeekVolume * 1.2) {
    insights.push({
      id: `volume-increase-${now}`,
      type: "volume",
      title: "Volume Up! 📈",
      message: `This week's volume is ${Math.round((thisWeekVolume / lastWeekVolume - 1) * 100)}% higher than last week!`,
      icon: "trending-up",
      priority: "medium",
      data: { thisWeek: thisWeekVolume, lastWeek: lastWeekVolume },
      createdAt: now,
    });
  }

  return insights;
}

/* =========================
   CATEGORY INSIGHTS
   ========================= */

function generateCategoryInsights(workouts: Workout[], now: number): Insight[] {
  const insights: Insight[] = [];

  // Group by category and find last workout date
  const categoryLastWorkout = new Map<string, string>();
  
  for (const workout of workouts) {
    const cat = workout.category || "Other";
    if (!categoryLastWorkout.has(cat)) {
      categoryLastWorkout.set(cat, workout.date);
    }
  }

  // Check for neglected categories (7+ days)
  const today = new Date();
  const mainCategories = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];

  for (const [category, lastDate] of categoryLastWorkout) {
    if (!mainCategories.includes(category)) continue;
    
    const daysSince = Math.floor(
      (today.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince >= 14) {
      insights.push({
        id: `category-neglected-${category}-${now}`,
        type: "category",
        title: `${category} Needs Attention! ⚠️`,
        message: `It's been ${daysSince} days since your last ${category.toLowerCase()} workout.`,
        icon: "alert-circle",
        priority: "medium",
        data: { category, daysSince },
        createdAt: now,
      });
    } else if (daysSince >= 7) {
      insights.push({
        id: `category-reminder-${category}-${now}`,
        type: "category",
        title: `Time for ${category}?`,
        message: `Last ${category.toLowerCase()} workout was ${daysSince} days ago.`,
        icon: "fitness",
        priority: "low",
        data: { category, daysSince },
        createdAt: now,
      });
    }
  }

  // Check for missing main categories
  for (const cat of mainCategories) {
    if (!categoryLastWorkout.has(cat) && workouts.length >= 10) {
      insights.push({
        id: `category-missing-${cat}-${now}`,
        type: "category",
        title: `Add ${cat} to Your Routine?`,
        message: `No ${cat.toLowerCase()} workouts logged yet. Balance is key!`,
        icon: "add-circle",
        priority: "low",
        data: { category: cat },
        createdAt: now,
      });
    }
  }

  return insights;
}

/* =========================
   WEIGHT PROGRESS INSIGHTS
   ========================= */

function generateWeightInsights(
  weights: BodyWeight[],
  goalWeight: number | undefined,
  now: number
): Insight[] {
  const insights: Insight[] = [];

  if (weights.length < 2) return insights;

  const latest = weights[0];
  const oldest = weights[weights.length - 1];
  const totalChange = latest.weight - oldest.weight;

  // Weekly change
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoWeight = weights.find(
    (w) => new Date(w.date) <= weekAgo
  );

  if (weekAgoWeight) {
    const weekChange = latest.weight - weekAgoWeight.weight;
    
    if (Math.abs(weekChange) >= 0.5) {
      const direction = weekChange > 0 ? "gained" : "lost";
      const emoji = weekChange > 0 ? "📈" : "📉";
      
      insights.push({
        id: `weight-weekly-${now}`,
        type: "weight",
        title: `${Math.abs(weekChange).toFixed(1)}kg ${direction} this week ${emoji}`,
        message: weekChange > 0
          ? "Building mass! Make sure it's muscle, not just food 😉"
          : "Great progress! Stay consistent with your nutrition.",
        icon: weekChange > 0 ? "trending-up" : "trending-down",
        priority: "medium",
        data: { weekChange, currentWeight: latest.weight },
        createdAt: now,
      });
    }
  }

  // Goal progress
  if (goalWeight && goalWeight > 0) {
    const remaining = Math.abs(goalWeight - latest.weight);
    const isLosingGoal = goalWeight < oldest.weight;

    if (remaining <= 1) {
      insights.push({
        id: `weight-goal-close-${now}`,
        type: "weight",
        title: "Almost There! 🎯",
        message: `Only ${remaining.toFixed(1)}kg away from your goal weight!`,
        icon: "flag",
        priority: "high",
        data: { remaining, goalWeight, currentWeight: latest.weight },
        createdAt: now,
      });
    } else if (remaining <= 5) {
      insights.push({
        id: `weight-goal-progress-${now}`,
        type: "weight",
        title: "Goal in Sight! 👀",
        message: `${remaining.toFixed(1)}kg to go. You've got this!`,
        icon: "flag-outline",
        priority: "medium",
        data: { remaining, goalWeight, currentWeight: latest.weight },
        createdAt: now,
      });
    }

    // Check if goal reached
    if (
      (isLosingGoal && latest.weight <= goalWeight) ||
      (!isLosingGoal && latest.weight >= goalWeight)
    ) {
      insights.push({
        id: `weight-goal-reached-${now}`,
        type: "milestone",
        title: "GOAL REACHED! 🏆",
        message: `You did it! You've reached your goal of ${goalWeight}kg!`,
        icon: "trophy",
        priority: "high",
        data: { goalWeight, currentWeight: latest.weight },
        createdAt: now,
      });
    }
  }

  return insights;
}

/* =========================
   CONSISTENCY INSIGHTS
   ========================= */

function generateConsistencyInsights(workouts: Workout[], now: number): Insight[] {
  const insights: Insight[] = [];

  // Calculate workouts per week for last 4 weeks
  const weeklyWorkouts: number[] = [];
  for (let i = 0; i < 4; i++) {
    weeklyWorkouts.push(getWorkoutsInWeek(workouts, i));
  }

  const thisWeek = weeklyWorkouts[0];
  const average = weeklyWorkouts.slice(1).reduce((a, b) => a + b, 0) / 3;

  // Consistency badge (4+ workouts for 3+ weeks)
  const consistentWeeks = weeklyWorkouts.filter((w) => w >= 4).length;
  if (consistentWeeks >= 3) {
    insights.push({
      id: `consistency-badge-${now}`,
      type: "consistency",
      title: "Consistency King! 👑",
      message: `4+ workouts per week for ${consistentWeeks} consecutive weeks!`,
      icon: "ribbon",
      priority: "high",
      data: { consistentWeeks },
      createdAt: now,
    });
  }

  // Above/below average
  if (average > 0 && thisWeek > 0) {
    const diff = thisWeek - average;
    
    if (diff >= 2) {
      insights.push({
        id: `consistency-up-${now}`,
        type: "consistency",
        title: "Training More! 💪",
        message: `${thisWeek} workouts this week vs ${average.toFixed(1)} average. Beast mode!`,
        icon: "trending-up",
        priority: "medium",
        data: { thisWeek, average },
        createdAt: now,
      });
    } else if (diff <= -2) {
      insights.push({
        id: `consistency-down-${now}`,
        type: "consistency",
        title: "Slower Week?",
        message: `Only ${thisWeek} workouts this week. Rest or busy schedule?`,
        icon: "bed",
        priority: "low",
        data: { thisWeek, average },
        createdAt: now,
      });
    }
  }

  return insights;
}

/* =========================
   HELPER FUNCTIONS
   ========================= */

function calculateStreak(workouts: Workout[]): number {
  const uniqueDates = [...new Set(workouts.map((w) => w.date))].sort().reverse();
  
  if (uniqueDates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Streak must start from today or yesterday
  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 0;
  let checkDate = new Date(uniqueDates[0]);

  for (const dateStr of uniqueDates) {
    const currentDate = new Date(dateStr);
    const expectedStr = checkDate.toISOString().split("T")[0];

    if (dateStr === expectedStr) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function hasWorkedOutToday(workouts: Workout[]): boolean {
  const today = new Date().toISOString().split("T")[0];
  return workouts.some((w) => w.date === today);
}

function getTodaysVolume(workouts: Workout[]): number {
  const today = new Date().toISOString().split("T")[0];
  return workouts
    .filter((w) => w.date === today)
    .reduce((sum, w) => {
      return sum + w.sets.reduce((s, set) => s + set.weight * set.reps, 0);
    }, 0);
}

function getWeekVolume(workouts: Workout[], weeksAgo: number): number {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 7 * weeksAgo);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return workouts
    .filter((w) => {
      const d = new Date(w.date);
      return d >= weekStart && d < weekEnd;
    })
    .reduce((sum, w) => {
      return sum + w.sets.reduce((s, set) => s + set.weight * set.reps, 0);
    }, 0);
}

function getWorkoutsInWeek(workouts: Workout[], weeksAgo: number): number {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 7 * weeksAgo);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const dates = new Set(
    workouts
      .filter((w) => {
        const d = new Date(w.date);
        return d >= weekStart && d < weekEnd;
      })
      .map((w) => w.date)
  );

  return dates.size;
}

/* =========================
   MOTIVATIONAL QUOTES
   ========================= */

const motivationalQuotes = [
  { title: "Progress Over Perfection", message: "Every rep counts. Keep showing up!" },
  { title: "Discipline = Freedom", message: "The pain of discipline is less than the pain of regret." },
  { title: "You vs You", message: "The only competition that matters is with yourself." },
  { title: "Embrace the Grind", message: "Success is the sum of small efforts repeated daily." },
  { title: "No Shortcuts", message: "There are no shortcuts. Everything is reps, reps, reps." },
  { title: "Mind Over Matter", message: "Your body can handle it. Convince your mind." },
  { title: "Start Now", message: "A year from now you'll wish you had started today." },
  { title: "Consistency Wins", message: "It's not about being the best. It's about being consistent." },
];

export function getRandomMotivation(): Insight {
  const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
  return {
    id: `motivation-${Date.now()}`,
    type: "motivation",
    title: quote.title,
    message: quote.message,
    icon: "sparkles",
    priority: "low",
    createdAt: Date.now(),
  };
}

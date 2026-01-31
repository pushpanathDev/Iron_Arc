import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Achievement } from "../insights/achievements";
import { Insight } from "../insights/insightEngine";

/* =========================
   CONFIGURATION
   ========================= */

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/* =========================
   TYPES
   ========================= */

export type NotificationType =
  | "streak_reminder"
  | "achievement"
  | "insight"
  | "daily_reminder"
  | "weekly_summary"
  | "motivation";

export interface NotificationPreferences {
  enabled: boolean;
  dailyReminder: boolean;
  dailyReminderTime: string; // "HH:MM" format
  streakReminders: boolean;
  achievements: boolean;
  weeklySummary: boolean;
  motivationalQuotes: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  dailyReminder: true,
  dailyReminderTime: "09:00",
  streakReminders: true,
  achievements: true,
  weeklySummary: true,
  motivationalQuotes: true,
};

const PREFS_KEY = "@notification_preferences";
const DAILY_REMINDER_ID = "daily-workout-reminder";
const WEEKLY_SUMMARY_ID = "weekly-summary";

/* =========================
   PERMISSIONS
   ========================= */

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("❌ Notification permissions not granted");
    return false;
  }

  // Android: Create notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("workout-reminders", {
      name: "Workout Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
    });

    await Notifications.setNotificationChannelAsync("achievements", {
      name: "Achievements",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500],
      lightColor: "#FFD700",
    });

    await Notifications.setNotificationChannelAsync("insights", {
      name: "Insights & Tips",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  console.log("✅ Notification permissions granted");
  return true;
}

/* =========================
   PREFERENCES
   ========================= */

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(PREFS_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Error reading notification preferences:", e);
  }
  return DEFAULT_PREFERENCES;
}

export async function setNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<void> {
  try {
    const current = await getNotificationPreferences();
    const updated = { ...current, ...prefs };
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));

    // Reschedule notifications based on new preferences
    await scheduleRecurringNotifications(updated);
  } catch (e) {
    console.error("Error saving notification preferences:", e);
  }
}

/* =========================
   IMMEDIATE NOTIFICATIONS
   ========================= */

export async function sendAchievementNotification(
  achievement: Achievement,
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.enabled || !prefs.achievements) return;

  const tierEmoji: Record<string, string> = {
    bronze: "🥉",
    silver: "🥈",
    gold: "🥇",
    platinum: "💎",
    diamond: "👑",
  };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Achievement Unlocked! ${tierEmoji[achievement.tier] || "🏆"}`,
      body: `${achievement.title} - ${achievement.description}`,
      data: { type: "achievement", achievementId: achievement.id },
      sound: true,
    },
    trigger: null, // Send immediately
  });

  console.log(`🏆 Achievement notification sent: ${achievement.title}`);
}

export async function sendInsightNotification(insight: Insight): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.enabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: insight.title,
      body: insight.message,
      data: { type: "insight", insightId: insight.id },
      sound: insight.priority === "high",
    },
    trigger: null,
  });

  console.log(`💡 Insight notification sent: ${insight.title}`);
}

export async function sendStreakReminderNotification(
  currentStreak: number,
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.enabled || !prefs.streakReminders) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don't Break Your Streak! 🔥",
      body: `You have a ${currentStreak} day streak. Log a workout today to keep it alive!`,
      data: { type: "streak_reminder", streak: currentStreak },
      sound: true,
    },
    trigger: null,
  });

  console.log(`🔥 Streak reminder sent: ${currentStreak} day streak`);
}

export async function sendMotivationalNotification(): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.enabled || !prefs.motivationalQuotes) return;

  const quotes = [
    {
      title: "Let's Go! 💪",
      body: "Your future self will thank you for today's workout.",
    },
    {
      title: "Rise & Grind ☀️",
      body: "Every rep gets you closer to your goals.",
    },
    {
      title: "No Excuses 🔥",
      body: "The only bad workout is the one that didn't happen.",
    },
    {
      title: "Push Through 💯",
      body: "Pain is temporary. Results are permanent.",
    },
    {
      title: "You Got This! 🏆",
      body: "Champions are made when no one is watching.",
    },
  ];

  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: quote.title,
      body: quote.body,
      data: { type: "motivation" },
      sound: false,
    },
    trigger: null,
  });
}

/* =========================
   SCHEDULED NOTIFICATIONS
   ========================= */

export async function scheduleRecurringNotifications(
  prefs?: NotificationPreferences,
): Promise<void> {
  const preferences = prefs || (await getNotificationPreferences());

  // Cancel existing scheduled notifications
  await cancelAllScheduledNotifications();

  if (!preferences.enabled) return;

  // Daily reminder
  if (preferences.dailyReminder) {
    const [hours, minutes] = preferences.dailyReminderTime
      .split(":")
      .map(Number);

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: "Time to Train! 💪",
        body: "Ready for today's workout? Let's crush it!",
        data: { type: "daily_reminder" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });

    console.log(
      `⏰ Daily reminder scheduled at ${preferences.dailyReminderTime}`,
    );
  }

  // Weekly summary (Sunday 6 PM)
  if (preferences.weeklySummary) {
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_SUMMARY_ID,
      content: {
        title: "Weekly Progress 📊",
        body: "Check your stats and see how you performed this week!",
        data: { type: "weekly_summary" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday
        hour: 18,
        minute: 0,
      },
    });

    console.log("📊 Weekly summary scheduled for Sundays at 6 PM");
  }
}

/* =========================
   STREAK REMINDER SCHEDULER
   ========================= */

export async function scheduleStreakReminder(
  currentStreak: number,
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.enabled || !prefs.streakReminders || currentStreak < 3) return;

  // Schedule for 8 PM if no workout logged today
  const now = new Date();
  const triggerDate = new Date(now);
  triggerDate.setHours(20, 0, 0, 0); // 8 PM

  // If it's already past 8 PM, don't schedule
  if (now > triggerDate) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `streak-reminder-${now.toISOString().split("T")[0]}`,
    content: {
      title: `${currentStreak} Day Streak at Risk! 🔥`,
      body: "You haven't logged a workout today. Don't break your streak!",
      data: { type: "streak_reminder", streak: currentStreak },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  console.log(
    `⏰ Streak reminder scheduled for 8 PM (streak: ${currentStreak})`,
  );
}

export async function cancelStreakReminder(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await Notifications.cancelScheduledNotificationAsync(
    `streak-reminder-${today}`,
  );
  console.log("✅ Streak reminder cancelled (workout logged)");
}

/* =========================
   UTILITIES
   ========================= */

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log("🗑️ All scheduled notifications cancelled");
}

export async function getScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/* =========================
   NOTIFICATION LISTENERS
   ========================= */

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/* =========================
   INITIALIZATION
   ========================= */

export async function initNotifications(): Promise<boolean> {
  const granted = await requestNotificationPermissions();

  if (granted) {
    const prefs = await getNotificationPreferences();
    await scheduleRecurringNotifications(prefs);
  }

  return granted;
}

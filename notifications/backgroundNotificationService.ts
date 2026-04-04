/**
 * Background Notification Service
 * ================================
 * Handles notifications that work when app is closed using Notifee
 * Supports offline notifications, wake-up reminders, and streak warnings
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, {
  AndroidImportance,
  TriggerType,
} from "@notifee/react-native";
import { Platform } from "react-native";
import { Achievement } from "../insights/achievements";

/* =========================
   TYPES & CONSTANTS
   ========================= */

export interface BackgroundNotificationPreferences {
  wakeUpReminders: boolean;
  streakWarnings: boolean;
  dailyReminder: boolean;
  dailyReminderTime: string; // "HH:MM"
  weeklyReminder: boolean;
  weeklyReminderDay: number; // 0-6, 0=Sunday
  weeklyReminderTime: string;
  streakWarningThreshold: number; // Warn if streak >= N days
}

const DEFAULT_BG_PREFS: BackgroundNotificationPreferences = {
  wakeUpReminders: true,
  streakWarnings: true,
  dailyReminder: true,
  dailyReminderTime: "09:00",
  weeklyReminder: true,
  weeklyReminderDay: 0, // Sunday
  weeklyReminderTime: "18:00",
  streakWarningThreshold: 3,
};

const BG_PREFS_KEY = "@bg_notification_prefs";
const STREAK_WARNING_ID = "streak-warning-notification";
const DAILY_WAKEUP_ID = "daily-wakeup-notification";
const WEEKLY_SUMMARY_ID = "weekly-summary-notification";

/* =========================
   INITIALIZATION
   ========================= */

export async function initBackgroundNotifications(): Promise<void> {
  try {
    // Request notifications permission (Android 13+)
    if (Platform.OS === "android") {
      const permission = await notifee.requestPermission();
      console.log("📢 Notifee permission result:", permission);
    }

    // Create notification channels for Android
    if (Platform.OS === "android") {
      await notifee.createChannel({
        id: "workout-reminders",
        name: "Workout Reminders & Wake-up",
        importance: AndroidImportance.HIGH,
        sound: "default",
        vibration: true,
        lights: true,
      });

      await notifee.createChannel({
        id: "streak-warnings",
        name: "Streak Warnings",
        importance: AndroidImportance.HIGH,
        sound: "default",
        vibration: true,
      });

      await notifee.createChannel({
        id: "achievements",
        name: "Achievements",
        importance: AndroidImportance.HIGH,
        sound: "default",
      });

      await notifee.createChannel({
        id: "insights",
        name: "Insights & Tips",
        importance: AndroidImportance.DEFAULT,
      });
    }

    console.log("✅ Background notification service initialized");
  } catch (error) {
    console.error("Error initializing background notifications:", error);
  }
}

/* =========================
   PREFERENCES MANAGEMENT
   ========================= */

export async function getBackgroundNotificationPreferences(): Promise<BackgroundNotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(BG_PREFS_KEY);
    if (stored) {
      return { ...DEFAULT_BG_PREFS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Error reading BG notification preferences:", e);
  }
  return DEFAULT_BG_PREFS;
}

export async function setBackgroundNotificationPreferences(
  prefs: Partial<BackgroundNotificationPreferences>,
): Promise<void> {
  try {
    const current = await getBackgroundNotificationPreferences();
    const updated = { ...current, ...prefs };
    await AsyncStorage.setItem(BG_PREFS_KEY, JSON.stringify(updated));

    // Reschedule notifications with new preferences
    await scheduleBackgroundNotifications(updated);
  } catch (e) {
    console.error("Error saving BG notification preferences:", e);
  }
}

/* =========================
   WAKE-UP NOTIFICATIONS
   (Work when app is closed)
   ========================= */

/**
 * Schedule wake-up reminders that work even with app closed
 * These are true local notifications that persist on device
 */
export async function scheduleWakeUpReminder(
  time: string,
  message: string,
  notificationId: string,
): Promise<void> {
  try {
    const [hours, minutes] = time.split(":").map(Number);

    const now = new Date();
    const triggerDate = new Date(now);
    triggerDate.setHours(hours, minutes, 0);

    // If time has passed today, schedule for tomorrow
    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    await notifee.createTriggerNotification(
      {
        id: notificationId,
        title: "Time to Train! 💪",
        body: message,
        android: {
          channelId: "workout-reminders",
          importance: AndroidImportance.HIGH,
          fullScreenAction: {
            id: "default",
          },
          smallIcon: "ic_launcher", // Your app icon
        },
        ios: {
          critical: true,
          criticalVolume: 1.0,
          sound: "default",
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        alarmManager: true, // Use AlarmManager on Android (more reliable)
      },
    );

    console.log(`⏰ Wake-up reminder scheduled for ${time}`);
  } catch (error) {
    console.error("Error scheduling wake-up reminder:", error);
  }
}

/**
 * Schedule daily wake-up notification that repeats every day
 */
export async function scheduleDailyWakeUp(
  time: string = "00:00",
): Promise<void> {
  try {
    const [hours, minutes] = time.split(":").map(Number);

    // Calculate next occurrence
    const now = new Date();
    const triggerDate = new Date(now);
    triggerDate.setHours(hours, minutes, 0);

    // If time has passed today, schedule for tomorrow
    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    await notifee.createTriggerNotification(
      {
        id: DAILY_WAKEUP_ID,
        title: "Rise & Grind! ☀️",
        body: "Time for your workout. Let's crush today's goals!",
        android: {
          channelId: "workout-reminders",
          importance: AndroidImportance.HIGH,
          fullScreenAction: {
            id: "default",
          },
        },
        ios: {
          critical: true,
          sound: "default",
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        alarmManager: true,
      },
    );

    console.log(`☀️ Daily wake-up scheduled at ${time}`);
  } catch (error) {
    console.error("Error scheduling daily wake-up:", error);
  }
}

/* =========================
   STREAK WARNING NOTIFICATIONS
   (Critical - app closed safe)
   ========================= */

/**
 * Schedule streak warning notification for later today
 * Shows when user hasn't worked out yet
 */
export async function scheduleStreakWarning(
  currentStreak: number,
  warningTime: string = "20:00", // 8 PM default
): Promise<void> {
  const prefs = await getBackgroundNotificationPreferences();
  if (!prefs.streakWarnings || currentStreak < prefs.streakWarningThreshold)
    return;

  try {
    const [hours, minutes] = warningTime.split(":").map(Number);
    const now = new Date();
    const triggerDate = new Date(now);
    triggerDate.setHours(hours, minutes, 0);

    // If time has passed today, schedule for tomorrow instead
    // This ensures the warning is always sent
    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    await notifee.createTriggerNotification(
      {
        id: STREAK_WARNING_ID,
        title: `🔥 ${currentStreak} Day Streak at Risk!`,
        body: "Don't break your streak! Log a workout today.",
        android: {
          channelId: "streak-warnings",
          importance: AndroidImportance.HIGH,
          fullScreenAction: {
            id: "default",
          },
          color: "#FF4444",
          colorized: true,
        },
        ios: {
          critical: true,
          sound: "default",
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        alarmManager: true,
      },
    );

    console.log(`🔥 Streak warning scheduled at ${warningTime}`);
  } catch (error) {
    console.error("Error scheduling streak warning:", error);
  }
}

/* =========================
   ACHIEVEMENT NOTIFICATIONS
   (App closed safe)
   ========================= */

export async function notifyAchievementUnlocked(
  achievement: Achievement,
): Promise<void> {
  try {
    const tierEmoji: Record<string, string> = {
      bronze: "🥉",
      silver: "🥈",
      gold: "🥇",
      platinum: "💎",
      diamond: "👑",
    };

    await notifee.displayNotification({
      id: `achievement-${achievement.id}-${Date.now()}`,
      title: `${tierEmoji[achievement.tier]} Achievement Unlocked!`,
      body: `${achievement.title} - ${achievement.description}`,
      android: {
        channelId: "achievements",
        importance: AndroidImportance.HIGH,
      },
      ios: {
        sound: "default",
      },
    });

    console.log(`🏆 Achievement notification: ${achievement.title}`);
  } catch (error) {
    console.error("Error sending achievement notification:", error);
  }
}

/* =========================
   WEEKLY SUMMARY NOTIFICATIONS
   ========================= */

export async function scheduleWeeklySummary(
  dayOfWeek: number = 0, // 0 = Sunday
  time: string = "18:00",
): Promise<void> {
  try {
    const [hours, minutes] = time.split(":").map(Number);

    // Calculate next occurrence of specified day and time
    const now = new Date();
    const triggerDate = new Date(now);
    triggerDate.setHours(hours, minutes, 0);

    // Calculate days until target day of week
    const currentDay = triggerDate.getDay();
    const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
    const adjustedDays = daysUntilTarget === 0 && triggerDate <= now ? 7 : daysUntilTarget;

    triggerDate.setDate(triggerDate.getDate() + adjustedDays);

    await notifee.createTriggerNotification(
      {
        id: WEEKLY_SUMMARY_ID,
        title: "Weekly Progress 📊",
        body: "Check your stats and see how you performed this week!",
        android: {
          channelId: "insights",
          importance: AndroidImportance.DEFAULT,
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        alarmManager: true,
      },
    );

    console.log(`📊 Weekly summary scheduled for day ${dayOfWeek} at ${time}`);
  } catch (error) {
    console.error("Error scheduling weekly summary:", error);
  }
}

/* =========================
   SCHEDULED BACKGROUND NOTIFICATIONS
   ========================= */

export async function scheduleBackgroundNotifications(
  prefs?: BackgroundNotificationPreferences,
): Promise<void> {
  const preferences = prefs || (await getBackgroundNotificationPreferences());

  try {
    // Cancel all existing scheduled notifications
    const scheduled = await notifee.getTriggerNotifications();
    for (const notification of scheduled) {
      if (notification.notification.id) {
        await notifee.cancelNotification(notification.notification.id);
      }
    }

    // Daily wake-up
    if (preferences.dailyReminder) {
      await scheduleDailyWakeUp(preferences.dailyReminderTime);
    }

    // Weekly summary
    if (preferences.weeklyReminder) {
      await scheduleWeeklySummary(
        preferences.weeklyReminderDay,
        preferences.weeklyReminderTime,
      );
    }

    console.log("✅ Background notifications scheduled");
  } catch (error) {
    console.error("Error scheduling background notifications:", error);
  }
}

/* =========================
   URGENT NOTIFICATIONS
   (Bypass all checks, immediate)
   ========================= */

export async function sendUrgentNotification(
  title: string,
  body: string,
  channelId: string = "workout-reminders",
): Promise<void> {
  try {
    await notifee.displayNotification({
      id: `urgent-${Date.now()}`,
      title,
      body,
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        fullScreenAction: {
          id: "default",
        },
      },
      ios: {
        critical: true,
        sound: "default",
      },
    });

    console.log(`🚨 Urgent notification sent: ${title}`);
  } catch (error) {
    console.error("Error sending urgent notification:", error);
  }
}

/* =========================
   CANCEL NOTIFICATIONS
   ========================= */

export async function cancelStreakWarning(): Promise<void> {
  try {
    await notifee.cancelNotification(STREAK_WARNING_ID);
    console.log("❌ Streak warning cancelled");
  } catch (error) {
    console.error("Error canceling streak warning:", error);
  }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    const scheduled = await notifee.getTriggerNotifications();
    for (const notification of scheduled) {
      if (notification.notification.id) {
        await notifee.cancelNotification(notification.notification.id);
      }
    }
    console.log("❌ All scheduled notifications cancelled");
  } catch (error) {
    console.error("Error canceling notifications:", error);
  }
}

/* =========================
   FOREGROUND NOTIFICATION HANDLER
   ========================= */

export function setupForegroundNotificationHandler(): () => void {
  try {
    // Handle notifications when app is in foreground
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      console.log("Foreground notification event:", type, detail);

      // You can handle different notification actions here
      // For example: navigation to achievements screen, etc.
    });

    // Return unsubscribe function for cleanup
    return unsubscribe;
  } catch (error) {
    console.error("Error setting up foreground handler:", error);
    return () => {}; // Return no-op function on error
  }
}

/* =========================
   BACKGROUND EVENT HANDLER
   ========================= */

export function setupBackgroundEventHandler(): void {
  try {
    // This function should be called from the main app entry point
    // It handles notifications when app is closed or in background
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      console.log("📬 Background notification event:", type, detail);
      // Handle navigation, data updates, etc.
    });

    console.log("✅ Background notification handler set up");
  } catch (error) {
    console.error("Error setting up background handler:", error);
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";
import { Achievement } from "../insights/achievements";
import { Insight } from "../insights/insightEngine";

// Notifee is optional - only available in development builds, not Expo Go
let initBackgroundNotifications: (() => Promise<void>) | null = null;
let scheduleBackgroundNotifications: ((prefs: any) => Promise<void>) | null = null;
let scheduleStreakWarning: ((streak: number, time: string) => Promise<void>) | null = null;
let scheduleDailyWakeUp: ((time: string) => Promise<void>) | null = null;
let notifyAchievementUnlocked: ((achievement: Achievement) => Promise<void>) | null = null;
let getBackgroundNotificationPreferences: (() => Promise<any>) | null = null;
let cancelNotifeeStreakWarning: (() => Promise<void>) | null = null;
let cancelNotifeeScheduled: (() => Promise<void>) | null = null;

let notifeeAvailable = false;

// Try to load Notifee - will fail gracefully in Expo Go
try {
  const backgroundNotifs = require("./backgroundNotificationService");
  initBackgroundNotifications = backgroundNotifs.initBackgroundNotifications;
  scheduleBackgroundNotifications = backgroundNotifs.scheduleBackgroundNotifications;
  scheduleStreakWarning = backgroundNotifs.scheduleStreakWarning;
  scheduleDailyWakeUp = backgroundNotifs.scheduleDailyWakeUp;
  notifyAchievementUnlocked = backgroundNotifs.notifyAchievementUnlocked;
  getBackgroundNotificationPreferences = backgroundNotifs.getBackgroundNotificationPreferences;
  cancelNotifeeStreakWarning = backgroundNotifs.cancelStreakWarning;
  cancelNotifeeScheduled = backgroundNotifs.cancelAllScheduledNotifications;
  notifeeAvailable = true;
  console.log("✅ Notifee available (native module loaded)");
} catch (error) {
  console.warn(
    "⚠️ Notifee not available (requires development build).",
    "Background notifications disabled. Run 'eas build --platform android --profile preview' to enable.",
    error instanceof Error ? error.message : String(error)
  );
}

/* =========================
   CONFIGURATION
   ========================= */

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
  | "motivation"
  | "morning_motivation"
  | "evening_checkin"
  | "weekly_motivation";

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
const BATTERY_GUIDE_KEY = "@battery_optimization_prompted";
const DAILY_REMINDER_ID = "daily-workout-reminder";
const WEEKLY_SUMMARY_ID = "weekly-summary";
const MORNING_MOTIVATION_ID = "morning-motivation";
const EVENING_CHECKIN_ID = "evening-checkin";
const WEEKLY_MOTIVATION_ID = "weekly-motivation";
const TEST_NOTIFICATION_ID = "test-notification-10min";

const ANDROID_REMINDER_CHANNEL_ID = "workout-reminders";
const ANDROID_STREAK_CHANNEL_ID = "streak-warnings";
const ANDROID_ACHIEVEMENT_CHANNEL_ID = "achievements";
const ANDROID_INSIGHTS_CHANNEL_ID = "insights";

/* =========================
   INITIALIZATION
   ========================= */

export async function initNotifications(): Promise<void> {
  try {
    // Initialize Notifee if available (development builds only)
    if (notifeeAvailable && initBackgroundNotifications) {
      try {
        await initBackgroundNotifications();
        console.log("✅ Notifee initialized (background notifications enabled)");
      } catch (error) {
        console.warn("⚠️ Notifee initialization failed:", error);
        // Continue anyway - expo-notifications will handle foreground
      }
    } else {
      console.log("ℹ️ Notifee unavailable (Expo Go detected) - background notifications disabled");
    }
    
    // Request permissions for expo-notifications
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Reschedule on every launch to restore alarms after device reboot
    await scheduleRecurringNotifications();

    // Android OEMs often block exact alarms without user action
    await promptBatteryOptimizationDisableOnce();

    console.log("✅ Notification services initialized");
  } catch (error) {
    console.error("Error initializing notifications:", error);
  }
}

/* =========================
   PERMISSIONS
   ========================= */

export async function requestNotificationPermissions(): Promise<boolean> {
  // Notifications are unreliable on emulators/simulators
  let isPhysicalDevice = true;
  try {
    const device = require("expo-device");
    isPhysicalDevice = device?.isDevice ?? true;
  } catch (error) {
    isPhysicalDevice = true;
  }

  if (!isPhysicalDevice) {
    console.warn("Notifications only work on a physical device");
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync(
      Platform.OS === "ios"
        ? {
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          }
        : undefined,
    );
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("❌ Notification permissions not granted");
    return false;
  }

  // Android: Create notification channel
  if (Platform.OS === "android") {
    await setupAndroidNotificationChannels();
  }

  console.log("✅ Notification permissions granted");
  return true;
}

async function setupAndroidNotificationChannels(): Promise<void> {
  await Notifications.setNotificationChannelAsync(ANDROID_REMINDER_CHANNEL_ID, {
    name: "Workout Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#10B981",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync(ANDROID_STREAK_CHANNEL_ID, {
    name: "Streak Warnings",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500],
    lightColor: "#F97316",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync(ANDROID_ACHIEVEMENT_CHANNEL_ID, {
    name: "Achievements",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500],
    lightColor: "#FFD700",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync(ANDROID_INSIGHTS_CHANNEL_ID, {
    name: "Insights & Tips",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function promptBatteryOptimizationDisableOnce(): Promise<void> {
  if (Platform.OS !== "android") return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const hasPrompted = await AsyncStorage.getItem(BATTERY_GUIDE_KEY);
  if (hasPrompted === "1") return;

  await AsyncStorage.setItem(BATTERY_GUIDE_KEY, "1");

  Alert.alert(
    "Enable Reliable Notifications",
    "To receive wake-up and workout reminders on time, please disable battery optimization for this app in device settings.",
    [
      { text: "Not Now", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ],
  );
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

  // Use Notifee for background-safe notification (if available)
  if (notifeeAvailable && notifyAchievementUnlocked) {
    try {
      await notifyAchievementUnlocked(achievement);
    } catch (error) {
      console.warn("⚠️ Notifee achievement notification failed:", error);
      // Fall through to expo-notifications below
    }
  }

  // Also send via expo-notifications for immediate feedback if app is open
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
    trigger:
      Platform.OS === "android"
        ? { channelId: ANDROID_ACHIEVEMENT_CHANNEL_ID }
        : null, // Send immediately
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
    trigger:
      Platform.OS === "android"
        ? { channelId: ANDROID_INSIGHTS_CHANNEL_ID }
        : null,
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
    trigger:
      Platform.OS === "android"
        ? { channelId: ANDROID_STREAK_CHANNEL_ID }
        : null,
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
    trigger:
      Platform.OS === "android"
        ? { channelId: ANDROID_REMINDER_CHANNEL_ID }
        : null,
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

  // Update Notifee background notifications (if available)
  if (notifeeAvailable && scheduleBackgroundNotifications && getBackgroundNotificationPreferences) {
    try {
      const bgPrefs = await getBackgroundNotificationPreferences();
      bgPrefs.dailyReminder = preferences.dailyReminder;
      bgPrefs.dailyReminderTime = preferences.dailyReminderTime;
      await scheduleBackgroundNotifications(bgPrefs);
    } catch (error) {
      console.warn("⚠️ Notifee background scheduling failed:", error);
      // Continue with expo-notifications
    }
  }

  // Daily reminder (also schedule with Notifee for app closed if available)
  if (preferences.dailyReminder) {
    const [hours, minutes] = preferences.dailyReminderTime
      .split(":")
      .map(Number);

    // Schedule with Notifee (works when app closed - development builds only)
    if (notifeeAvailable && scheduleDailyWakeUp) {
      try {
        await scheduleDailyWakeUp(preferences.dailyReminderTime);
      } catch (error) {
        console.warn("⚠️ Notifee daily wake-up scheduling failed:", error);
      }
    }

    // Also schedule with expo-notifications (for when app is open)
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
        channelId:
          Platform.OS === "android" ? ANDROID_REMINDER_CHANNEL_ID : undefined,
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
        channelId:
          Platform.OS === "android" ? ANDROID_REMINDER_CHANNEL_ID : undefined,
      },
    });

    console.log("📊 Weekly summary scheduled for Sundays at 6 PM");
  }

  // Frequent motivation (if enabled)
  if (preferences.motivationalQuotes) {
    // Morning motivation (daily 7:30 AM)
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_MOTIVATION_ID,
      content: {
        title: "Rise & Grind ☀️",
        body: "Start strong today. Your goals are waiting.",
        data: { type: "morning_motivation" },
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 7,
        minute: 30,
        channelId:
          Platform.OS === "android" ? ANDROID_REMINDER_CHANNEL_ID : undefined,
      },
    });

    // Evening check-in (daily 7:00 PM)
    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_CHECKIN_ID,
      content: {
        title: "Evening Check-In 💪",
        body: "Haven't trained yet? A short session still counts.",
        data: { type: "evening_checkin" },
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 19,
        minute: 0,
        channelId:
          Platform.OS === "android" ? ANDROID_REMINDER_CHANNEL_ID : undefined,
      },
    });

    // Weekly motivation (Tue & Thu at 1 PM)
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_MOTIVATION_ID,
      content: {
        title: "Midweek Push 🔥",
        body: "Momentum beats motivation. Keep the streak alive.",
        data: { type: "weekly_motivation" },
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 3, // Tuesday
        hour: 13,
        minute: 0,
        channelId:
          Platform.OS === "android" ? ANDROID_REMINDER_CHANNEL_ID : undefined,
      },
    });

    await Notifications.scheduleNotificationAsync({
      identifier: `${WEEKLY_MOTIVATION_ID}-thu`,
      content: {
        title: "Finish Strong 💥",
        body: "Two days left in the week. Make them count.",
        data: { type: "weekly_motivation" },
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 5, // Thursday
        hour: 13,
        minute: 0,
        channelId:
          Platform.OS === "android" ? ANDROID_REMINDER_CHANNEL_ID : undefined,
      },
    });

    console.log("⏰ Morning + evening + midweek motivations scheduled");
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

  // Use Notifee for background-safe reminder (if available)
  // This works even when app is closed (development builds only)
  if (notifeeAvailable && scheduleStreakWarning) {
    try {
      await scheduleStreakWarning(currentStreak, "20:00"); // 8 PM
    } catch (error) {
      console.warn("⚠️ Notifee streak warning scheduling failed:", error);
    }
  }

  // Also add to expo-notifications for when app is open
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
      channelId:
        Platform.OS === "android" ? ANDROID_STREAK_CHANNEL_ID : undefined,
    },
  });

  console.log(
    `⏰ Streak reminder scheduled for 8 PM (streak: ${currentStreak})`,
  );
}

export async function cancelStreakReminder(): Promise<void> {
  // Cancel from both systems
  if (notifeeAvailable && cancelNotifeeStreakWarning) {
    try {
      await cancelNotifeeStreakWarning();
    } catch (error) {
      console.warn("⚠️ Notifee streak warning cancellation failed:", error);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  await Notifications.cancelScheduledNotificationAsync(
    `streak-reminder-${today}`,
  ).catch(() => null);

  console.log("✅ Streak reminder cancelled (workout logged)");
}

/* =========================
   UTILITIES
   ========================= */

export async function cancelAllScheduledNotifications(): Promise<void> {
  // Cancel from expo-notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Cancel from Notifee (if available)
  if (notifeeAvailable && cancelNotifeeScheduled) {
    try {
      await cancelNotifeeScheduled();
    } catch (error) {
      console.warn("⚠️ Notifee cancellation failed:", error);
    }
  }

  console.log("🗑️ All scheduled notifications cancelled");
}

/* =========================
   TEMPORARY TEST HELPERS
   ========================= */

// =========================================================
// TEMPORARY TEST FUNCTION — DELETE BEFORE PRODUCTION
// Fires a notification every 10 minutes to verify pipeline
// =========================================================
export async function scheduleTestNotificationEvery10Minutes(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(TEST_NOTIFICATION_ID).catch(
    () => null,
  );

  await Notifications.scheduleNotificationAsync({
    identifier: TEST_NOTIFICATION_ID,
    content: {
      title: "🧪 Test Notification",
      body: "If you see this, background notifications are working!",
      data: { type: "test" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 600,
      repeats: true,
      channelId:
        Platform.OS === "android" ? ANDROID_REMINDER_CHANNEL_ID : undefined,
    },
  });

  console.log(
    "[TEST] 10-minute notification scheduled. Check at:",
    new Date(Date.now() + 600000).toISOString(),
  );
}

// To stop the test
export async function cancelTestNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(TEST_NOTIFICATION_ID).catch(
    () => null,
  );
  console.log("[TEST] Test notification cancelled.");
}
// =========================================================
// END TEMPORARY TEST FUNCTION
// =========================================================

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

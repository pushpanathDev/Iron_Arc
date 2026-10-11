import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
  NotificationState,
  PlannedNotification,
  planNotifications,
} from "./notificationPlanner";

export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
} from "./notificationPlanner";
export type { NotificationState, PlannedNotification } from "./notificationPlanner";

const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === "expo";
const PREFS_KEY = "@notification_preferences";
const BATTERY_GUIDE_KEY = "@battery_optimization_prompted";
const ANDROID_REMINDER_CHANNEL_ID = "workout-reminders";
const ANDROID_PROGRESS_CHANNEL_ID = "progress-reminders";

let lastNotificationState: NotificationState | null = null;

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (error) {
  console.warn("[Notifications] setNotificationHandler failed:", error);
}

export async function initNotifications(): Promise<void> {
  if (IS_EXPO_GO) return;

  try {
    await setupAndroidNotificationChannels();
    if ((await Notifications.getPermissionsAsync()).status === "granted" && lastNotificationState) {
      await refreshNotificationSchedule(lastNotificationState);
    }
  } catch (error) {
    console.error("Error initializing notifications:", error);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync(
      Platform.OS === "ios"
        ? { ios: { allowAlert: true, allowBadge: true, allowSound: true } }
        : undefined,
    );
    finalStatus = status;
  }

  if (finalStatus !== "granted") return false;
  await setupAndroidNotificationChannels();
  if (lastNotificationState) {
    await refreshNotificationSchedule(lastNotificationState);
  }
  return true;
}

async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ANDROID_REMINDER_CHANNEL_ID, {
    name: "Workout Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#10B981",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync(ANDROID_PROGRESS_CHANNEL_ID, {
    name: "Progress and Motivation",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 150, 150, 150],
    lightColor: "#4F46E5",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });
}

export async function promptBatteryOptimizationDisableOnce(): Promise<void> {
  if (Platform.OS !== "android" || IS_EXPO_GO) return;
  if ((await Notifications.getPermissionsAsync()).status !== "granted") return;
  if ((await AsyncStorage.getItem(BATTERY_GUIDE_KEY)) === "1") return;

  await AsyncStorage.setItem(BATTERY_GUIDE_KEY, "1");
  Alert.alert(
    "Enable Reliable Notifications",
    "To receive workout reminders on time, please disable battery optimization for this app in device settings.",
    [
      { text: "Not Now", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ],
  );
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...parsed,
      };
    }
  } catch (error) {
    console.error("Error reading notification preferences:", error);
  }
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function setNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<void> {
  const current = await getNotificationPreferences();
  const updated = { ...current, ...prefs };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  if (lastNotificationState) {
    await refreshNotificationSchedule(lastNotificationState);
  }
}

export async function refreshNotificationSchedule(
  state: NotificationState,
  now = new Date(),
): Promise<PlannedNotification[]> {
  lastNotificationState = state;
  const prefs = await getNotificationPreferences();
  const planned = planNotifications(state, now, prefs);

  if (IS_EXPO_GO) return planned;

  try {
    if ((await Notifications.getPermissionsAsync()).status !== "granted") {
      return planned;
    }

    await cancelAllScheduledNotifications();
    for (const notification of planned) {
      await Notifications.scheduleNotificationAsync({
        identifier: notification.id,
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: notification.priority <= 2,
          ...(Platform.OS === "android"
            ? { channelId: notification.priority <= 2 ? ANDROID_REMINDER_CHANNEL_ID : ANDROID_PROGRESS_CHANNEL_ID }
            : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notification.date,
        },
      });
    }
  } catch (error) {
    console.warn("[Notifications] Scheduling failed:", error);
  }

  return planned;
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn("[Notifications] Cancel failed:", error);
  }
}

export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

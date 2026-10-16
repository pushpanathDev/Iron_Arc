import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";
import { darkColors } from "../theme/tokens";
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
/*
 * Android fixes a channel's sound and vibration once created, so the rest
 * alert has one channel per Sound/Vibrate combination (chosen per alert).
 */
const REST_CHANNELS = {
  soundVibrate: { id: "rest-timer", name: "Rest timer", sound: true, vibrate: true },
  vibrateOnly: { id: "rest-timer-vibrate", name: "Rest timer (vibrate only)", sound: false, vibrate: true },
  soundOnly: { id: "rest-timer-sound", name: "Rest timer (sound only)", sound: true, vibrate: false },
  silent: { id: "rest-timer-silent", name: "Rest timer (silent)", sound: false, vibrate: false },
} as const;
const restChannel = (sound: boolean, vibrate: boolean) =>
  sound ? (vibrate ? REST_CHANNELS.soundVibrate : REST_CHANNELS.soundOnly) : vibrate ? REST_CHANNELS.vibrateOnly : REST_CHANNELS.silent;
/** The Log Workout rest timer's end alert; kept out of the reminder schedule. */
const REST_TIMER_ID = "rest-timer";

let lastNotificationState: NotificationState | null = null;
/** What is actually scheduled with the OS right now (for "Coming up"). */
let lastScheduled: PlannedNotification[] = [];
const scheduleListeners = new Set<() => void>();

/** False in Expo Go and on simulators without notification support. */
export const notificationsSupported = () => !IS_EXPO_GO && Device.isDevice;

export type PermissionState = { status: "granted" | "denied" | "undetermined"; canAskAgain: boolean };

/** The phone's permission for this app (and whether the app may still ask). */
export async function getPermissionState(): Promise<PermissionState> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return { status: p.status as PermissionState["status"], canAskAgain: p.canAskAgain };
  } catch {
    return { status: "undetermined", canAskAgain: true };
  }
}

/** Reminders scheduled with the OS, soonest first. */
export function getUpcomingNotifications(limit = 3): PlannedNotification[] {
  const now = Date.now();
  return lastScheduled.filter((n) => n.date.getTime() > now).slice(0, limit);
}

/** Called when the schedule changes (the settings screen re-reads "Coming up"). */
export function onScheduleChange(listener: () => void): () => void {
  scheduleListeners.add(listener);
  return () => {
    scheduleListeners.delete(listener);
  };
}

/** A sample reminder in five seconds, to see how it pops up. Returns false if it can't be sent. */
export async function sendTestNotification(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if ((await getPermissionState()).status !== "granted") return false;
  await setupAndroidNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: "test-notification",
    content: {
      title: "Reminders are working",
      body: "This is how Iron Arc reminders will look.",
      sound: true,
      ...(Platform.OS === "android" ? { channelId: ANDROID_REMINDER_CHANNEL_ID } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
  return true;
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // The rest timer alerts in-app (haptic + bar) while the app is open.
      const inApp = notification.request.identifier === REST_TIMER_ID;
      return {
        shouldShowAlert: !inApp,
        shouldPlaySound: !inApp,
        shouldSetBadge: !inApp,
        shouldShowBanner: !inApp,
        shouldShowList: !inApp,
      };
    },
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
    // Android 13+ shows the permission prompt only once a channel exists.
    await setupAndroidNotificationChannels();
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
    lightColor: darkColors.accent,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });
  for (const c of Object.values(REST_CHANNELS)) {
    await Notifications.setNotificationChannelAsync(c.id, {
      name: c.name,
      importance: Notifications.AndroidImportance.HIGH,
      ...(c.vibrate ? { vibrationPattern: [0, 300, 150, 300] } : { enableVibrate: false }),
      sound: c.sound ? "default" : null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.setNotificationChannelAsync(ANDROID_PROGRESS_CHANNEL_ID, {
    name: "Progress and Motivation",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 150, 150, 150],
    lightColor: darkColors.accent,
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
      const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed };
      // There is no master switch any more: "all off" carries over as each reminder off.
      if (parsed.enabled === false) {
        const migrated = { ...prefs, enabled: true, dailyReminder: false, streakReminders: false, inactivityReminders: false, weeklySummary: false, weighIn: false };
        await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return prefs;
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

  const publish = (list: PlannedNotification[]) => {
    lastScheduled = list;
    scheduleListeners.forEach((l) => l());
  };
  if (IS_EXPO_GO) {
    publish([]);
    return planned;
  }

  try {
    if ((await Notifications.getPermissionsAsync()).status !== "granted") {
      publish([]);
      return planned;
    }

    // Replace the reminder schedule, leaving a running rest timer alone.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier !== REST_TIMER_ID)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
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
    publish(planned);
  } catch (error) {
    console.warn("[Notifications] Scheduling failed:", error);
    publish([]);
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

/**
 * Alert when the rest timer ends, so it fires with the app in the background.
 * Silently does nothing without permission or in Expo Go.
 */
export async function scheduleRestEndNotification(endsAt: number, body: string): Promise<void> {
  if (IS_EXPO_GO || endsAt <= Date.now()) return;
  try {
    if ((await Notifications.getPermissionsAsync()).status !== "granted") return;
    const prefs = await getNotificationPreferences();
    if (!prefs.restTimerAlert) return;
    await Notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_ID,
      content: {
        title: "Rest over",
        body,
        sound: prefs.restSound,
        ...(Platform.OS === "android" ? { channelId: restChannel(prefs.restSound, prefs.restVibrate).id } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
    });
  } catch (error) {
    console.warn("[Notifications] Rest timer scheduling failed:", error);
  }
}

export async function cancelRestEndNotification(): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_ID);
  } catch {
    // Nothing scheduled.
  }
}


import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import {
  getNotificationPreferences,
  getPermissionState,
  getUpcomingNotifications,
  notificationsSupported,
  onScheduleChange,
  requestNotificationPermissions,
  sendTestNotification,
  setNotificationPreferences,
  type NotificationPreferences,
  type PermissionState,
} from "../notifications/notificationService";
import type { PlannedNotification } from "../notifications/notificationPlanner";
import { useToast } from "../providers/ToastContext";

const SAVED_BADGE_MS = 1500;

/**
 * Everything the Notification settings screen reads and changes: the saved
 * preferences (instant save, brief "Saved" badge, rolled back on failure), the
 * system permission, what's scheduled next, and the test notification.
 */
export function useNotificationSettings() {
  const { showToast } = useToast();
  const supported = notificationsSupported();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [upcoming, setUpcoming] = useState<PlannedNotification[]>([]);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getNotificationPreferences().then(setPrefs);
    setUpcoming(getUpcomingNotifications());
    const off = onScheduleChange(() => setUpcoming(getUpcomingNotifications()));
    return () => {
      off();
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  // Re-read the permission whenever the screen shows or the app returns from phone settings.
  const refreshPermission = useCallback(() => void getPermissionState().then(setPermission), []);
  useFocusEffect(refreshPermission);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && refreshPermission());
    return () => sub.remove();
  }, [refreshPermission]);

  const save = async (updates: Partial<NotificationPreferences>) => {
    const previous = prefs;
    setPrefs((p) => (p ? { ...p, ...updates } : p));
    try {
      await setNotificationPreferences(updates);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), SAVED_BADGE_MS);
    } catch {
      setPrefs(previous);
      showToast({ type: "error", message: "Couldn't save that setting", subtitle: "Please try again." });
    }
  };

  const allow = async () => {
    // The system prompt may already have granted it: never send someone to settings for nothing.
    const now = await getPermissionState();
    setPermission(now);
    if (now.status === "granted") return;
    if (!now.canAskAgain) {
      showToast({ type: "info", message: "Turn on notifications for Iron Arc", subtitle: "In the page that opens: Notifications → Allow." });
      void Linking.openSettings();
      return;
    }
    await requestNotificationPermissions();
    refreshPermission();
  };

  const test = async () => {
    setTesting(true);
    try {
      const sent = await sendTestNotification();
      showToast(
        sent
          ? { type: "success", message: "Test on its way", subtitle: "Leave the app or lock the phone to see the pop-up in 5 seconds." }
          : { type: "error", message: "Couldn't send a test", subtitle: "Allow notifications first." },
      );
    } finally {
      setTesting(false);
    }
  };

  return { supported, prefs, permission, upcoming, saved, testing, save, allow, test };
}

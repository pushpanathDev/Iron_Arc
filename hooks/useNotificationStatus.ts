import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { getNotificationPreferences } from "../notifications/notificationService";

export type NotificationStatus = "On" | "Off" | "Not allowed";

/** The real notification state for the Profile row: the app setting and the system permission. Rechecked on focus. */
export function useNotificationStatus() {
  const [status, setStatus] = useState<NotificationStatus | null>(null);

  const reload = useCallback(async () => {
    try {
      const [prefs, perm] = await Promise.all([getNotificationPreferences(), Notifications.getPermissionsAsync()]);
      const anyOn = prefs.dailyReminder || prefs.streakReminders || prefs.inactivityReminders || prefs.weeklySummary || prefs.weighIn;
      setStatus(perm.status !== "granted" ? "Not allowed" : anyOn ? "On" : "Off");
    } catch {
      setStatus(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { status, reload };
}

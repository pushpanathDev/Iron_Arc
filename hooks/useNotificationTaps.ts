import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../providers/AuthContext";
import { notificationsSupported } from "../notifications/notificationService";

/** Where each reminder leads when tapped. The rest timer and the test have no type: the app just opens. */
const ROUTES: Record<string, Href> = {
  daily_reminder: "/workout/pick",
  goal_at_risk: "/workout/pick",
  inactivity: "/workout/pick",
  weekly_summary: "/(tabs)/analytics",
  weigh_in: "/(tabs)/body-weight",
};

/** A tap that opened the app is acted on only if this recent (never replays an old one). */
const COLD_START_WINDOW_MS = 60_000;

/**
 * Opens the right screen when a reminder is tapped, whether the app was open,
 * in the background or closed. Waits until sign-in has finished so the auth
 * guard doesn't bounce the navigation.
 */
export function useNotificationTaps(): void {
  const { status } = useAuth();
  const statusRef = useRef(status);
  statusRef.current = status;
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!notificationsSupported()) return;
    const open = (type: unknown) => {
      if (typeof type !== "string" || !ROUTES[type]) return;
      if (statusRef.current === "ready") router.push(ROUTES[type]);
      else pending.current = type;
    };

    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data?.type));
    // Opened from a tap while the app was closed.
    void Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r && Date.now() - r.notification.date < COLD_START_WINDOW_MS) open(r.notification.request.content.data?.type);
      })
      .catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (status !== "ready" || !pending.current) return;
    const type = pending.current;
    pending.current = null;
    router.push(ROUTES[type]);
  }, [status]);
}

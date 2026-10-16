import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { cancelRestEndNotification, DEFAULT_NOTIFICATION_PREFERENCES, getNotificationPreferences, scheduleRestEndNotification } from "../notifications/notificationService";
import { clearRest, extendRest, getDraft, updateDraft } from "./workoutDraft";

const REST_EXTEND_SECONDS = 15;
/** A rest that ended longer ago than this (the app was in the background) ends silently. */
const REST_LATE_MS = 2000;
const TICK_MS = 250;

/**
 * The session's rest timer. It is stored as an end time, so it survives the
 * app going to the background. One timeout ends it (with a buzz if the app is
 * open); the countdown itself lives in the small components that show it, so
 * the session screen doesn't redraw several times a second while you rest.
 */
export function useRestTimer(endsAt: number | null) {
  // Rest settings (Notifications → Rest timer): default length and in-app vibration.
  const prefs = useRef({ seconds: DEFAULT_NOTIFICATION_PREFERENCES.restDefaultSeconds, vibrate: true });
  useFocusEffect(
    useCallback(() => {
      void getNotificationPreferences().then((p) => (prefs.current = { seconds: p.restDefaultSeconds, vibrate: p.restVibrate }));
    }, []),
  );

  useEffect(() => {
    if (endsAt == null) return;
    const end = () => {
      if (Date.now() - endsAt < REST_LATE_MS && AppState.currentState === "active" && prefs.current.vibrate) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      updateDraft(clearRest);
    };
    const t = setTimeout(end, Math.max(0, endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [endsAt]);

  const extend = useCallback(() => {
    updateDraft((d) => extendRest(d, REST_EXTEND_SECONDS));
    const r = getDraft()?.rest;
    if (r) void scheduleRestEndNotification(r.endsAt, "Rest over");
  }, []);

  const skip = useCallback(() => {
    updateDraft(clearRest);
    void cancelRestEndNotification();
  }, []);

  /** Rest length for the next set, from the settings. */
  const defaultSeconds = useCallback(() => prefs.current.seconds, []);

  return { extend, skip, defaultSeconds };
}

/** Whole seconds left until `endsAt`, updated a few times a second. */
export function useRestRemaining(endsAt: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [endsAt]);
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

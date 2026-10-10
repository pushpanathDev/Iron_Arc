import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useProfile } from "./useProfile";
import { useAllWeights } from "./useWeights";
import { useAllWorkouts } from "./useWorkouts";
import { refreshNotificationSchedule } from "../notifications/notificationService";

export function useNotificationScheduling(): void {
  const { user, status } = useAuth();
  const { data: profile } = useProfile();
  const { data: workouts = [] } = useAllWorkouts();
  const { data: weights = [] } = useAllWeights();

  useEffect(() => {
    if (!user || status === "signedOut" || status === "unverified") return;

    const state = {
      workouts,
      weights,
      displayName: profile?.displayName,
      weeklyGoal: profile?.weeklyGoal,
    };

    void refreshNotificationSchedule(state);
  }, [user, status, profile?.displayName, profile?.weeklyGoal, workouts, weights]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" || !user) return;
      void refreshNotificationSchedule({
        workouts,
        weights,
        displayName: profile?.displayName,
        weeklyGoal: profile?.weeklyGoal,
      });
    });

    return () => subscription.remove();
  }, [user, profile?.displayName, profile?.weeklyGoal, workouts, weights]);
}

import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import Card from "../../components/ui/Card";
import InsightCard from "../../components/ui/InsightCard";
import MiniLineChart from "../../components/ui/MiniLineChart";
import WorkoutBarChart, {
  WeeklyWorkoutBar,
} from "../../components/ui/WorkoutBarChart";

import { typography, useTheme } from "../../src/theme/theme";
import { getWorkoutInsight } from "../../src/utils/insightEngine";
import { useAuth } from "../../src/auth/AuthContext";

import { getAllWorkouts, Workout } from "../../src/db/workouts";
import { getAllWeights, BodyWeight } from "../../src/db/weights";

/* =========================
   ANALYTICS SCREEN
   ========================= */

export default function Analytics() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<BodyWeight[]>([]);
  const [selectedWeek, setSelectedWeek] =
    useState<WeeklyWorkoutBar | null>(null);

  /* ------------------ LOAD LOCAL DATA ------------------ */

  useEffect(() => {
    if (!user) return;

    (async () => {
      const w = await getAllWorkouts(user.uid);
      const bw = await getAllWeights(user.uid);
      setWorkouts(w);
      setWeights(bw);
    })();
  }, [user]);

  /* ------------------ DERIVED ANALYTICS ------------------ */

  const workoutTrend: WeeklyWorkoutBar[] = useMemo(() => {
    const map = new Map<string, number>();

    workouts.forEach((w) => {
      const weekStart = getWeekStart(w.date);
      map.set(weekStart, (map.get(weekStart) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, count]) => ({
        weekStart,
        weekLabel: getWeekLabel(weekStart),
        monthLabel: getMonthLabel(weekStart),
        workouts: count,
        isCurrentWeek: isCurrentWeek(weekStart),
      }));
  }, [workouts]);

  const volumeTrend = useMemo(() => {
    const map = new Map<string, number>();

    workouts.forEach((w) => {
      const weekStart = getWeekStart(w.date);
      const volume = w.sets.reduce(
        (sum, s) => sum + s.reps * s.weight,
        0
      );
      map.set(weekStart, (map.get(weekStart) ?? 0) + volume);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, volume]) => volume);
  }, [workouts]);

  const weightTrend = useMemo(
    () => weights.map((w) => w.weight),
    [weights]
  );

  /* ------------------ INSIGHTS ------------------ */

  const workoutAvg =
    workoutTrend.length > 0
      ? workoutTrend.reduce((s, w) => s + w.workouts, 0) /
        workoutTrend.length
      : 0;

  const latestWeek =
    workoutTrend[workoutTrend.length - 1]?.workouts ?? 0;

  const globalInsight = getWorkoutInsight(latestWeek, workoutAvg);

  const selectedInsight =
    selectedWeek && workoutAvg > 0
      ? getWorkoutInsight(selectedWeek.workouts, workoutAvg)
      : null;

  /* ------------------ UI ------------------ */

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.md,
      }}
    >
      {/* HEADER */}
      <Text
        style={{
          fontSize: 28,
          fontFamily: typography.heading.fontFamily,
          color: colors.textPrimary,
          marginBottom: spacing.xs,
        }}
      >
        Analytics
      </Text>

      <Text
        style={{
          fontSize: 14,
          fontFamily: typography.body.fontFamily,
          color: colors.textSecondary,
          marginBottom: spacing.lg,
        }}
      >
        Performance overview & training trends
      </Text>

      <InsightCard message={globalInsight} />

      {/* WORKOUT TRENDS */}
      <Animated.View entering={FadeInUp.duration(300)}>
        <Card>
          <Text
            style={{
              fontSize: 18,
              fontFamily: typography.subheading.fontFamily,
              color: colors.textPrimary,
              marginBottom: spacing.sm,
            }}
          >
            Workout Trends
          </Text>

          {workoutTrend.length > 0 ? (
            <>
              <WorkoutBarChart
                data={workoutTrend}
                onBarPress={setSelectedWeek}
              />

              {selectedWeek && (
                <View
                  style={{
                    marginTop: spacing.sm,
                    padding: spacing.md,
                    borderRadius: 14,
                    backgroundColor: `${colors.accent}15`,
                  }}
                >
                  <Text style={{ color: colors.textSecondary }}>
                    {selectedWeek.monthLabel} · {selectedWeek.weekLabel}
                  </Text>

                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.textPrimary,
                    }}
                  >
                    {selectedWeek.workouts} workouts
                  </Text>

                  {selectedInsight && (
                    <Text style={{ color: colors.accent }}>
                      {selectedInsight}
                    </Text>
                  )}
                </View>
              )}

              <View style={{ height: spacing.lg }} />

              <MiniLineChart data={volumeTrend} />
            </>
          ) : (
            <Text style={{ color: colors.textSecondary }}>
              Not enough workout data yet.
            </Text>
          )}
        </Card>
      </Animated.View>

      {/* BODY WEIGHT */}
      <Animated.View entering={FadeInUp.duration(300)}>
        <Card>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: colors.textPrimary,
              marginBottom: spacing.sm,
            }}
          >
            Body Weight Trends
          </Text>

          {weightTrend.length > 1 ? (
            <MiniLineChart data={weightTrend} />
          ) : (
            <Text style={{ color: colors.textSecondary }}>
              Add more weights to see progress.
            </Text>
          )}
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

/* =========================
   DATE HELPERS
   ========================= */

function getWeekStart(dateStr: string) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

function getWeekLabel(weekStart: string) {
  const d = new Date(weekStart);
  return `W${Math.ceil(d.getDate() / 7)}`;
}

function getMonthLabel(weekStart: string) {
  return new Date(weekStart).toLocaleString("default", {
    month: "short",
  });
}

function isCurrentWeek(weekStart: string) {
  const now = new Date();
  const start = new Date(weekStart);
  return Math.abs(now.getTime() - start.getTime()) <
    7 * 24 * 60 * 60 * 1000;
}

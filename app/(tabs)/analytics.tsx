import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import Card from "../../components/ui/Card";
import InsightCard from "../../components/ui/InsightCard";
import MiniLineChart from "../../components/ui/MiniLineChart";
import WorkoutBarChart, {
  WeeklyWorkoutBar,
} from "../../components/ui/WorkoutBarChart";

import { useAuth } from "../../src/auth/AuthContext";
import { typography, useTheme } from "../../src/theme/theme";
import { getWorkoutInsight } from "../../src/utils/insightEngine";

import { BodyWeight, getAllWeights } from "../../src/db/weights";
import { getAllWorkouts, Workout } from "../../src/db/workouts";

export default function Analytics() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<BodyWeight[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<WeeklyWorkoutBar | null>(
    null,
  );

  /* =========================
     RELOAD SQLITE (SAFE)
     ========================= */

  const reloadData = useCallback(async () => {
    if (!user) {
      // 🔑 IMPORTANT: reset state deterministically
      setWorkouts([]);
      setWeights([]);
      setSelectedWeek(null);
      return;
    }

    const [w, bw] = await Promise.all([
      getAllWorkouts(user.uid),
      getAllWeights(user.uid),
    ]);

    bw.sort((a, b) => a.date.localeCompare(b.date));

    setWorkouts(w);
    setWeights(bw);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reloadData();
    }, [reloadData]),
  );

  /* =========================
     WORKOUT ANALYTICS
     ========================= */

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
      const volume = w.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
      map.set(weekStart, (map.get(weekStart) ?? 0) + volume);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, volume]) => volume);
  }, [workouts]);

  /* =========================
     BODY WEIGHT ANALYTICS
     ========================= */

  const weightStats = useMemo(() => {
    if (weights.length === 0) return null;

    const values = weights.map((w) => w.weight);
    const first = values[0];
    const latest = values[values.length - 1];

    const delta = +(latest - first).toFixed(1);
    const avg = +(values.reduce((s, v) => s + v, 0) / values.length).toFixed(1);

    return {
      latest,
      delta,
      avg,
      min: Math.min(...values),
      max: Math.max(...values),
      trend: delta > 0.3 ? "up" : delta < -0.3 ? "down" : "stable",
      chart: values,
    };
  }, [weights]);

  /* =========================
     INSIGHTS
     ========================= */

  const workoutAvg =
    workoutTrend.length > 0
      ? workoutTrend.reduce((s, w) => s + w.workouts, 0) / workoutTrend.length
      : 0;

  const latestWeek = workoutTrend[workoutTrend.length - 1]?.workouts ?? 0;

  const globalInsight = getWorkoutInsight(latestWeek, workoutAvg);

  const selectedInsight =
    selectedWeek && workoutAvg > 0
      ? getWorkoutInsight(selectedWeek.workouts, workoutAvg)
      : null;

  /* =========================
     UI
     ========================= */

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
            Body Weight
          </Text>

          {weightStats ? (
            <>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "700",
                  color: colors.textPrimary,
                }}
              >
                {weightStats.latest} kg
              </Text>

              <Text
                style={{
                  color:
                    weightStats.trend === "down"
                      ? "#22C55E"
                      : weightStats.trend === "up"
                        ? "#EF4444"
                        : colors.textSecondary,
                  marginBottom: spacing.sm,
                }}
              >
                {weightStats.delta >= 0 ? "↑" : "↓"}{" "}
                {Math.abs(weightStats.delta)} kg overall
              </Text>

              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Avg {weightStats.avg} · Min {weightStats.min} · Max{" "}
                {weightStats.max}
              </Text>

              <View style={{ height: spacing.md }} />
              <MiniLineChart data={weightStats.chart} />
            </>
          ) : (
            <Text style={{ color: colors.textSecondary }}>
              Add body weight entries to see progress.
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
  return new Date(weekStart).toLocaleString("default", { month: "short" });
}

function isCurrentWeek(weekStart: string) {
  const now = new Date();
  const start = new Date(weekStart);
  return Math.abs(now.getTime() - start.getTime()) < 7 * 24 * 60 * 60 * 1000;
}

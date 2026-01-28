import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import AnimatedCardWrapper from "../../components/ui/AnimatedCardWrapper";
import Card from "../../components/ui/Card";
import PrimaryButton from "../../components/ui/PrimaryButton";
import StatChip from "../../components/ui/StatChip";
import { UserHeader } from "../../components/UserHeader";
import { firestoreDb } from "../../src/firebase/config";
import { useTheme } from "../../src/theme/theme";
import {
  getWeeklyWorkoutStats,
  getWorkoutStreak,
} from "../../src/utils/weeklyStats";
import {
  calculateWeeklyReps,
  calculateWorkoutStreak,
} from "../../src/utils/workoutStats";
WebBrowser.maybeCompleteAuthSession();

export default function Home() {
  const { colors, spacing } = useTheme();
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [lastWorkoutDate, setLastWorkoutDate] = useState<string | null>(null);
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [weeklyReps, setWeeklyReps] = useState(0);
  const [streak, setStreak] = useState<number>(0);
  const [weightTrend, setWeightTrend] = useState<number[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<{
    workouts: number;
    sets: number;
    reps: number;
    volume: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWorkoutStats();
    fetchWeightStats();
    loadWeeklyStats();
    loadStreak();
  }, []);

  const loadStreak = async () => {
    const count = await getWorkoutStreak();
    setStreak(count);
  };

  const loadWeeklyStats = async () => {
    const stats = await getWeeklyWorkoutStats();
    setWeeklyStats(stats);
  };

  /* =========================
     PULL-TO-REFRESH
     ========================= */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchWorkoutStats(),
        fetchWeightStats(),
        loadWeeklyStats(),
        loadStreak(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchWorkoutStats = async () => {
    const q = query(
      collection(firestoreDb, "workouts"),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);
    const workouts = snapshot.docs.map((doc) => doc.data());

    setTotalWorkouts(workouts.length);

    if (workouts.length > 0) {
      setLastWorkoutDate(workouts[0].date);
    }

    setWeeklyReps(calculateWeeklyReps(workouts));
    setStreak(calculateWorkoutStreak(workouts));
  };

  const fetchWeightStats = async () => {
    const q = query(
      collection(firestoreDb, "bodyWeight"),
      orderBy("weekStart", "desc"),
      limit(6),
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const data = snapshot.docs.map((doc) => doc.data()).reverse();

      setLastWeight(data[data.length - 1].weight);

      setWeightTrend(data.map((item) => item.weight));
      console.log(
        "Weight trend:",
        data.map((i) => i.weight),
      );
    }
  };

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.md,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Welcome Header */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: spacing.lg,
        }}
      >
        Welcome to GymTracker 💪
      </Text>

      {/* Show logged-in user */}
      <UserHeader variant="subtle" />

      {weeklyStats && (
        <Card>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "600",
              color: colors.textPrimary,
              marginBottom: spacing.sm,
            }}
          >
            This Week
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
            }}
          >
            <StatChip
              label="Workouts"
              value={weeklyStats.workouts}
              icon={
                <Ionicons
                  name="barbell-outline"
                  size={16}
                  color={colors.accent}
                />
              }
            />

            <StatChip
              label="Sets"
              value={weeklyStats.sets}
              icon={
                <Ionicons
                  name="layers-outline"
                  size={16}
                  color={colors.accent}
                />
              }
            />

            <StatChip
              label="Reps"
              value={weeklyStats.reps}
              icon={
                <Ionicons
                  name="repeat-outline"
                  size={16}
                  color={colors.accent}
                />
              }
            />

            {/* Streak chip */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.card,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                borderRadius: 10,
                gap: spacing.xs,
              }}
            >
              <Ionicons
                name="flame"
                size={18}
                color={streak > 0 ? "#FF6B00" : colors.textSecondary}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.textPrimary,
                }}
              >
                {streak}
              </Text>
            </View>
          </View>

          {streak === 0 && (
            <Text
              style={{
                marginTop: spacing.sm,
                color: colors.textSecondary,
                fontSize: 13,
              }}
            >
              Log at least one workout this week to start your streak 🔥
            </Text>
          )}
        </Card>
      )}
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 16,
          marginBottom: spacing.lg,
        }}
      >
        Track your workouts, sets, and weekly body weight progress effortlessly.
      </Text>

      {/* Workout Stats Card */}
      <AnimatedCardWrapper delay={0}>
        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <Ionicons name="barbell-outline" size={24} color={colors.accent} />
            <Text
              style={{
                fontSize: 20,
                fontWeight: "600",
                color: colors.textPrimary,
                marginLeft: spacing.sm,
              }}
            >
              Workouts
            </Text>
          </View>
          <Text
            style={{ color: colors.textSecondary, marginBottom: spacing.sm }}
          >
            Total: {totalWorkouts} | Last: {lastWorkoutDate ?? "-"}
          </Text>
          <PrimaryButton
            title="Add Workout"
            onPress={() => router.push("/add-workout")}
          />
          <PrimaryButton
            title="View History"
            onPress={() => router.push("/history")}
          />
        </Card>
      </AnimatedCardWrapper>

      {/* Body Weight Stats Card */}
      <AnimatedCardWrapper delay={0}>
        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <MaterialCommunityIcons
              name="weight-lifter"
              size={24}
              color={colors.accent}
            />
            <Text
              style={{
                fontSize: 20,
                fontWeight: "600",
                color: colors.textPrimary,
                marginLeft: spacing.sm,
              }}
            >
              Body Weight
            </Text>
          </View>
          <Text
            style={{ color: colors.textSecondary, marginBottom: spacing.sm }}
          >
            Last logged: {lastWeight ?? "-"} kg
          </Text>
          <PrimaryButton
            title="Add / Update Weight"
            onPress={() => router.push("/body-weight")}
          />
        </Card>
      </AnimatedCardWrapper>

      {/* Motivational Card */}
      <AnimatedCardWrapper delay={0}>
        <Card>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: colors.accent,
              marginBottom: spacing.sm,
            }}
          >
            Keep pushing!
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Consistency is key. Log your workouts regularly and watch your
            progress.
          </Text>
        </Card>
      </AnimatedCardWrapper>
    </ScrollView>
  );
}

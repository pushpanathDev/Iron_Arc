import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useAuth } from "../../auth/AuthContext";
import { useGlobalSync } from "../../context/SyncContext";
import { getUserProfile, UserProfile } from "../../db/profiles";
import { getAllWeights } from "../../db/weights";
import { getAllWorkouts, Workout } from "../../db/workouts";
import { useTheme } from "../../theme/theme";
import { formatDate } from "../../utils/weekUtils";

WebBrowser.maybeCompleteAuthSession();

/* ==============================
   TYPES
   ============================== */
interface RecentWorkout {
  date: string;
  exercises: string[];
  category: string;
  totalSets: number;
  totalVolume: number;
}

interface TrainingSuggestion {
  category: string;
  reason: string;
  daysSinceLastTrained: number;
  icon: string;
}

interface PersonalRecord {
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  isNew: boolean;
}

/* ==============================
   MAIN COMPONENT
   ============================== */
export default function Home() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { user } = useAuth();
  const { globalSync, refreshVersion } = useGlobalSync();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  const [suggestion, setSuggestion] = useState<TrainingSuggestion | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Flame animation for streak
  const flameScale = useSharedValue(1);
  useEffect(() => {
    if (streak > 0) {
      flameScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
        true,
      );
    }
  }, [streak]);

  const flameAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  // Auto-refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadAllData();
    }, [user]),
  );

  // Refresh on global sync
  useEffect(() => {
    if (!user || refreshVersion === 0) return;
    loadAllData();
  }, [refreshVersion]);

  /* ==============================
     DATA LOADING
     ============================== */
  const loadAllData = async () => {
    if (!user) return;
    await Promise.all([
      loadProfile(),
      loadStreak(),
      loadRecentWorkouts(),
      loadWeight(),
    ]);
  };

  const loadProfile = async () => {
    if (!user) return;
    const data = await getUserProfile(user.uid);
    setProfile(data);
  };

  const loadStreak = async () => {
    if (!user) return;
    try {
      // Calculate streak from local SQLite data (same as Analytics page)
      const workouts = await getAllWorkouts(user.uid);
      const sortedDates = [...new Set(workouts.map((w) => w.date))]
        .sort()
        .reverse();
      const today = formatDate(new Date());
      const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

      let count = 0;
      if (sortedDates[0] === today || sortedDates[0] === yesterday) {
        count = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const curr = new Date(sortedDates[i - 1]);
          const prev = new Date(sortedDates[i]);
          const diffDays = Math.floor(
            (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
          );
          if (diffDays === 1) {
            count++;
          } else {
            break;
          }
        }
      }
      setStreak(count);
    } catch (error) {
      console.log("Error loading streak:", error);
    }
  };

  const loadWeight = async () => {
    if (!user) return;
    try {
      const weights = await getAllWeights(user.uid);
      if (weights.length > 0) {
        // Sort by date descending and get the most recent
        const sorted = weights.sort((a, b) => b.date.localeCompare(a.date));
        setLastWeight(sorted[0].weight);
      }
    } catch (error) {
      console.log("Error loading weight:", error);
    }
  };

  const loadRecentWorkouts = async () => {
    if (!user) return;
    try {
      const workouts = await getAllWorkouts(user.uid);

      if (workouts.length === 0) {
        setRecentWorkouts([]);
        setSuggestion(null);
        setPersonalRecords([]);
        return;
      }

      // Group workouts by date
      const groupedByDate = workouts.reduce(
        (acc, w) => {
          if (!acc[w.date]) acc[w.date] = [];
          acc[w.date].push(w);
          return acc;
        },
        {} as Record<string, Workout[]>,
      );

      // Get recent workout sessions (last 5 days with workouts)
      const sortedDates = Object.keys(groupedByDate).sort((a, b) =>
        b.localeCompare(a),
      );
      const recent: RecentWorkout[] = sortedDates.slice(0, 5).map((date) => {
        const dayWorkouts = groupedByDate[date];
        const exercises = [...new Set(dayWorkouts.map((w) => w.exercise))];
        const categories = [
          ...new Set(dayWorkouts.map((w) => w.category || "Other")),
        ];
        const totalSets = dayWorkouts.reduce(
          (sum, w) => sum + w.sets.length,
          0,
        );
        const totalVolume = dayWorkouts.reduce(
          (sum, w) =>
            sum + w.sets.reduce((s, set) => s + set.reps * set.weight, 0),
          0,
        );

        return {
          date,
          exercises,
          category: categories.length === 1 ? categories[0] : "Mixed",
          totalSets,
          totalVolume,
        };
      });
      setRecentWorkouts(recent);

      // Calculate training suggestion
      const categoryLastTrained: Record<string, string> = {};
      for (const workout of workouts) {
        const cat = workout.category || "Other";
        if (
          !categoryLastTrained[cat] ||
          workout.date > categoryLastTrained[cat]
        ) {
          categoryLastTrained[cat] = workout.date;
        }
      }

      const mainCategories = [
        "Chest",
        "Back",
        "Shoulders",
        "Legs",
        "Arms",
        "Abs",
      ];
      const today = new Date();
      let bestSuggestion: TrainingSuggestion | null = null;
      let maxDays = -1;

      for (const cat of mainCategories) {
        const lastDate = categoryLastTrained[cat];
        let daysSince = 999;

        if (lastDate) {
          const last = new Date(lastDate);
          daysSince = Math.floor(
            (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
          );
        }

        if (daysSince > maxDays) {
          maxDays = daysSince;
          bestSuggestion = {
            category: cat,
            daysSinceLastTrained: daysSince,
            reason:
              daysSince >= 999
                ? "Never trained"
                : daysSince >= 7
                  ? "Over a week ago"
                  : daysSince >= 4
                    ? `${daysSince} days ago`
                    : `${daysSince} days rest`,
            icon: getCategoryIcon(cat),
          };
        }
      }
      setSuggestion(bestSuggestion);

      // Calculate Personal Records (top weight per exercise)
      const exercisePRs: Record<
        string,
        { weight: number; reps: number; date: string }
      > = {};
      for (const workout of workouts) {
        for (const set of workout.sets) {
          if (
            !exercisePRs[workout.exercise] ||
            set.weight > exercisePRs[workout.exercise].weight
          ) {
            exercisePRs[workout.exercise] = {
              weight: set.weight,
              reps: set.reps,
              date: workout.date,
            };
          }
        }
      }

      // Get top 3 PRs by weight, recently achieved
      const recentPRs = Object.entries(exercisePRs)
        .map(([exercise, data]) => ({
          exercise,
          ...data,
          isNew: isRecentDate(data.date, 7), // PR in last 7 days
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);

      setPersonalRecords(recentPRs);
    } catch (error) {
      console.log("Error loading recent workouts:", error);
    }
  };

  /* ==============================
     PULL-TO-REFRESH
     ============================== */
  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await globalSync(user.uid);
      await loadAllData();
    } catch (error) {
      console.log("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  };

  /* ==============================
     RENDER
     ============================== */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* ========== HEADER ========== */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(500)}
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                marginBottom: 4,
              }}
            >
              {getGreeting()}
            </Text>
            <Text style={{ ...typography.h1, color: colors.textPrimary }}>
              {profile?.displayName || "Athlete"} 💪
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.full,
              backgroundColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
              ...shadows.md,
            }}
          >
            <Ionicons name="person" size={24} color="#fff" />
          </Pressable>
        </View>
      </Animated.View>

      {/* ========== STREAK CARD ========== */}
      <Animated.View
        entering={FadeInUp.delay(150).duration(600)}
        style={{ marginHorizontal: spacing.md, marginBottom: spacing.md }}
      >
        <LinearGradient
          colors={
            streak > 0
              ? [colors.gradientStart, colors.gradientEnd]
              : [colors.surface, colors.surface]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.lg,
            overflow: "hidden",
            borderWidth: streak > 0 ? 0 : 1,
            borderColor: colors.cardBorder,
            ...shadows.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.label,
                  color:
                    streak > 0 ? "rgba(255,255,255,0.8)" : colors.textSecondary,
                  marginBottom: spacing.xs,
                }}
              >
                CURRENT STREAK
              </Text>
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text
                  style={{
                    ...typography.display,
                    color: streak > 0 ? "#fff" : colors.textPrimary,
                  }}
                >
                  {streak}
                </Text>
                <Text
                  style={{
                    ...typography.h3,
                    color:
                      streak > 0
                        ? "rgba(255,255,255,0.8)"
                        : colors.textSecondary,
                    marginLeft: spacing.xs,
                  }}
                >
                  {streak === 1 ? "day" : "days"}
                </Text>
              </View>
              <Text
                style={{
                  ...typography.caption,
                  color:
                    streak > 0 ? "rgba(255,255,255,0.7)" : colors.textSecondary,
                  marginTop: spacing.xs,
                }}
              >
                {getStreakMessage(streak)}
              </Text>
            </View>
            <Animated.View style={flameAnimatedStyle}>
              <Ionicons
                name="flame"
                size={64}
                color={streak > 0 ? "rgba(255,255,255,0.9)" : colors.border}
              />
            </Animated.View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ========== TODAY'S SUGGESTION ========== */}
      {suggestion && suggestion.daysSinceLastTrained >= 3 && (
        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          style={{ marginHorizontal: spacing.md, marginBottom: spacing.md }}
        >
          <Pressable
            onPress={() => router.push("/add-workout")}
            style={{
              backgroundColor: colors.accentLight,
              borderRadius: radius.xl,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.accent + "30",
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.lg,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Ionicons name={suggestion.icon as any} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.label,
                  color: colors.accent,
                  marginBottom: 2,
                }}
              >
                TODAY'S SUGGESTION
              </Text>
              <Text
                style={{ ...typography.bodyMedium, color: colors.textPrimary }}
              >
                Train {suggestion.category}
              </Text>
              <Text
                style={{ ...typography.caption, color: colors.textSecondary }}
              >
                {suggestion.reason}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.accent} />
          </Pressable>
        </Animated.View>
      )}

      {/* ========== QUICK ACTIONS ========== */}
      <Animated.View
        entering={FadeInUp.delay(250).duration(500)}
        style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg }}
      >
        <Pressable
          onPress={() => router.push("/add-workout")}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radius.xl,
            padding: spacing.lg,
            marginBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            ...shadows.md,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.full,
              backgroundColor: "rgba(255,255,255,0.2)",
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.md,
            }}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.h3, color: "#fff" }}>Log Workout</Text>
            <Text
              style={{ ...typography.caption, color: "rgba(255,255,255,0.8)" }}
            >
              Record today's training session
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={24}
            color="rgba(255,255,255,0.8)"
          />
        </Pressable>

        {/* Secondary Actions */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <QuickActionCard
            icon="scale-bathroom"
            iconType="material"
            label="Log Weight"
            subtitle={lastWeight ? `${lastWeight} kg` : "Not set"}
            onPress={() => router.push("/body-weight")}
            colors={colors}
            spacing={spacing}
            radius={radius}
            shadows={shadows}
          />
          <QuickActionCard
            icon="time-outline"
            label="History"
            subtitle="View all"
            onPress={() => router.push("/history")}
            colors={colors}
            spacing={spacing}
            radius={radius}
            shadows={shadows}
          />
          <QuickActionCard
            icon="stats-chart"
            label="Analytics"
            subtitle="Insights"
            onPress={() => router.push("/analytics")}
            colors={colors}
            spacing={spacing}
            radius={radius}
            shadows={shadows}
          />
        </View>
      </Animated.View>

      {/* ========== RECENT ACTIVITY ========== */}
      {recentWorkouts.length > 0 && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(500)}
          style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <Text style={{ ...typography.label, color: colors.textMuted }}>
              RECENT ACTIVITY
            </Text>
            <Pressable onPress={() => router.push("/history")}>
              <Text style={{ ...typography.caption, color: colors.accent }}>
                See All
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              overflow: "hidden",
              ...shadows.sm,
            }}
          >
            {recentWorkouts.slice(0, 4).map((workout, index) => (
              <View key={workout.date}>
                <View
                  style={{
                    padding: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.md,
                      backgroundColor: colors.accentLight,
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: spacing.sm,
                    }}
                  >
                    <Ionicons
                      name={getCategoryIcon(workout.category) as any}
                      size={18}
                      color={colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...typography.bodyMedium,
                        color: colors.textPrimary,
                      }}
                    >
                      {workout.category}
                    </Text>
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textSecondary,
                      }}
                      numberOfLines={1}
                    >
                      {workout.exercises.slice(0, 2).join(", ")}
                      {workout.exercises.length > 2 &&
                        ` +${workout.exercises.length - 2}`}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textSecondary,
                      }}
                    >
                      {formatRelativeDate(workout.date)}
                    </Text>
                    <Text
                      style={{ ...typography.caption, color: colors.textMuted }}
                    >
                      {workout.totalSets} sets
                    </Text>
                  </View>
                </View>
                {index < recentWorkouts.slice(0, 4).length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.divider,
                      marginLeft: spacing.md + 40 + spacing.sm,
                    }}
                  />
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* ========== PERSONAL RECORDS ========== */}
      {personalRecords.length > 0 && (
        <Animated.View
          entering={FadeInUp.delay(350).duration(500)}
          style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg }}
        >
          <Text
            style={{
              ...typography.label,
              color: colors.textMuted,
              marginBottom: spacing.sm,
            }}
          >
            PERSONAL RECORDS 🏆
          </Text>

          <View style={{ gap: spacing.xs }}>
            {personalRecords.map((pr, index) => (
              <View
                key={pr.exercise}
                style={{
                  backgroundColor: pr.isNew
                    ? colors.successLight
                    : colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: pr.isNew
                    ? colors.success + "40"
                    : colors.cardBorder,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.sm,
                    backgroundColor: pr.isNew
                      ? colors.success + "20"
                      : colors.accentLight,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...typography.bodyMedium,
                      color: colors.textPrimary,
                    }}
                    numberOfLines={1}
                  >
                    {pr.exercise}
                  </Text>
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.textSecondary,
                    }}
                  >
                    {pr.reps} reps @ {pr.weight} kg
                  </Text>
                </View>
                {pr.isNew && (
                  <View
                    style={{
                      backgroundColor: colors.success,
                      paddingHorizontal: spacing.xs,
                      paddingVertical: 2,
                      borderRadius: radius.xs,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.caption,
                        color: "#fff",
                        fontWeight: "600",
                      }}
                    >
                      NEW
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* ========== EMPTY STATE ========== */}
      {recentWorkouts.length === 0 && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(500)}
          style={{
            marginHorizontal: spacing.md,
            marginBottom: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.xl,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.cardBorder,
          }}
        >
          <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
          <Text
            style={{
              ...typography.h3,
              color: colors.textPrimary,
              marginTop: spacing.md,
            }}
          >
            Ready to start?
          </Text>
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: spacing.xs,
            }}
          >
            Log your first workout to see your activity and progress here.
          </Text>
        </Animated.View>
      )}

      {/* ========== MOTIVATIONAL FOOTER ========== */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(500)}
        style={{
          marginHorizontal: spacing.md,
          marginBottom: spacing.xl * 2,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {getMotivationalQuote()}
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

/* ==============================
   HELPER COMPONENTS
   ============================== */

function QuickActionCard({
  icon,
  iconType = "ionicons",
  label,
  subtitle,
  onPress,
  colors,
  spacing,
  radius,
  shadows,
}: {
  icon: string;
  iconType?: "ionicons" | "material";
  label: string;
  subtitle: string;
  onPress: () => void;
  colors: any;
  spacing: any;
  radius: any;
  shadows: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadows.sm,
      }}
    >
      {iconType === "material" ? (
        <MaterialCommunityIcons
          name={icon as any}
          size={28}
          color={colors.accent}
        />
      ) : (
        <Ionicons name={icon as any} size={28} color={colors.accent} />
      )}
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: colors.textPrimary,
          marginTop: spacing.xs,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

/* ==============================
   HELPER FUNCTIONS
   ============================== */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getStreakMessage(streak: number): string {
  if (streak === 0) return "Start your streak today! 🎯";
  if (streak < 3) return "Great start! Keep going! 🔥";
  if (streak < 7) return "You're building momentum! 💪";
  if (streak < 14) return "One week strong! 🚀";
  if (streak < 30) return "You're unstoppable! ⚡";
  return "Legendary dedication! 👑";
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Chest: "fitness-outline",
    Back: "body-outline",
    Shoulders: "barbell-outline",
    Legs: "walk-outline",
    Arms: "hand-left-outline",
    Abs: "ellipse-outline",
    Cardio: "heart-outline",
    "Full Body": "body-outline",
    Mixed: "layers-outline",
  };
  return icons[category] || "barbell-outline";
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = dateStr.split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateOnly === todayStr) return "Today";
  if (dateOnly === yesterdayStr) return "Yesterday";

  const diff = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 7) return `${diff}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isRecentDate(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function getMotivationalQuote(): string {
  const quotes = [
    '"Consistency beats intensity. Keep showing up."',
    '"The only bad workout is the one that didn\'t happen."',
    '"Progress, not perfection."',
    '"Your body can stand almost anything. It\'s your mind you have to convince."',
    '"Discipline is choosing between what you want now and what you want most."',
    '"The pain you feel today is the strength you feel tomorrow."',
    '"Champions are made when no one is watching."',
    '"Every rep counts. Every set matters."',
  ];
  // Use date-based selection for consistency within a day
  const dayIndex = new Date().getDate() % quotes.length;
  return quotes[dayIndex];
}

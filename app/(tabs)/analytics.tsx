import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
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
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";

import { useAuth } from "../../auth/AuthContext";
import { useGlobalSync } from "../../context/SyncContext";
import { useTheme } from "../../theme/theme";

import { getUserProfile } from "../../db/profiles";
import { BodyWeight, getAllWeights } from "../../db/weights";
import { getAllWorkouts, Workout } from "../../db/workouts";
import {
  generateInsights,
  Insight,
  InsightPriority,
} from "../../insights/insightEngine";
import { formatDate } from "../../utils/weekUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function Analytics() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { user } = useAuth();
  const { globalSync, refreshVersion } = useGlobalSync();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<BodyWeight[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<
    "week" | "month" | "all"
  >("week");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState(1); // Daily goal - default to 1 workout per day
  const [selectedWeightIndex, setSelectedWeightIndex] = useState<number | null>(
    null,
  );

  /* =========================
     LOAD DATA
     ========================= */
  const reloadData = useCallback(async () => {
    if (!user) {
      setWorkouts([]);
      setWeights([]);
      setInsights([]);
      return;
    }

    const [w, bw, profile] = await Promise.all([
      getAllWorkouts(user.uid),
      getAllWeights(user.uid),
      getUserProfile(user.uid),
    ]);

    bw.sort((a, b) => a.date.localeCompare(b.date));
    setWorkouts(w);
    setWeights(bw);

    // Load weekly goal from profile
    if (profile?.weeklyGoal) {
      setWeeklyGoal(profile.weeklyGoal);
    }

    // Generate insights from workout and weight data
    const generatedInsights = generateInsights(w, bw);
    setInsights(generatedInsights);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reloadData();
    }, [reloadData]),
  );

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      // Trigger global sync to pull from Firebase
      await globalSync(user.uid);
      await reloadData();
    } finally {
      setRefreshing(false);
    }
  }, [reloadData, user, globalSync]);

  // Refresh when global sync happens on another screen
  useEffect(() => {
    if (!user || refreshVersion === 0) return;
    reloadData();
  }, [refreshVersion]);

  /* =========================
     COMPUTED STATS
     ========================= */
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const filterByPeriod = (dateStr: string) => {
      const d = new Date(dateStr);
      if (selectedPeriod === "week") return d >= weekAgo;
      if (selectedPeriod === "month") return d >= monthAgo;
      return true;
    };

    const filteredWorkouts = workouts.filter((w) => filterByPeriod(w.date));
    const filteredWeights = weights.filter((w) => filterByPeriod(w.date));

    // Workout stats
    const totalWorkouts = filteredWorkouts.length;
    const totalSets = filteredWorkouts.reduce(
      (sum, w) => sum + w.sets.length,
      0,
    );
    const totalReps = filteredWorkouts.reduce(
      (sum, w) => sum + w.sets.reduce((s, set) => s + set.reps, 0),
      0,
    );
    const totalVolume = filteredWorkouts.reduce(
      (sum, w) => sum + w.sets.reduce((s, set) => s + set.reps * set.weight, 0),
      0,
    );

    // Weight stats
    const weightValues = filteredWeights.map((w) => w.weight);
    const latestWeight = weightValues[weightValues.length - 1] || 0;
    const firstWeight = weightValues[0] || 0;
    const weightDelta = latestWeight - firstWeight;
    const avgWeight = weightValues.length
      ? weightValues.reduce((s, v) => s + v, 0) / weightValues.length
      : 0;

    // Weekly distribution (last 7 days)
    const weeklyData: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = formatDate(d);
      const count = workouts.filter((w) => w.date === dateStr).length;
      weeklyData.push(count);
    }

    // Category breakdown
    const categoryMap = new Map<string, number>();
    filteredWorkouts.forEach((w) => {
      const cat = w.category || "Other";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
    const categories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Streak calculation
    let streak = 0;
    const sortedDates = [...new Set(workouts.map((w) => w.date))]
      .sort()
      .reverse();
    const today = formatDate(now);
    const yesterday = formatDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    // Today's workouts count (for daily goal)
    const todayWorkouts = workouts.filter((w) => w.date === today).length;

    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      streak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const curr = new Date(sortedDates[i - 1]);
        const prev = new Date(sortedDates[i]);
        const diffDays = Math.floor(
          (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
        );
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
    }

    return {
      totalWorkouts,
      todayWorkouts,
      totalSets,
      totalReps,
      totalVolume,
      latestWeight,
      weightDelta,
      avgWeight,
      weightValues,
      weightSeries: filteredWeights,
      weeklyData,
      categories,
      streak,
      goalProgress: Math.min((todayWorkouts / weeklyGoal) * 100, 100),
    };
  }, [workouts, weights, selectedPeriod, weeklyGoal]);

  useEffect(() => {
    if (stats.weightValues.length > 0) {
      setSelectedWeightIndex(stats.weightValues.length - 1);
    } else {
      setSelectedWeightIndex(null);
    }
  }, [stats.weightValues.length]);

  /* =========================
     PERIOD SELECTOR
     ========================= */
  const PeriodSelector = () => (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.xxs,
        marginBottom: spacing.lg,
      }}
    >
      {(["week", "month", "all"] as const).map((period) => (
        <Pressable
          key={period}
          onPress={() => setSelectedPeriod(period)}
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            backgroundColor:
              selectedPeriod === period ? colors.accent : "transparent",
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: typography.caption.fontSize,
              fontWeight: selectedPeriod === period ? "600" : "400",
              color: selectedPeriod === period ? "#fff" : colors.textSecondary,
            }}
          >
            {period === "week"
              ? "Week"
              : period === "month"
                ? "Month"
                : "All Time"}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* HEADER */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text
          style={{
            ...typography.h1,
            color: colors.textPrimary,
            marginBottom: spacing.xs,
          }}
        >
          Analytics
        </Text>
        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            marginBottom: spacing.lg,
          }}
        >
          Your fitness journey at a glance • Pull to refresh
        </Text>
      </Animated.View>

      {/* PERIOD SELECTOR */}
      <PeriodSelector />

      {/* HERO STATS ROW */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}
      >
        {/* WORKOUTS CARD */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: radius.xl,
            padding: spacing.lg,
            ...shadows.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.full,
                backgroundColor: "rgba(255,255,255,0.2)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="barbell-outline" size={18} color="#fff" />
            </View>
          </View>
          <Text style={{ ...typography.display, color: "#fff" }}>
            {stats.totalWorkouts}
          </Text>
          <Text
            style={{ ...typography.caption, color: "rgba(255,255,255,0.8)" }}
          >
            Workouts
          </Text>
        </LinearGradient>

        {/* STREAK CARD */}
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            ...shadows.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.full,
                backgroundColor:
                  stats.streak > 0
                    ? colors.warningLight
                    : colors.surfaceElevated,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="flame"
                size={18}
                color={stats.streak > 0 ? colors.warning : colors.textMuted}
              />
            </View>
          </View>
          <Text style={{ ...typography.display, color: colors.textPrimary }}>
            {stats.streak}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            Day Streak
          </Text>
        </View>
      </Animated.View>

      {/* WEEKLY GOAL PROGRESS */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.xs,
              }}
            >
              <Text style={{ ...typography.label, color: colors.textMuted }}>
                TODAY'S GOAL
              </Text>
              <Pressable
                onPress={() => router.push("/(tabs)/profile")}
                style={{ marginLeft: spacing.xs, padding: spacing.xxs }}
              >
                <Ionicons name="pencil" size={12} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={{ ...typography.h2, color: colors.textPrimary }}>
              {stats.todayWorkouts}/{weeklyGoal} workouts
            </Text>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                marginTop: spacing.xxs,
              }}
            >
              {stats.goalProgress >= 100
                ? "Daily goal achieved! 🎉"
                : `${Math.round(100 - stats.goalProgress)}% to go`}
            </Text>
          </View>
          <ProgressRing
            progress={stats.goalProgress}
            size={80}
            strokeWidth={8}
            color={colors.accent}
            bgColor={colors.surfaceElevated}
          />
        </View>
      </Animated.View>

      {/* STATS GRID */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(400)}
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}
      >
        <StatCard
          icon="layers-outline"
          label="Total Sets"
          value={stats.totalSets.toString()}
          colors={colors}
          spacing={spacing}
          radius={radius}
          shadows={shadows}
        />
        <StatCard
          icon="repeat-outline"
          label="Total Reps"
          value={stats.totalReps.toLocaleString()}
          colors={colors}
          spacing={spacing}
          radius={radius}
          shadows={shadows}
        />
        <StatCard
          icon="trending-up-outline"
          label="Volume"
          value={`${(stats.totalVolume / 1000).toFixed(1)}k`}
          suffix="kg"
          colors={colors}
          spacing={spacing}
          radius={radius}
          shadows={shadows}
        />
        <StatCard
          icon="scale-outline"
          label="Avg Weight"
          value={stats.avgWeight.toFixed(1)}
          suffix="kg"
          colors={colors}
          spacing={spacing}
          radius={radius}
          shadows={shadows}
        />
      </Animated.View>

      {/* WEEKLY ACTIVITY CHART */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.h3,
            color: colors.textPrimary,
            marginBottom: spacing.md,
          }}
        >
          Weekly Activity
        </Text>
        <WeeklyBarChart
          data={stats.weeklyData}
          colors={colors}
          spacing={spacing}
          radius={radius}
        />
      </Animated.View>

      {/* BODY WEIGHT CARD */}
      {stats.weightValues.length > 0 && (
        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.lg,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            ...shadows.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View>
              <Text
                style={{
                  ...typography.label,
                  color: colors.textMuted,
                  marginBottom: spacing.xs,
                }}
              >
                BODY WEIGHT
              </Text>
              <Text style={{ ...typography.stat, color: colors.textPrimary }}>
                {stats.latestWeight.toFixed(1)}
                <Text
                  style={{ ...typography.body, color: colors.textSecondary }}
                >
                  {" "}
                  kg
                </Text>
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: spacing.xxs,
                }}
              >
                <Ionicons
                  name={stats.weightDelta >= 0 ? "arrow-up" : "arrow-down"}
                  size={14}
                  color={stats.weightDelta > 0 ? colors.error : colors.success}
                />
                <Text
                  style={{
                    ...typography.caption,
                    color:
                      stats.weightDelta > 0 ? colors.error : colors.success,
                    marginLeft: spacing.xxs,
                  }}
                >
                  {Math.abs(stats.weightDelta).toFixed(1)} kg
                </Text>
              </View>
              {stats.weightSeries?.length > 0 && selectedWeightIndex !== null && (
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                    marginTop: spacing.xxs,
                  }}
                >
                  Selected:{" "}
                  {stats.weightSeries[selectedWeightIndex]?.weight.toFixed(1)} kg
                  {" • "}
                  {stats.weightSeries[selectedWeightIndex]?.date}
                </Text>
              )}
            </View>
            <View style={{ width: 100, height: 40 }}>
              <MiniSparkline
                data={stats.weightSeries}
                color={colors.secondary}
                selectedIndex={selectedWeightIndex}
                onPointPress={setSelectedWeightIndex}
              />
            </View>
          </View>
        </Animated.View>
      )}

      {/* CATEGORY BREAKDOWN */}
      {stats.categories.length > 0 && (
        <Animated.View
          entering={FadeInUp.delay(600).duration(400)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            marginBottom: spacing.md,
            ...shadows.sm,
          }}
        >
          <Text
            style={{
              ...typography.h3,
              color: colors.textPrimary,
              marginBottom: spacing.md,
            }}
          >
            Top Categories
          </Text>
          {stats.categories.map(([cat, count], i) => {
            const maxCount = stats.categories[0][1];
            const percentage = (count / maxCount) * 100;
            return (
              <View
                key={cat}
                style={{
                  marginBottom:
                    i < stats.categories.length - 1 ? spacing.sm : 0,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: spacing.xxs,
                  }}
                >
                  <Text
                    style={{
                      ...typography.bodyMedium,
                      color: colors.textPrimary,
                    }}
                  >
                    {cat}
                  </Text>
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.textSecondary,
                    }}
                  >
                    {count}
                  </Text>
                </View>
                <View
                  style={{
                    height: 6,
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: radius.full,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${percentage}%`,
                      height: "100%",
                      backgroundColor: colors.accent,
                      borderRadius: radius.full,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* AI INSIGHTS SECTION */}
      <Animated.View
        entering={FadeInUp.delay(700).duration(400)}
        style={{ marginBottom: spacing.xl }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <Ionicons name="bulb" size={20} color={colors.accent} />
          <Text
            style={{
              ...typography.h3,
              color: colors.textPrimary,
              marginLeft: spacing.xs,
            }}
          >
            Smart Insights
          </Text>
          {insights.length > 0 && (
            <View
              style={{
                backgroundColor: colors.accentDim,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                marginLeft: spacing.sm,
              }}
            >
              <Text
                style={{
                  ...typography.caption,
                  color: colors.accent,
                  fontWeight: "600",
                }}
              >
                {insights.length}
              </Text>
            </View>
          )}
        </View>

        {insights.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              alignItems: "center",
              ...shadows.sm,
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: radius.full,
                backgroundColor: colors.surfaceElevated,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              <Ionicons name="sparkles" size={28} color={colors.textMuted} />
            </View>
            <Text
              style={{
                ...typography.bodyMedium,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}
            >
              No Insights Yet
            </Text>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                textAlign: "center",
              }}
            >
              Log more workouts and body weights to unlock personalized insights
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {insights.map((insight, index) => (
              <InsightCardComponent
                key={insight.id}
                insight={insight}
                index={index}
                colors={colors}
                spacing={spacing}
                radius={radius}
                typography={typography}
                shadows={shadows}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

/* =========================
   HELPER COMPONENTS
   ========================= */

function ProgressRing({
  progress,
  size,
  strokeWidth,
  color,
  bgColor,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  bgColor: string;
}) {
  const center = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <Text style={{ fontSize: 16, fontWeight: "700", color }}>
        {Math.round(progress)}%
      </Text>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  colors,
  spacing,
  radius,
  shadows,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  suffix?: string;
  colors: any;
  spacing: any;
  radius: any;
  shadows: any;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "45%",
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadows.sm,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: colors.textPrimary,
          marginTop: spacing.xs,
        }}
      >
        {value}
        {suffix && (
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>
            {" "}
            {suffix}
          </Text>
        )}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function WeeklyBarChart({
  data,
  colors,
  spacing,
  radius,
}: {
  data: number[];
  colors: any;
  spacing: any;
  radius: any;
}) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const maxVal = Math.max(...data, 1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          height: 110,
        }}
      >
        {data.map((val, i) => {
          const height = (val / maxVal) * 70 + 10;
          const isToday = i === 6;
          const hasWorkouts = val > 0;
          const fillColor = isToday
            ? colors.accent
            : hasWorkouts
              ? colors.accentLight
              : colors.surfaceElevated;

          return (
            <WeeklyBarItem
              key={i}
              label={days[i]}
              height={height}
              color={fillColor}
              radius={radius}
              spacing={spacing}
              isToday={isToday}
              isSelected={selectedIndex === i}
              onPress={() => setSelectedIndex(i)}
              textColor={isToday ? colors.accent : colors.textMuted}
              highlightColor={colors.accent}
            />
          );
        })}
      </View>

      {selectedIndex !== null && (
        <Text
          style={{
            marginTop: spacing.xs,
            fontSize: 12,
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          {days[selectedIndex]} • {data[selectedIndex]} workout
          {data[selectedIndex] === 1 ? "" : "s"}
        </Text>
      )}
    </View>
  );
}

function WeeklyBarItem({
  label,
  height,
  color,
  radius,
  spacing,
  isToday,
  isSelected,
  onPress,
  textColor,
  highlightColor,
}: {
  label: string;
  height: number;
  color: string;
  radius: any;
  spacing: any;
  isToday: boolean;
  isSelected: boolean;
  onPress: () => void;
  textColor: string;
  highlightColor: string;
}) {
  const animatedHeight = useSharedValue(height);

  useEffect(() => {
    animatedHeight.value = withTiming(isSelected ? height + 8 : height, {
      duration: 180,
    });
  }, [height, isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flex: 1 }}>
      <View style={{ height: 90, justifyContent: "flex-end" }}>
        <Animated.View
          style={[
            {
              width: 24,
              backgroundColor: color,
              borderRadius: radius.sm,
              marginBottom: spacing.xs,
            },
            animatedStyle,
            isSelected && {
              shadowColor: highlightColor,
              shadowOpacity: 0.25,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            },
          ]}
        />
      </View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: isToday || isSelected ? "600" : "400",
          color: isToday || isSelected ? highlightColor : textColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MiniSparkline({
  data,
  color,
  selectedIndex,
  onPointPress,
}: {
  data: BodyWeight[];
  color: string;
  selectedIndex: number | null;
  onPointPress?: (index: number) => void;
}) {
  if (data.length < 2) return null;

  const width = 100;
  const height = 40;
  const padding = 4;

  const values = data.map((d) => d.weight);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = values.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((val - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  return (
    <Svg width={width} height={height}>
      <Path
        d={pathD}
        stroke={color}
        strokeWidth={2}
        fill="transparent"
        strokeLinecap="round"
      />
      {points.map((p, i) => {
        const [cx, cy] = p.split(",").map((v) => Number(v));
        const isSelected = i === selectedIndex;
        return (
          <G key={i}>
            <Circle
              cx={cx}
              cy={cy}
              r={isSelected ? 3.5 : 2.5}
              fill={color}
              stroke={isSelected ? "#fff" : "transparent"}
              strokeWidth={isSelected ? 1.5 : 0}
              onPress={() => onPointPress?.(i)}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={10}
              fill="transparent"
              onPress={() => onPointPress?.(i)}
            />
          </G>
        );
      })}
    </Svg>
  );
}

function InsightCardComponent({
  insight,
  index,
  colors,
  spacing,
  radius,
  typography,
  shadows,
}: {
  insight: Insight;
  index: number;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
  shadows: any;
}) {
  const getIconColor = (priority: InsightPriority) => {
    switch (priority) {
      case "high":
        return colors.accent;
      case "medium":
        return colors.secondary;
      default:
        return colors.textSecondary;
    }
  };

  const getIconBgColor = (priority: InsightPriority) => {
    switch (priority) {
      case "high":
        return colors.accentLight || colors.accentDim;
      case "medium":
        return colors.secondaryLight || colors.surfaceElevated;
      default:
        return colors.surfaceElevated;
    }
  };

  const getPriorityLabel = (priority: InsightPriority) => {
    switch (priority) {
      case "high":
        return { text: "Important", color: colors.accent };
      case "medium":
        return { text: "Notable", color: colors.secondary };
      default:
        return { text: "Tip", color: colors.textMuted };
    }
  };

  const priorityInfo = getPriorityLabel(insight.priority);

  return (
    <Animated.View entering={FadeInUp.delay(100 + index * 50).duration(300)}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor:
            insight.priority === "high" ? colors.accentDim : colors.cardBorder,
          overflow: "hidden",
          ...shadows.sm,
        }}
      >
        <LinearGradient
          colors={
            insight.priority === "high"
              ? [colors.accentDim || colors.surface, colors.surface]
              : [colors.surface, colors.surface]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: spacing.md }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* Icon */}
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.lg,
                backgroundColor: getIconBgColor(insight.priority),
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.md,
              }}
            >
              <Ionicons
                name={insight.icon as any}
                size={22}
                color={getIconColor(insight.priority)}
              />
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
              {/* Priority Badge */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: spacing.xxs,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: priorityInfo.color,
                    marginRight: spacing.xs,
                  }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "600",
                    color: priorityInfo.color,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {priorityInfo.text}
                </Text>
              </View>

              {/* Title */}
              <Text
                style={{
                  ...typography.bodyMedium,
                  color: colors.textPrimary,
                  marginBottom: spacing.xxs,
                }}
              >
                {insight.title}
              </Text>

              {/* Message */}
              <Text
                style={{
                  ...typography.body,
                  color: colors.textSecondary,
                  lineHeight: 20,
                }}
              >
                {insight.message}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

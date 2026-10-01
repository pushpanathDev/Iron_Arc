import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useAuth } from "../../auth/AuthContext";
import { WorkoutCalendar } from "../../components/ui/WorkoutCalendar";
import { WorkoutDaySummary } from "../../components/ui/WorkoutDaySummary";
import { useQueryClient } from "@tanstack/react-query";
import { useAllWorkouts } from "../../hooks/useWorkouts";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { Workout, workoutApi } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { createPageLogger } from "../../utils/logger";
import { displayWeight, weightLabel } from "../../utils/unitConversion";
import { formatDate } from "../../utils/weekUtils";

const log = createPageLogger("History");

const SWIPE_THRESHOLD = -60;
const DELETE_WIDTH = 80;
const SWIPE_ACTIVE_OFFSET = 12;
const SWIPE_FAIL_OFFSET_Y = 8;

type ViewMode = "calendar" | "list";

export default function History() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { data: workouts = [], isLoading, refetch } = useAllWorkouts();
  const queryClient = useQueryClient();
  const { unit } = useUnitPreference();

  const [deletedWorkout, setDeletedWorkout] = useState<Workout | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calendar state
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(
    formatDate(new Date()),
  );
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate total stats
  const totalSets = workouts.reduce((acc, w) => acc + (w.sets?.length || 0), 0);
  const totalVolumeKg = workouts.reduce((acc, w) => {
    return (
      acc + (w.sets?.reduce((s, set) => s + set.weight * set.reps, 0) || 0)
    );
  }, 0);
  const totalVolume = displayWeight(totalVolumeKg, unit);

  // Get all workout dates for calendar indicators
  const workoutDates = useMemo(() => {
    return [...new Set(workouts.map((w) => w.date))];
  }, [workouts]);

  // Get workouts for selected date
  const selectedDateWorkouts = useMemo(() => {
    if (!selectedDate) return [];
    return workouts.filter((w) => w.date === selectedDate);
  }, [workouts, selectedDate]);

  // Calendar navigation
  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  /* =========================
     PULL TO REFRESH
     ========================= */
  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncMessage(null);
    try {
      await refetch();
      setSyncMessage("Refreshed ✓");
      log.info("History refreshed");
    } catch (e) {
      log.error(`Refresh failed: ${e}`);
      setSyncMessage("Refresh failed");
    } finally {
      setRefreshing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  /* =========================
     DELETE + UNDO
     ========================= */
  const deleteWorkout = async (workout: Workout) => {
    if (refreshing || isDeleting) {
      setSyncMessage("Please wait...");
      return;
    }

    if (!user) {
      setSyncMessage("User not authenticated");
      return;
    }

    setIsDeleting(true);
    setDeletedWorkout(workout);

    // Optimistically remove from cache immediately so the UI updates
    queryClient.setQueryData<Workout[]>(["workouts", "all"], (old) =>
      old ? old.filter((w) => w.id !== workout.id) : [],
    );
    setIsDeleting(false);

    // Defer the actual API delete — fires only if undo is not tapped
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(async () => {
      try {
        await workoutApi.delete(workout.id);
        queryClient.invalidateQueries({ queryKey: ["workouts"] });
        log.info(`Deleted workout ${workout.id}`);
      } catch (error) {
        // Restore the item in the cache on failure
        queryClient.setQueryData<Workout[]>(["workouts", "all"], (old) =>
          old ? [...old, workout].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ) : [workout],
        );
        setSyncMessage("Failed to delete workout");
        log.error("Delete failed", error);
      }
      setDeletedWorkout(null);
    }, 4500);
  };

  const undoDelete = () => {
    if (!deletedWorkout) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    // Restore the item to the cache — real undo
    queryClient.setQueryData<Workout[]>(["workouts", "all"], (old) =>
      old
        ? [...old, deletedWorkout].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
        : [deletedWorkout],
    );
    setDeletedWorkout(null);
    log.info(`Undo: restored workout ${deletedWorkout.id}`);
  };

  // Group workouts by date
  const groupedWorkouts = workouts.reduce(
    (groups, workout) => {
      const date = workout.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(workout);
      return groups;
    },
    {} as Record<string, Workout[]>,
  );

  const sortedDates = Object.keys(groupedWorkouts).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
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
                  ...typography.h1,
                  color: colors.textPrimary,
                  marginBottom: spacing.xs,
                }}
              >
                History
              </Text>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>
                {workouts.length} workouts logged • Pull to refresh
              </Text>
            </View>

            {/* View Mode Toggle */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.lg,
                padding: 4,
              }}
            >
              <Pressable
                onPress={() => setViewMode("calendar")}
                style={{
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor:
                    viewMode === "calendar" ? colors.accent : "transparent",
                }}
              >
                <Ionicons
                  name="calendar"
                  size={18}
                  color={
                    viewMode === "calendar"
                      ? colors.textOnAccent
                      : colors.textSecondary
                  }
                />
              </Pressable>
              <Pressable
                onPress={() => setViewMode("list")}
                style={{
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor:
                    viewMode === "list" ? colors.accent : "transparent",
                }}
              >
                <Ionicons
                  name="list"
                  size={18}
                  color={
                    viewMode === "list"
                      ? colors.textOnAccent
                      : colors.textSecondary
                  }
                />
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* QUICK STATS */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={{
            flexDirection: "row",
            marginTop: spacing.lg,
            marginBottom: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              ...shadows.sm,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.xs,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  backgroundColor: colors.accentLight,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: spacing.xs,
                }}
              >
                <Ionicons name="fitness" size={16} color={colors.accent} />
              </View>
            </View>
            <Text style={{ ...typography.stat, color: colors.textPrimary }}>
              {totalSets}
            </Text>
            <Text
              style={{ ...typography.caption, color: colors.textSecondary }}
            >
              Total Sets
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              ...shadows.sm,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.xs,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  backgroundColor: colors.secondaryLight,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: spacing.xs,
                }}
              >
                <Ionicons
                  name="trending-up"
                  size={16}
                  color={colors.secondary}
                />
              </View>
            </View>
            <Text style={{ ...typography.stat, color: colors.textPrimary }}>
              {totalVolume >= 1000
                ? `${(totalVolume / 1000).toFixed(1)}k`
                : totalVolume}
            </Text>
            <Text
              style={{ ...typography.caption, color: colors.textSecondary }}
            >
              Volume ({weightLabel(unit)})
            </Text>
          </View>
        </Animated.View>

        {/* SYNC STATUS */}
        {syncMessage && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={{
              backgroundColor: syncMessage.includes("failed")
                ? colors.errorLight
                : colors.successLight,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.lg,
              marginBottom: spacing.md,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons
              name={
                syncMessage.includes("failed")
                  ? "close-circle"
                  : "checkmark-circle"
              }
              size={18}
              color={
                syncMessage.includes("failed") ? colors.error : colors.success
              }
              style={{ marginRight: spacing.xs }}
            />
            <Text
              style={{
                ...typography.caption,
                color: syncMessage.includes("failed")
                  ? colors.error
                  : colors.success,
              }}
            >
              {syncMessage}
            </Text>
          </Animated.View>
        )}

        {/* EMPTY STATE */}
        {workouts.length === 0 && !refreshing && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={{
              alignItems: "center",
              paddingVertical: spacing.xxl,
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={{
                width: 80,
                height: 80,
                borderRadius: radius.full,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              <Ionicons name="barbell-outline" size={40} color="#fff" />
            </LinearGradient>
            <Text
              style={{
                ...typography.h3,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}
            >
              No workouts yet
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                textAlign: "center",
              }}
            >
              Start logging to see{"\n"}your progress here
            </Text>
          </Animated.View>
        )}

        {/* CALENDAR VIEW */}
        {viewMode === "calendar" && workouts.length > 0 && (
          <Animated.View entering={FadeInUp.delay(150).duration(400)}>
            {/* Calendar */}
            <WorkoutCalendar
              workoutDates={workoutDates}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              currentMonth={currentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />

            {/* Day Summary */}
            <View style={{ marginTop: spacing.md }}>
              <WorkoutDaySummary
                date={selectedDate || formatDate(new Date())}
                workouts={selectedDateWorkouts}
              />
            </View>

            {/* Swipeable workout list for selected date - for delete functionality */}
            {selectedDateWorkouts.length > 0 && (
              <View style={{ marginTop: spacing.lg }}>
                <View style={{ marginBottom: spacing.md }}>
                  <Text
                    style={{
                      ...typography.label,
                      color: colors.textPrimary,
                      marginBottom: spacing.sm,
                      marginLeft: spacing.xs,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    WORKOUTS
                  </Text>
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.textSecondary,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Swipe left to delete or tap to edit
                  </Text>
                </View>
                {selectedDateWorkouts.map((workout, index) => (
                  <SwipeRow
                    key={workout.id}
                    workout={workout}
                    onDelete={() => deleteWorkout(workout)}
                    onEdit={() =>
                      router.push({
                        pathname: "/add-workout",
                        params: { id: workout.id },
                      })
                    }
                    index={index}
                    disabled={refreshing || isDeleting}
                    weightUnit={unit}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" &&
          workouts.length > 0 &&
          sortedDates.map((date, dateIndex) => (
            <Animated.View
              key={date}
              entering={FadeInUp.delay(200 + dateIndex * 50).duration(400)}
              style={{ marginBottom: spacing.lg }}
            >
              {/* Date Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.accent,
                    marginRight: spacing.sm,
                  }}
                />
                <Text
                  style={{ ...typography.label, color: colors.textSecondary }}
                >
                  {formatDateLabel(date)}
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: colors.divider,
                    marginLeft: spacing.sm,
                  }}
                />
              </View>

              {/* Workouts for this date */}
              {groupedWorkouts[date].map((workout, index) => (
                <SwipeRow
                  key={workout.id}
                  workout={workout}
                  onDelete={() => deleteWorkout(workout)}
                  onEdit={() =>
                    router.push({
                      pathname: "/add-workout",
                      params: { id: workout.id },
                    })
                  }
                  index={index}
                  disabled={refreshing || isDeleting}
                  weightUnit={unit}
                />
              ))}
            </Animated.View>
          ))}
      </ScrollView>

      {/* UNDO TOAST */}
      {deletedWorkout && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={{
            position: "absolute",
            bottom: spacing.lg,
            left: spacing.md,
            right: spacing.md,
            backgroundColor: colors.surface,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.xl,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.cardBorder,
            ...shadows.lg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: colors.errorLight,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </View>
            <Text
              style={{ ...typography.bodyMedium, color: colors.textPrimary }}
            >
              Workout deleted
            </Text>
          </View>

          <Pressable
            onPress={undoDelete}
            style={{
              backgroundColor: colors.accent,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
              UNDO
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

/* =========================
   HELPER FUNCTIONS
   ========================= */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00"); // Force local timezone
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(yesterday);

  if (dateStr === todayStr) {
    return "TODAY";
  } else if (dateStr === yesterdayStr) {
    return "YESTERDAY";
  } else {
    return date
      .toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      .toUpperCase();
  }
}

/* =========================
   SWIPE ROW
   ========================= */
function SwipeRow({
  workout,
  onDelete,
  onEdit,
  index,
  disabled = false,
  weightUnit = "kg",
}: {
  workout: Workout;
  onDelete: () => void;
  onEdit: () => void;
  index: number;
  disabled?: boolean;
  weightUnit?: "kg" | "lbs";
}) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    // Require a more deliberate horizontal swipe.
    // If the user is mostly scrolling vertically, fail this gesture so ScrollView wins.
    .activeOffsetX([-SWIPE_ACTIVE_OFFSET, SWIPE_ACTIVE_OFFSET])
    .failOffsetY([-SWIPE_FAIL_OFFSET_Y, SWIPE_FAIL_OFFSET_Y])
    .onUpdate((e) => {
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd(() => {
      translateX.value =
        translateX.value < SWIPE_THRESHOLD
          ? withTiming(-DELETE_WIDTH)
          : withTiming(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const totalVolumeKg =
    workout.sets?.reduce((acc, s) => acc + s.weight * s.reps, 0) || 0;
  const rowVolume = displayWeight(totalVolumeKg, weightUnit);
  const totalReps = workout.sets?.reduce((acc, s) => acc + s.reps, 0) || 0;

  return (
    <View
      style={{
        marginBottom: spacing.md,
        borderRadius: radius.xl,
        overflow: "hidden",
        ...shadows.sm,
      }}
    >
      {/* DELETE ACTION */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: DELETE_WIDTH,
          backgroundColor: colors.error,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Pressable onPress={onDelete} style={{ padding: spacing.md }}>
          <Ionicons name="trash" size={22} color="#FFF" />
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            animatedStyle,
            {
              backgroundColor: colors.surface,
              padding: spacing.md,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              ...shadows.md,
            },
          ]}
        >
          <Pressable onPress={onEdit} disabled={disabled}>
          {/* Exercise Name & Category */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.h3,
                  color: colors.textPrimary,
                  marginBottom: spacing.xxs,
                }}
              >
                {workout.exercise}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    paddingVertical: 2,
                    paddingHorizontal: spacing.xs,
                    backgroundColor: colors.accentLight,
                    borderRadius: radius.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: colors.accent,
                    }}
                  >
                    {workout.category}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={{ alignItems: "flex-end" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 2,
                  paddingHorizontal: spacing.xs,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceElevated,
                  marginBottom: spacing.xs,
                }}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: colors.textSecondary,
                    marginLeft: 4,
                  }}
                >
                  EDIT
                </Text>
              </View>
              <Text style={{ ...typography.h3, color: colors.accent }}>
                {rowVolume.toLocaleString()}
              </Text>
              <Text
                style={{ ...typography.caption, color: colors.textSecondary }}
              >
                {weightLabel(weightUnit)} volume
              </Text>
            </View>
          </View>

          {/* Sets */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.xs,
            }}
          >
            {workout.sets?.map((set, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: colors.surfaceElevated,
                  paddingVertical: spacing.xxs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.md,
                }}
              >
                <Text
                  style={{ ...typography.caption, color: colors.textPrimary }}
                >
                  {set.reps}×{displayWeight(set.weight, weightUnit)}{weightLabel(weightUnit)}
                </Text>
              </View>
            ))}
          </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

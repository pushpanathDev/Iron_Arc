import { Workout } from "@/db/workouts";
import { useTheme } from "@/theme/theme";
import {
  calculateDaySummary,
  formatSetDetails,
  formatVolume,
  groupWorkoutsBySession,
} from "@/utils/workoutSummary";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

interface WorkoutDaySummaryProps {
  date: string;
  workouts: Workout[];
}

export function WorkoutDaySummary({ date, workouts }: WorkoutDaySummaryProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();

  // Memoize summary calculations to optimize performance
  const summary = useMemo(() => {
    return calculateDaySummary(workouts);
  }, [workouts]);

  const sessions = useMemo(() => {
    return groupWorkoutsBySession(workouts);
  }, [workouts]);

  // Format display date
  const displayDate = useMemo(() => formatDisplayDate(date), [date]);

  if (workouts.length === 0) {
    return (
      <Animated.View
        entering={FadeInUp.duration(300)}
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            padding: spacing.lg,
            ...shadows.sm,
          },
        ]}
      >
        <View style={styles.emptyState}>
          <View
            style={[
              styles.emptyIcon,
              {
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.lg,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={28}
              color={colors.textMuted}
            />
          </View>
          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: spacing.sm,
              },
            ]}
          >
            No workouts on this day
          </Text>
          <Text
            style={[
              typography.caption,
              {
                color: colors.textMuted,
                textAlign: "center",
                marginTop: spacing.xxs,
              },
            ]}
          >
            Select a day with a green dot to view workouts
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 2,
          borderColor: colors.accent,
          overflow: "hidden",
          ...shadows.lg,
        },
      ]}
    >
      {/* HEADER - Day Summary Label */}
      <View
        style={{
          backgroundColor: colors.accent,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="star" size={18} color="#fff" />
        <Text
          style={{
            color: "#fff",
            fontWeight: "700",
            fontSize: 12,
            marginLeft: spacing.sm,
            letterSpacing: 1,
          }}
        >
          DAY SUMMARY
        </Text>
      </View>

      {/* Header Section */}
      <View
        style={[
          styles.header,
          {
            padding: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
            backgroundColor: colors.surfaceElevated,
          },
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>
              {displayDate}
            </Text>
            <View
              style={[styles.categoryTags, { marginTop: spacing.xs }]}
            >
              {summary.categories.map((cat) => (
                <View
                  key={cat}
                  style={[
                    styles.categoryTag,
                    {
                      backgroundColor: colors.accentDim,
                      borderRadius: radius.sm,
                      paddingVertical: 2,
                      paddingHorizontal: spacing.xs,
                      marginRight: spacing.xs,
                      marginBottom: spacing.xs,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: colors.accent,
                    }}
                  >
                    {cat}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <Text
                style={[
                  typography.stat,
                  { color: colors.accent, fontWeight: "700" },
                ]}
              >
                {formatVolume(summary.totalVolume)}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, fontSize: 10 },
                ]}
              >
                volume
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Insights Section */}
      {summary.insights.length > 0 && (
        <View
          style={[
            styles.insightsSection,
            {
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
              backgroundColor: colors.background,
            },
          ]}
        >
          {summary.insights.map((insight, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginVertical: spacing.xs,
              }}
            >
              <Ionicons
                name={insight.icon as any}
                size={14}
                color={insight.highlight ? colors.success : colors.accent}
                style={{ marginRight: spacing.xs }}
              />
              <Text
                style={[
                  typography.caption,
                  {
                    color: insight.highlight
                      ? colors.success
                      : colors.textSecondary,
                    fontWeight: insight.highlight ? "600" : "400",
                    flex: 1,
                  },
                ]}
              >
                {insight.message}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Summary Stats */}
      <View
        style={[
          styles.summaryStats,
          {
            flexDirection: "row",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.statChip}>
          <Ionicons
            name="layers-outline"
            size={14}
            color={colors.accent}
          />
          <Text
            style={[
              typography.caption,
              {
                color: colors.textPrimary,
                fontWeight: "600",
                marginLeft: spacing.xs,
              },
            ]}
          >
            {summary.totalSets} Sets
          </Text>
        </View>
        <View style={[styles.statChip, { marginLeft: spacing.md }]}>
          <Ionicons
            name="repeat-outline"
            size={14}
            color={colors.accent}
          />
          <Text
            style={[
              typography.caption,
              {
                color: colors.textPrimary,
                fontWeight: "600",
                marginLeft: spacing.xs,
              },
            ]}
          >
            {summary.totalReps} Reps
          </Text>
        </View>
        <View style={[styles.statChip, { marginLeft: spacing.md }]}>
          <Ionicons
            name="barbell-outline"
            size={14}
            color={colors.accent}
          />
          <Text
            style={[
              typography.caption,
              {
                color: colors.textPrimary,
                fontWeight: "600",
                marginLeft: spacing.xs,
              },
            ]}
          >
            {summary.totalExercises} Ex
          </Text>
        </View>
      </View>

      {/* Sessions and Exercises */}
      <View style={{ padding: spacing.md }}>
        {sessions.map((session, sessionIdx) => (
          <View key={session.sessionId} style={{ marginBottom: spacing.md }}>
            {/* Session Header */}
            {sessions.length > 1 && (
              <View
                style={[
                  styles.sessionHeader,
                  {
                    backgroundColor: colors.accentLight,
                    borderLeftWidth: 3,
                    borderLeftColor: colors.accent,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.sm,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <Ionicons
                  name="folder-outline"
                  size={14}
                  color={colors.accent}
                />
                <Text
                  style={[
                    typography.label,
                    {
                      color: colors.accent,
                      marginLeft: spacing.xs,
                      fontSize: 12,
                    },
                  ]}
                >
                  {session.sessionId} Session
                </Text>
              </View>
            )}

            {/* Exercise Table */}
            <View
              style={[
                styles.exerciseTable,
                { borderRadius: radius.md, overflow: "hidden" },
              ]}
            >
              {/* Table Header */}
              <View
                style={[
                  styles.tableRow,
                  styles.tableHeader,
                  {
                    backgroundColor: colors.surfaceElevated,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cellExercise,
                    typography.caption,
                    {
                      color: colors.textMuted,
                      fontWeight: "700",
                      fontSize: 10,
                    },
                  ]}
                >
                  EXERCISE
                </Text>
                <Text
                  style={[
                    styles.cellSets,
                    typography.caption,
                    {
                      color: colors.textMuted,
                      fontWeight: "700",
                      fontSize: 10,
                      textAlign: "right",
                    },
                  ]}
                >
                  SETS
                </Text>
                <Text
                  style={[
                    styles.cellWeight,
                    typography.caption,
                    {
                      color: colors.textMuted,
                      fontWeight: "700",
                      fontSize: 10,
                      textAlign: "right",
                    },
                  ]}
                >
                  AVG
                </Text>
              </View>

              {/* Exercise Rows */}
              {session.exercises.map((exercise, exIdx) => (
                <Animated.View
                  key={exercise.exerciseName}
                  entering={FadeInUp.delay((sessionIdx * 50 + exIdx * 30)).duration(300)}
                  style={[
                    styles.tableRow,
                    {
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.sm,
                      borderBottomWidth:
                        exIdx < session.exercises.length - 1 ? 1 : 0,
                      borderBottomColor: colors.divider,
                    },
                  ]}
                >
                  <View style={styles.cellExercise}>
                    <Text
                      style={[
                        typography.bodyMedium,
                        {
                          color: colors.textPrimary,
                          fontWeight: "600",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {exercise.exerciseName}
                    </Text>
                    {/* Set breakdown */}
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: colors.textMuted,
                          marginTop: spacing.xxs,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {formatSetDetails(exercise.setDetails)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.cellSets,
                      typography.bodyMedium,
                      {
                        color: colors.accent,
                        fontWeight: "700",
                        textAlign: "right",
                      },
                    ]}
                  >
                    {exercise.totalSets}
                  </Text>
                  <Text
                    style={[
                      styles.cellWeight,
                      typography.bodyMedium,
                      {
                        color: colors.accent,
                        fontWeight: "700",
                        textAlign: "right",
                      },
                    ]}
                  >
                    {exercise.avgWeight}kg
                  </Text>
                </Animated.View>
              ))}

              {/* Session Summary */}
              {sessions.length > 1 && (
                <View
                  style={[
                    styles.tableRow,
                    {
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      backgroundColor: colors.accentLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: colors.accent,
                        fontWeight: "700",
                        flex: 1,
                      },
                    ]}
                  >
                    Session Total
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: colors.accent,
                        fontWeight: "700",
                        textAlign: "right",
                      },
                    ]}
                  >
                    {session.totalSets}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: colors.accent,
                        fontWeight: "700",
                        textAlign: "right",
                      },
                    ]}
                  >
                    {formatVolume(session.totalVolume)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateStr === todayStr) {
    return "Today's Workout";
  } else if (dateStr === yesterdayStr) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  categoryTags: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryTag: {
    marginRight: 6,
    marginBottom: 4,
  },
  quickStats: {
    justifyContent: "flex-end",
  },
  statItem: {
    alignItems: "center",
  },
  insightsSection: {
    marginVertical: 2,
  },
  summaryStats: {
    alignItems: "center",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  exerciseTable: {
    borderWidth: 1,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tableHeader: {
    justifyContent: "space-between",
  },
  cellExercise: {
    flex: 1,
  },
  cellSets: {
    width: 45,
  },
  cellWeight: {
    width: 65,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});




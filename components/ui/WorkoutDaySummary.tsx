import { Workout } from "@/db/workouts";
import { useTheme } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

interface WorkoutDaySummaryProps {
  date: string;
  workouts: Workout[];
}

export function WorkoutDaySummary({ date, workouts }: WorkoutDaySummaryProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();

  // Format display date
  const displayDate = formatDisplayDate(date);

  // Calculate totals
  const totalSets = workouts.reduce((acc, w) => acc + (w.sets?.length || 0), 0);
  const totalReps = workouts.reduce(
    (acc, w) => acc + (w.sets?.reduce((s, set) => s + set.reps, 0) || 0),
    0,
  );
  const totalVolume = workouts.reduce(
    (acc, w) =>
      acc + (w.sets?.reduce((s, set) => s + set.reps * set.weight, 0) || 0),
    0,
  );

  // Group by category
  const categories = [...new Set(workouts.map((w) => w.category || "Other"))];

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
            Select a day with a green dot
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
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.card,
        },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            padding: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <View>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            {displayDate}
          </Text>
          <View style={[styles.categoryTags, { marginTop: spacing.xs }]}>
            {categories.map((cat) => (
              <View
                key={cat}
                style={[
                  styles.categoryTag,
                  {
                    backgroundColor: colors.accentDim,
                    borderRadius: radius.sm,
                    paddingVertical: 2,
                    paddingHorizontal: spacing.xs,
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
            <Text style={[typography.stat, { color: colors.accent }]}>
              {totalVolume >= 1000
                ? `${(totalVolume / 1000).toFixed(1)}k`
                : totalVolume}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              kg vol
            </Text>
          </View>
        </View>
      </View>

      {/* Exercise Table */}
      <View style={[styles.table, { padding: spacing.md }]}>
        {/* Table Header */}
        <View
          style={[
            styles.tableRow,
            styles.tableHeader,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <Text
            style={[
              styles.cellExercise,
              typography.caption,
              { color: colors.textMuted, fontWeight: "600" },
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
                fontWeight: "600",
                textAlign: "center",
              },
            ]}
          >
            SETS
          </Text>
          <Text
            style={[
              styles.cellReps,
              typography.caption,
              {
                color: colors.textMuted,
                fontWeight: "600",
                textAlign: "center",
              },
            ]}
          >
            REPS
          </Text>
          <Text
            style={[
              styles.cellWeight,
              typography.caption,
              {
                color: colors.textMuted,
                fontWeight: "600",
                textAlign: "right",
              },
            ]}
          >
            AVG KG
          </Text>
        </View>

        {/* Exercise Rows */}
        {workouts.map((workout, index) => {
          const sets = workout.sets?.length || 0;
          const reps = workout.sets?.reduce((acc, s) => acc + s.reps, 0) || 0;
          const avgWeight =
            sets > 0
              ? Math.round(
                  workout.sets!.reduce((acc, s) => acc + s.weight, 0) / sets,
                )
              : 0;

          return (
            <Animated.View
              key={workout.id}
              entering={FadeInUp.delay(index * 50).duration(200)}
              style={[
                styles.tableRow,
                {
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.sm,
                  borderBottomWidth: index < workouts.length - 1 ? 1 : 0,
                  borderBottomColor: colors.divider,
                },
              ]}
            >
              <View style={styles.cellExercise}>
                <Text
                  style={[typography.bodyMedium, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {workout.exercise}
                </Text>
                {/* Set breakdown */}
                <View style={[styles.setBreakdown, { marginTop: spacing.xxs }]}>
                  {workout.sets?.slice(0, 4).map((set, i) => (
                    <Text
                      key={i}
                      style={[
                        typography.caption,
                        { color: colors.textMuted, marginRight: spacing.xs },
                      ]}
                    >
                      {set.reps}×{set.weight}
                    </Text>
                  ))}
                  {(workout.sets?.length || 0) > 4 && (
                    <Text
                      style={[typography.caption, { color: colors.textMuted }]}
                    >
                      +{workout.sets!.length - 4}
                    </Text>
                  )}
                </View>
              </View>
              <Text
                style={[
                  styles.cellSets,
                  typography.bodyMedium,
                  { color: colors.textPrimary, textAlign: "center" },
                ]}
              >
                {sets}
              </Text>
              <Text
                style={[
                  styles.cellReps,
                  typography.bodyMedium,
                  { color: colors.textPrimary, textAlign: "center" },
                ]}
              >
                {reps}
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
                {avgWeight}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      {/* Footer Summary */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surfaceElevated,
            padding: spacing.md,
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
          },
        ]}
      >
        <View style={styles.footerStats}>
          <View style={styles.footerStatItem}>
            <Ionicons
              name="layers-outline"
              size={16}
              color={colors.textMuted}
            />
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginLeft: spacing.xxs },
              ]}
            >
              {totalSets} sets
            </Text>
          </View>
          <View style={[styles.footerStatItem, { marginLeft: spacing.md }]}>
            <Ionicons
              name="repeat-outline"
              size={16}
              color={colors.textMuted}
            />
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginLeft: spacing.xxs },
              ]}
            >
              {totalReps} reps
            </Text>
          </View>
          <View style={[styles.footerStatItem, { marginLeft: spacing.md }]}>
            <Ionicons
              name="fitness-outline"
              size={16}
              color={colors.textMuted}
            />
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginLeft: spacing.xxs },
              ]}
            >
              {workouts.length} exercises
            </Text>
          </View>
        </View>
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
    return "Today";
  } else if (dateStr === yesterdayStr) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
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
    gap: 6,
  },
  categoryTag: {},
  quickStats: {
    alignItems: "flex-end",
  },
  statItem: {
    alignItems: "flex-end",
  },
  table: {},
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tableHeader: {},
  cellExercise: {
    flex: 2,
  },
  cellSets: {
    width: 45,
  },
  cellReps: {
    width: 45,
  },
  cellWeight: {
    width: 55,
  },
  setBreakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  footer: {},
  footerStats: {
    flexDirection: "row",
    justifyContent: "center",
  },
  footerStatItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
});

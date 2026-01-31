import { useTheme } from "@/theme/theme";
import { formatDate } from "@/utils/weekUtils";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

interface WorkoutCalendarProps {
  workoutDates: string[]; // Array of "YYYY-MM-DD" dates with workouts
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WorkoutCalendar({
  workoutDates,
  selectedDate,
  onSelectDate,
  currentMonth,
  onPrevMonth,
  onNextMonth,
}: WorkoutCalendarProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();

  // Create set of workout dates for O(1) lookup
  const workoutDateSet = useMemo(() => new Set(workoutDates), [workoutDates]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: { date: Date; isCurrentMonth: boolean; dateStr: string }[] = [];
    const current = new Date(startDate);

    // Generate 6 weeks (42 days) to ensure we cover all possibilities
    for (let i = 0; i < 42; i++) {
      // Use local date formatting to avoid timezone issues
      const dateStr = formatDate(current);
      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        dateStr,
      });
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth]);

  // Get today's date string for comparison (using local time)
  const today = formatDate(new Date());

  // Format month name
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
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
      {/* Month Header */}
      <View
        style={[
          styles.header,
          { paddingHorizontal: spacing.md, paddingTop: spacing.md },
        ]}
      >
        <Pressable
          onPress={onPrevMonth}
          style={[
            styles.navButton,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <Text style={[typography.h3, { color: colors.textPrimary }]}>
          {monthName}
        </Text>

        <Pressable
          onPress={onNextMonth}
          style={[
            styles.navButton,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
            },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textPrimary}
          />
        </Pressable>
      </View>

      {/* Day Headers */}
      <View
        style={[
          styles.dayHeaders,
          { paddingHorizontal: spacing.sm, marginTop: spacing.md },
        ]}
      >
        {DAYS.map((day) => (
          <View key={day} style={styles.dayHeaderCell}>
            <Text
              style={[
                typography.caption,
                { color: colors.textMuted, fontWeight: "600" },
              ]}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={[styles.grid, { padding: spacing.sm }]}>
        {calendarDays.map((day, index) => {
          const hasWorkout = workoutDateSet.has(day.dateStr);
          const isSelected = selectedDate === day.dateStr;
          const isToday = day.dateStr === today;

          return (
            <Pressable
              key={index}
              onPress={() => day.isCurrentMonth && onSelectDate(day.dateStr)}
              style={[
                styles.dayCell,
                {
                  backgroundColor: isSelected
                    ? colors.accent
                    : isToday
                      ? colors.accentDim
                      : "transparent",
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  {
                    color: isSelected
                      ? colors.textOnAccent
                      : day.isCurrentMonth
                        ? colors.textPrimary
                        : colors.textMuted,
                    fontWeight: isToday || isSelected ? "700" : "500",
                  },
                ]}
              >
                {day.date.getDate()}
              </Text>

              {/* Workout Indicator Dot */}
              {hasWorkout && !isSelected && (
                <View
                  style={[
                    styles.workoutDot,
                    {
                      backgroundColor: colors.accent,
                    },
                  ]}
                />
              )}
              {hasWorkout && isSelected && (
                <View
                  style={[
                    styles.workoutDot,
                    {
                      backgroundColor: colors.textOnAccent,
                    },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      <View
        style={[
          styles.legend,
          {
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            padding: spacing.sm,
            marginTop: spacing.xs,
          },
        ]}
      >
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.accent }]}
          />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Workout logged
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendBox,
              { backgroundColor: colors.accentDim, borderRadius: radius.sm },
            ]}
          />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Today
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  dayHeaders: {
    flexDirection: "row",
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%", // 100% / 7 days
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  dayText: {
    fontSize: 14,
  },
  workoutDot: {
    position: "absolute",
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendBox: {
    width: 14,
    height: 14,
  },
});

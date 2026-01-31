import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/theme";
import { Insight, InsightPriority } from "@/insights/insightEngine";

interface InsightCardProps {
  insight: Insight;
  index: number;
  onPress?: () => void;
}

export function InsightCard({ insight, index, onPress }: InsightCardProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();

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

  const getBackgroundGradient = (priority: InsightPriority): [string, string] => {
    switch (priority) {
      case "high":
        return [colors.accentDim, colors.surface];
      case "medium":
        return [colors.secondaryLight, colors.surface];
      default:
        return [colors.surfaceElevated, colors.surface];
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(100 + index * 50).duration(300)}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            ...shadows.sm,
          },
        ]}
      >
        <LinearGradient
          colors={getBackgroundGradient(insight.priority)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderRadius: radius.xl - 1 }]}
        >
          <View style={[styles.content, { padding: spacing.md }]}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: insight.priority === "high" 
                    ? colors.accentLight 
                    : colors.surfaceElevated,
                  borderRadius: radius.lg,
                  padding: spacing.sm,
                },
              ]}
            >
              <Ionicons
                name={insight.icon as any}
                size={22}
                color={getIconColor(insight.priority)}
              />
            </View>

            {/* Text */}
            <View style={styles.textContainer}>
              <Text
                style={[
                  typography.bodyMedium,
                  { color: colors.textPrimary, marginBottom: spacing.xxs },
                ]}
                numberOfLines={1}
              >
                {insight.title}
              </Text>
              <Text
                style={[typography.caption, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {insight.message}
              </Text>
            </View>

            {/* Priority Badge */}
            {insight.priority === "high" && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.accent,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.xs,
                    paddingVertical: 2,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    color: colors.textOnAccent,
                  }}
                >
                  NEW
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

interface InsightsListProps {
  insights: Insight[];
  maxVisible?: number;
  onViewAll?: () => void;
}

export function InsightsList({ insights, maxVisible = 3, onViewAll }: InsightsListProps) {
  const { colors, spacing, typography } = useTheme();
  const visibleInsights = insights.slice(0, maxVisible);

  if (insights.length === 0) {
    return null;
  }

  return (
    <View>
      {/* Header */}
      <View style={[styles.header, { marginBottom: spacing.sm }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="bulb" size={18} color={colors.accent} />
          <Text
            style={[
              typography.label,
              { color: colors.textPrimary, marginLeft: spacing.xs },
            ]}
          >
            INSIGHTS
          </Text>
        </View>
        {insights.length > maxVisible && onViewAll && (
          <Pressable onPress={onViewAll}>
            <Text style={[typography.caption, { color: colors.accent }]}>
              View All ({insights.length})
            </Text>
          </Pressable>
        )}
      </View>

      {/* Insights */}
      <View style={{ gap: spacing.sm }}>
        {visibleInsights.map((insight, index) => (
          <InsightCard key={insight.id} insight={insight} index={index} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  badge: {
    marginLeft: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
});

import { Achievement, TIER_COLORS } from "@/insights/achievements";
import { useTheme } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: "small" | "medium" | "large";
  showProgress?: boolean;
  index?: number;
}

export function AchievementBadge({
  achievement,
  size = "medium",
  showProgress = true,
  index = 0,
}: AchievementBadgeProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const tierColor = TIER_COLORS[achievement.tier];
  const isUnlocked = !!achievement.unlockedAt;
  const progress = achievement.progress || 0;

  const sizeConfig = {
    small: { badge: 48, icon: 20, font: 10 },
    medium: { badge: 64, icon: 26, font: 12 },
    large: { badge: 80, icon: 32, font: 14 },
  };

  const config = sizeConfig[size];

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(300)}
      style={styles.badgeContainer}
    >
      {/* Badge Circle */}
      <View
        style={[
          styles.badge,
          {
            width: config.badge,
            height: config.badge,
            borderRadius: config.badge / 2,
            backgroundColor: isUnlocked ? tierColor.bg : colors.surfaceElevated,
            borderWidth: 3,
            borderColor: isUnlocked ? tierColor.bg : colors.border,
            opacity: isUnlocked ? 1 : 0.5,
          },
        ]}
      >
        {isUnlocked ? (
          <Ionicons
            name={achievement.icon as any}
            size={config.icon}
            color={tierColor.text}
          />
        ) : (
          <View style={styles.lockedOverlay}>
            <Ionicons
              name={achievement.icon as any}
              size={config.icon}
              color={colors.textMuted}
            />
            {/* Progress Ring */}
            {showProgress && progress > 0 && progress < 100 && (
              <View
                style={[
                  styles.progressRing,
                  {
                    width: config.badge + 6,
                    height: config.badge + 6,
                    borderRadius: (config.badge + 6) / 2,
                    borderWidth: 3,
                    borderColor: colors.accent,
                    borderTopColor: "transparent",
                    borderRightColor: "transparent",
                    transform: [{ rotate: `${(progress / 100) * 360}deg` }],
                  },
                ]}
              />
            )}
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        style={[
          { fontSize: config.font, fontWeight: "600" },
          { color: isUnlocked ? colors.textPrimary : colors.textMuted },
          { marginTop: spacing.xs, textAlign: "center" },
        ]}
        numberOfLines={2}
      >
        {achievement.title}
      </Text>

      {/* Progress */}
      {!isUnlocked && showProgress && (
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, fontSize: 10 },
          ]}
        >
          {achievement.current || 0}/{achievement.requirement}
        </Text>
      )}
    </Animated.View>
  );
}

interface AchievementCardProps {
  achievement: Achievement;
  onPress?: () => void;
}

export function AchievementCard({
  achievement,
  onPress,
}: AchievementCardProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const tierColor = TIER_COLORS[achievement.tier];
  const isUnlocked = !!achievement.unlockedAt;
  const progress = achievement.progress || 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: isUnlocked ? tierColor.bg : colors.cardBorder,
          opacity: pressed ? 0.9 : 1,
          ...shadows.sm,
        },
      ]}
    >
      <View style={[styles.cardContent, { padding: spacing.md }]}>
        {/* Badge */}
        <View
          style={[
            styles.cardBadge,
            {
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: isUnlocked
                ? tierColor.bg
                : colors.surfaceElevated,
            },
          ]}
        >
          <Ionicons
            name={achievement.icon as any}
            size={24}
            color={isUnlocked ? tierColor.text : colors.textMuted}
          />
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text
            style={[typography.bodyMedium, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {achievement.title}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {achievement.description}
          </Text>

          {/* Progress Bar */}
          {!isUnlocked && (
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: radius.sm,
                  marginTop: spacing.xs,
                },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress}%`,
                    backgroundColor: colors.accent,
                    borderRadius: radius.sm,
                  },
                ]}
              />
            </View>
          )}
        </View>

        {/* Status */}
        <View style={styles.cardStatus}>
          {isUnlocked ? (
            <View
              style={[
                styles.unlockedBadge,
                {
                  backgroundColor: tierColor.bg,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.xs,
                  paddingVertical: 2,
                },
              ]}
            >
              <Ionicons name="checkmark" size={12} color={tierColor.text} />
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {progress}%
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

interface AchievementsGridProps {
  achievements: Achievement[];
  maxVisible?: number;
  onViewAll?: () => void;
}

export function AchievementsGrid({
  achievements,
  maxVisible = 6,
  onViewAll,
}: AchievementsGridProps) {
  const { colors, spacing, typography, radius } = useTheme();

  // Sort: unlocked first, then by progress
  const sorted = [...achievements].sort((a, b) => {
    if (a.unlockedAt && !b.unlockedAt) return -1;
    if (!a.unlockedAt && b.unlockedAt) return 1;
    return (b.progress || 0) - (a.progress || 0);
  });

  const visible = sorted.slice(0, maxVisible);
  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <View>
      {/* Header */}
      <View style={[styles.header, { marginBottom: spacing.sm }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={18} color={colors.accent} />
          <Text
            style={[
              typography.label,
              { color: colors.textPrimary, marginLeft: spacing.xs },
            ]}
          >
            ACHIEVEMENTS
          </Text>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: colors.accentLight,
                borderRadius: radius.sm,
                marginLeft: spacing.xs,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
              },
            ]}
          >
            <Text
              style={{ fontSize: 11, fontWeight: "700", color: colors.accent }}
            >
              {unlockedCount}/{achievements.length}
            </Text>
          </View>
        </View>
        {onViewAll && (
          <Pressable onPress={onViewAll}>
            <Text style={[typography.caption, { color: colors.accent }]}>
              View All
            </Text>
          </Pressable>
        )}
      </View>

      {/* Grid */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md }}
      >
        {visible.map((achievement, index) => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
            size="medium"
            index={index}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface NewAchievementModalProps {
  achievement: Achievement;
  visible: boolean;
  onClose: () => void;
}

export function NewAchievementPopup({
  achievement,
  visible,
  onClose,
}: NewAchievementModalProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const tierColor = TIER_COLORS[achievement.tier];

  if (!visible) return null;

  return (
    <Animated.View
      entering={ZoomIn.duration(300)}
      style={[
        styles.popup,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xxl,
          ...shadows.lg,
        },
      ]}
    >
      <LinearGradient
        colors={[tierColor.bg, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={[styles.popupGradient, { borderRadius: radius.xxl }]}
      >
        <View style={[styles.popupContent, { padding: spacing.lg }]}>
          {/* Confetti/Celebration Icon */}
          <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>🎉</Text>

          {/* Badge */}
          <View
            style={[
              styles.popupBadge,
              {
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: tierColor.bg,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Ionicons
              name={achievement.icon as any}
              size={40}
              color={tierColor.text}
            />
          </View>

          {/* Title */}
          <Text
            style={[
              typography.h2,
              { color: colors.textPrimary, textAlign: "center" },
            ]}
          >
            Achievement Unlocked!
          </Text>

          <Text
            style={[
              typography.h3,
              { color: colors.accent, marginTop: spacing.xs },
            ]}
          >
            {achievement.title}
          </Text>

          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: spacing.xs,
              },
            ]}
          >
            {achievement.description}
          </Text>

          {/* Close Button */}
          <Pressable
            onPress={onClose}
            style={[
              styles.popupButton,
              {
                backgroundColor: colors.accent,
                borderRadius: radius.lg,
                marginTop: spacing.lg,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.xl,
              },
            ]}
          >
            <Text style={{ color: colors.textOnAccent, fontWeight: "700" }}>
              Awesome!
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    alignItems: "center",
    width: 80,
  },
  badge: {
    justifyContent: "center",
    alignItems: "center",
  },
  lockedOverlay: {
    justifyContent: "center",
    alignItems: "center",
  },
  progressRing: {
    position: "absolute",
  },
  card: {
    marginBottom: 8,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardBadge: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardStatus: {
    marginLeft: 8,
  },
  progressBar: {
    height: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  unlockedBadge: {
    flexDirection: "row",
    alignItems: "center",
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
  countBadge: {},
  popup: {
    position: "absolute",
    top: "30%",
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  popupGradient: {},
  popupContent: {
    alignItems: "center",
  },
  popupBadge: {
    justifyContent: "center",
    alignItems: "center",
  },
  popupButton: {},
});

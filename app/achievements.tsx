/**
 * Achievements Screen
 *
 * Every badge from GET /api/achievements, grouped by category. Earned badges
 * show their unlock date; locked badges show a progress bar
 * (progress / targetValue). All rules and progress come from the server.
 */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAchievements } from "../hooks/useAchievements";
import {
  badgeIcon,
  CATEGORY_ORDER,
  categoryLabel,
  formatProgressValue,
  TIER_COLORS,
  TIER_LABELS,
} from "../insights/achievements";
import type { Achievement } from "../services/api";
import { useTheme } from "../theme/theme";

function formatUnlockDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function BadgeRow({ badge }: { badge: Achievement }) {
  const { colors, spacing, radius, typography } = useTheme();
  const tierColor = TIER_COLORS[badge.tier];
  const unlocked = Boolean(badge.unlockedAt);
  const ratio = badge.targetValue > 0 ? Math.min(1, Math.max(0, badge.progress / badge.targetValue)) : 0;

  const status = unlocked
    ? `Unlocked ${formatUnlockDate(badge.unlockedAt!)}`
    : `${formatProgressValue(badge.category, badge.progress)} / ${formatProgressValue(badge.category, badge.targetValue)}`;

  return (
    <View
      accessible
      accessibilityLabel={`${badge.title}, ${TIER_LABELS[badge.tier]}. ${badge.description}. ${unlocked ? status : `Locked, progress ${status}`}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: unlocked ? `${tierColor}66` : colors.cardBorder,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.full,
          backgroundColor: unlocked ? `${tierColor}26` : colors.surfaceElevated,
          justifyContent: "center",
          alignItems: "center",
          marginRight: spacing.md,
        }}
      >
        <Ionicons
          name={badgeIcon(badge.key)}
          size={24}
          color={unlocked ? tierColor : colors.textMuted}
        />
        {!unlocked && (
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              backgroundColor: colors.surface,
              borderRadius: radius.full,
              padding: 2,
            }}
          >
            <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Text
            style={{
              ...typography.bodyMedium,
              color: unlocked ? colors.textPrimary : colors.textSecondary,
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {badge.title}
          </Text>
          <View
            style={{
              backgroundColor: `${tierColor}26`,
              borderRadius: radius.full,
              paddingHorizontal: spacing.xs,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: tierColor, fontSize: 11, fontWeight: "700" }}>
              {TIER_LABELS[badge.tier]}
            </Text>
          </View>
        </View>

        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
          {badge.description}
        </Text>

        {!unlocked && (
          <View
            style={{
              height: 6,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceElevated,
              overflow: "hidden",
              marginTop: spacing.xs,
            }}
          >
            <View
              style={{
                width: `${Math.round(ratio * 100)}%`,
                height: "100%",
                backgroundColor: colors.accent,
                borderRadius: radius.full,
              }}
            />
          </View>
        )}

        <Text
          style={{
            ...typography.caption,
            color: unlocked ? tierColor : colors.textMuted,
            marginTop: 4,
            fontWeight: unlocked ? "600" : "400",
          }}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

export default function AchievementsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: achievements = [], isLoading, isError, refetch, isRefetching } = useAchievements();

  const sections = useMemo(() => {
    const known = CATEGORY_ORDER.map(({ key, label }) => ({
      key,
      title: label,
      data: achievements.filter((a) => a.category === key),
    }));
    // Any category the server adds later still shows up, after the known ones.
    const extraKeys = [...new Set(achievements.map((a) => a.category))].filter(
      (key) => !CATEGORY_ORDER.some((c) => c.key === key),
    );
    const extra = extraKeys.map((key) => ({
      key,
      title: categoryLabel(key),
      data: achievements.filter((a) => a.category === key),
    }));
    return [...known, ...extra].filter((s) => s.data.length > 0);
  }, [achievements]);

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;
  const total = achievements.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={{ marginRight: spacing.md, padding: spacing.xs }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.h2, color: colors.textPrimary }}>Achievements</Text>
          {total > 0 && (
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              {unlockedCount} of {total} unlocked
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : isError && total === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: spacing.sm,
            }}
          >
            Couldn&apos;t load your achievements.
          </Text>
          <Pressable
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading achievements"
            style={{
              marginTop: spacing.md,
              backgroundColor: colors.accent,
              borderRadius: radius.lg,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
            }}
          >
            <Text style={{ color: colors.textOnAccent, fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => <BadgeRow badge={item} />}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                ...typography.label,
                color: colors.textMuted,
                marginTop: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              {section.title.toUpperCase()} ·{" "}
              {section.data.filter((a) => a.unlockedAt).length}/{section.data.length}
            </Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
          }
        />
      )}
    </View>
  );
}

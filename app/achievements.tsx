/**
 * Achievements (Achievements1_Screen mockup). Every badge, rule and progress
 * value comes from the server (GET /api/achievements); this screen groups
 * them, shows how far along each locked badge is, and opens the badge sheet.
 */
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { memo, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BadgeSheet } from "../components/achievements/BadgeSheet";
import { Button } from "../components/ui/Button";
import { FilterChip } from "../components/ui/FilterChip";
import { Reveal } from "../components/ui/Reveal";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { useAchievements } from "../hooks/useAchievements";
import { useUnitPreference } from "../hooks/useUnitPreference";
import { badgeIcon, CATEGORY_ORDER, categoryLabel, progressLabel, TIER_LABELS, tierColor, unlockDate } from "../utils/achievementDisplay";
import type { Achievement } from "../services/api";
import { useTheme } from "../theme/theme";
import { radius, size, spacing, tracking, typography } from "../theme/tokens";
import type { WeightUnit } from "../utils/unitConversion";

const NO_BADGES: Achievement[] = [];

export default function AchievementsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { unit } = useUnitPreference();
  const { data, isLoading, isError, refetch } = useAchievements();
  const badges = data ?? NO_BADGES;

  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<Achievement | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Known categories in order, then anything new the server adds.
  const categories = useMemo(() => {
    const present = new Set(badges.map((b) => b.category));
    const known = CATEGORY_ORDER.map((c) => c.key).filter((k) => present.has(k));
    return [...known, ...[...present].filter((k) => !known.includes(k))];
  }, [badges]);
  const sections = useMemo(
    () => (filter ? [filter] : categories).map((key) => ({ key, items: badges.filter((b) => b.category === key) })),
    [filter, categories, badges],
  );

  const unlocked = badges.filter((b) => b.unlockedAt).length;
  const pct = badges.length ? Math.round((unlocked / badges.length) * 100) : 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingLeft: spacing.xs, paddingRight: spacing.screen }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({ width: size.control, height: size.control, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.text} />
        </Pressable>
        <Text style={[typography.headlineMd, { flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
          Achievements
        </Text>
        {badges.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name="military-tech" size={size.iconSm} color={colors.amber} />
            <Text style={[typography.labelLg, { color: colors.text }]}>
              {unlocked} / {badges.length}
            </Text>
          </View>
        )}
      </View>

      {isLoading && badges.length === 0 ? (
        <View style={{ padding: spacing.screen, gap: spacing.md }} accessibilityLabel="Loading achievements">
          <SkeletonBlock height={size.control} radius="lg" />
          <SkeletonBlock height={size.control} radius="lg" />
          {[0, 1].map((r) => (
            <View key={r} style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <SkeletonBlock height={size.goalCard * 1.3} radius="xl" />
              </View>
              <View style={{ flex: 1 }}>
                <SkeletonBlock height={size.goalCard * 1.3} radius="xl" />
              </View>
            </View>
          ))}
        </View>
      ) : badges.length === 0 ? (
        <View style={{ padding: spacing.screen, gap: spacing.md, alignItems: "center" }}>
          <MaterialIcons name="military-tech" size={size.iconLg * 2} color={colors.textMuted} />
          <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>
            {isError ? "Couldn't load your badges. Check your connection." : "No badges yet."}
          </Text>
          {isError && <Button title="Try again" variant="tonal" onPress={() => void refetch()} />}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} />}
        >
          {/* Overall progress */}
          <Reveal index={0} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
                {unlocked} of {badges.length} unlocked
              </Text>
              <Text style={[typography.labelLg, { color: colors.accent }]}>{pct}% completed</Text>
            </View>
            <View style={{ height: size.progressBar, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh, overflow: "hidden" }} accessibilityLabel={`${pct} percent of badges unlocked`}>
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.accent }} />
            </View>
          </Reveal>

          {/* Categories */}
          <Reveal index={1}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              <FilterChip label="All" active={!filter} onPress={() => setFilter(null)} />
              {categories.map((c) => (
                <FilterChip key={c} label={categoryLabel(c)} active={filter === c} onPress={() => setFilter((cur) => (cur === c ? null : c))} />
              ))}
            </ScrollView>
          </Reveal>

          {sections.map((section, i) => {
            const done = section.items.filter((b) => b.unlockedAt).length;
            return (
              <Reveal key={section.key} index={2 + i} style={{ gap: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                  <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
                    {categoryLabel(section.key)}
                  </Text>
                  <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
                    {done} of {section.items.length} unlocked
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                  {section.items.map((b) => (
                    <BadgeCard key={b.key} badge={b} unit={unit} onPress={setOpen} />
                  ))}
                </View>
              </Reveal>
            );
          })}
        </ScrollView>
      )}

      <BadgeSheet badge={open} unit={unit} primaryLabel="Close" onClose={() => setOpen(null)} />
    </View>
  );
}

/** Half-width card: icon + tier, title, rule, then the unlock date or progress. */
const BadgeCard = memo(function BadgeCard({ badge, unit, onPress }: { badge: Achievement; unit: WeightUnit; onPress: (b: Achievement) => void }) {
  const { colors } = useTheme();
  const unlocked = !!badge.unlockedAt;
  const tint = tierColor(colors, badge.tier);
  const ratio = badge.targetValue > 0 ? Math.min(1, Math.max(0, badge.progress / badge.targetValue)) : 0;
  const status = unlocked ? `Unlocked ${unlockDate(badge.unlockedAt!)}` : progressLabel(badge, unit);

  return (
    <Pressable
      onPress={() => onPress(badge)}
      accessibilityRole="button"
      accessibilityLabel={`${badge.title}, ${TIER_LABELS[badge.tier]}. ${badge.description}. ${unlocked ? status : `Locked, ${status}`}`}
      style={({ pressed }) => ({
        flexBasis: "47%",
        flexGrow: 1,
        padding: spacing.md,
        gap: spacing.sm,
        justifyContent: "space-between",
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: unlocked ? tint : "transparent",
        backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name={badgeIcon(badge.key)} size={size.icon} color={unlocked ? tint : colors.textMuted} />
          </View>
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, borderWidth: 1, borderColor: unlocked ? tint : colors.border }}>
            <Text style={[typography.labelSm, { color: unlocked ? tint : colors.textMuted }]}>{TIER_LABELS[badge.tier]}</Text>
          </View>
        </View>
        <Text style={[typography.bodyMdMedium, { color: unlocked ? colors.text : colors.textSecondary }]} numberOfLines={1}>
          {badge.title}
        </Text>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={2}>
          {badge.description}
        </Text>
      </View>

      {unlocked ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <MaterialIcons name="check-circle" size={size.iconXs} color={colors.accent} />
          <Text style={[typography.labelSm, { color: colors.accent }]}>{status}</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.xs }}>
            <Text style={[typography.labelSm, { color: colors.textMuted }]}>Progress</Text>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={1}>
              {status}
            </Text>
          </View>
          <View style={{ height: size.progressBar, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh, overflow: "hidden" }}>
            <View style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: tint }} />
          </View>
        </View>
      )}
    </Pressable>
  );
});

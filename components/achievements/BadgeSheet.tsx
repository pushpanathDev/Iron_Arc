import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Share, Text, View } from "react-native";
import { badgeIcon, categoryIcon, categoryLabel, progressLabel, TIER_LABELS, tierColor, unlockDate } from "../../insights/achievements";
import type { Achievement } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import type { WeightUnit } from "../../utils/unitConversion";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

export type BadgeSheetProps = {
  badge: Achievement | null;
  unit: WeightUnit;
  /** "Nice", or "Next · 2 more" when unlocks are queued. */
  primaryLabel?: string;
  onClose: () => void;
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/**
 * One badge (Achievement_Unlocked_Bottom_Sheet mockup): emblem, tier,
 * title, how it's earned, and either when it was unlocked (with Share) or
 * how close you are.
 */
export function BadgeSheet({ badge, unit, primaryLabel = "Nice", onClose }: BadgeSheetProps) {
  const { colors } = useTheme();
  if (!badge) return <Sheet visible={false} onClose={onClose} />;

  const unlocked = !!badge.unlockedAt;
  const tint = tierColor(colors, badge.tier);
  const ratio = badge.targetValue > 0 ? Math.min(1, badge.progress / badge.targetValue) : 0;

  const share = () =>
    void Share.share({ message: `I unlocked "${badge.title}" (${TIER_LABELS[badge.tier]}) on Iron Arc: ${badge.description}` }).catch(() => {});

  return (
    <Sheet visible onClose={onClose}>
      <View style={{ alignItems: "center", gap: spacing.md }}>
        {/* Close */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            position: "absolute",
            top: -spacing.sm,
            right: -spacing.sm,
            width: size.control,
            height: size.control,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
          })}
        >
          <MaterialIcons name="close" size={size.icon} color={colors.textSecondary} />
        </Pressable>

        {/* Emblem */}
        <View style={{ width: size.ring, height: size.ring, borderRadius: radius.full, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: unlocked ? tint : colors.border }}>
          <View style={{ width: size.homeRing, height: size.homeRing, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name={unlocked ? badgeIcon(badge.key) : "lock"} size={size.iconLg * 2} color={unlocked ? tint : colors.textMuted} />
          </View>
          {unlocked && (
            <View style={{ position: "absolute", top: spacing.xs, right: spacing.xs, width: size.tileSm, height: size.tileSm, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 2, borderColor: tint }}>
              <MaterialIcons name="star" size={size.iconSm} color={tint} />
            </View>
          )}
        </View>

        {/* Tier */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ width: size.dot, height: size.dot, borderRadius: radius.full, backgroundColor: tint }} />
          <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{TIER_LABELS[badge.tier]} tier</Text>
        </View>

        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <Text style={[typography.headlineLg, { color: colors.text, textAlign: "center" }]} accessibilityRole="header">
            {badge.title}
          </Text>
          <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>{badge.description}</Text>
        </View>
      </View>

      {/* Category + when / how close */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.raised }}>
        <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
          <MaterialIcons name={categoryIcon(badge.category)} size={size.icon} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{categoryLabel(badge.category)}</Text>
          {!unlocked && (
            <View style={{ height: size.progressBar, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh, overflow: "hidden" }}>
              <View style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: colors.accent }} />
            </View>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: spacing.xxs }}>
          {unlocked ? (
            <>
              <Text style={[typography.labelMd, { color: colors.amber }]}>{isToday(badge.unlockedAt!) ? "Unlocked today" : "Unlocked"}</Text>
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{unlockDate(badge.unlockedAt!)}</Text>
            </>
          ) : (
            <>
              <Text style={[typography.labelMd, { color: colors.textSecondary }]}>Progress</Text>
              <Text style={[typography.labelLg, { color: colors.text }]}>{progressLabel(badge, unit)}</Text>
            </>
          )}
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Button title={unlocked ? primaryLabel : "Got it"} onPress={onClose} fullWidth uppercase={unlocked} haptic={unlocked} />
        {unlocked && <Button title="Share" icon="share-social-outline" variant="ghost" onPress={share} fullWidth />}
      </View>
    </Sheet>
  );
}

export default BadgeSheet;

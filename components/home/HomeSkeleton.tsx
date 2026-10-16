import { View, type DimensionValue } from "react-native";
import { SkeletonBlock } from "../ui";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, touchTarget, typography } from "../../theme/tokens";

export function HomeSkeleton() {
  const { colors } = useTheme();
  const line = (w: DimensionValue, role: { lineHeight: number }) => <SkeletonBlock width={w} height={role.lineHeight} radius="sm" />;
  // Mirrors the loaded layout block for block (same surfaces, radii and gaps),
  // so nothing jumps when the real cards replace it.
  const surface = { backgroundColor: colors.raised, borderRadius: radius.xl, padding: spacing.lg };
  return (
    <View style={{ gap: spacing.lg }} accessibilityLabel="Loading your home screen">
      {/* Today */}
      <View style={[surface, { gap: spacing.md }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {line("28%", typography.labelMd)}
          {line("20%", typography.labelSm)}
        </View>
        {line("50%", typography.headlineMd)}
        {line("70%", typography.bodyMd)}
        <View style={{ flexDirection: "row", gap: spacing.inline }}>
          {(["24%", "30%", "26%"] as DimensionValue[]).map((w, i) => (
            <SkeletonBlock key={i} width={w} height={typography.labelSm.lineHeight + spacing.sm} radius="md" />
          ))}
        </View>
        <SkeletonBlock height={size.control} radius="lg" />
      </View>
      {/* This week + streak */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {[0, 1].map((k) => (
          <View key={k} style={[surface, { flex: 1, gap: spacing.sm }]}>
            {line("55%", typography.labelSm)}
            {line("65%", typography.headlineMd)}
            {line("80%", typography.labelSm)}
            {line("90%", typography.labelSm)}
          </View>
        ))}
      </View>
      {/* Body weight */}
      <View style={[surface, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          {line("35%", typography.labelSm)}
          {line("45%", typography.headlineLg)}
          {line("55%", typography.labelMd)}
        </View>
        <SkeletonBlock width={size.goalCard - spacing.xl} height={size.control} radius="md" />
      </View>
      {/* Plan slot (your plan, or the AI plan card) */}
      <View style={[surface, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
        <SkeletonBlock width={size.rowIcon} height={size.rowIcon} radius="md" />
        <View style={{ flex: 1, gap: spacing.xs }}>
          {line("25%", typography.labelSm)}
          {line("50%", typography.headlineSm)}
          {line("75%", typography.labelSm)}
        </View>
      </View>
      {/* Suggested next */}
      <View style={[surface, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
        <SkeletonBlock width={size.rowIcon} height={size.rowIcon} radius="md" />
        <View style={{ flex: 1, gap: spacing.xs }}>
          {line("35%", typography.labelSm)}
          {line("30%", typography.headlineSm)}
          {line("45%", typography.labelSm)}
        </View>
      </View>
      {/* Recent activity */}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: touchTarget }}>
          {line("40%", typography.headlineSm)}
          {line("25%", typography.labelMd)}
        </View>
        {[0, 1, 2].map((k) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.raised }}>
            <SkeletonBlock width={size.rowIcon} height={size.rowIcon} radius="md" />
            <View style={{ flex: 1, gap: spacing.xs }}>
              {line("45%", typography.bodyMdMedium)}
              {line("60%", typography.labelSm)}
            </View>
            <SkeletonBlock width={size.homeRing} height={typography.headlineSm.lineHeight} radius="sm" />
          </View>
        ))}
      </View>
    </View>
  );
}

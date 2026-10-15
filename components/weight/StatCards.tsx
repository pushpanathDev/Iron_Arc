import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { formatValue, goalProgress, toDisplay } from "../../utils/bodyWeightRules";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";

export function StatCard({ label, value, unit, caption, valueColor }: { label: string; value: string; unit?: string; caption: string; valueColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.raised, gap: spacing.xxs }} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}. ${caption}`}>
      <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xxs }}>
        <Text style={[typography.headlineMd, { color: valueColor ?? colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit && <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
      <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

/** Goal card: the target and how far is left, or a prompt to set one. */
export function GoalCard({ goalKg, latestKg, unit, onPress }: { goalKg: number | null; latestKg: number | null; unit: WeightUnit; onPress: () => void }) {
  const { colors } = useTheme();
  const progress = goalKg != null && latestKg != null ? goalProgress(latestKg, goalKg) : null;
  const caption =
    goalKg == null
      ? "Tap to set"
      : !progress
        ? "Log a weigh-in"
        : progress.reached
          ? "At goal"
          : `${formatValue(toDisplay(progress.leftKg, unit))} ${weightLabel(unit)} to ${progress.direction}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={goalKg == null ? "Weight goal: not set" : `Weight goal: ${formatValue(toDisplay(goalKg, unit))} ${weightLabel(unit)}. ${caption}`}
      accessibilityHint={goalKg == null ? "Set a target weight" : "Change or remove your goal"}
      style={({ pressed }) => ({ flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised, gap: spacing.xxs })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Goal</Text>
        <MaterialIcons name={goalKg == null ? "add" : "flag"} size={size.iconSm} color={colors.warning} />
      </View>
      {goalKg == null ? (
        <Text style={[typography.headlineSm, { color: colors.warning }]}>Set goal</Text>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xxs }}>
          <Text style={[typography.headlineMd, { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatValue(toDisplay(goalKg, unit))}
          </Text>
          <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
        </View>
      )}
      <Text style={[typography.labelSm, { color: progress?.reached ? colors.accent : colors.textSecondary }]} numberOfLines={1}>
        {caption}
      </Text>
    </Pressable>
  );
}

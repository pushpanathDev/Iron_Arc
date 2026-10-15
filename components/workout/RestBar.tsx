import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useRestRemaining } from "../../hooks/useRestTimer";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { Button } from "../ui/Button";

const formatClock = (seconds: number) => {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Sticky "RESTING 00:38 · +15s · Skip" bar while the rest timer runs. */
export function RestBar({ endsAt, onExtend, onSkip }: { endsAt: number; onExtend: () => void; onSkip: () => void }) {
  const { colors } = useTheme();
  const remaining = useRestRemaining(endsAt);
  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={`Resting, ${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds left`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.sm,
        paddingLeft: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.raised,
      }}
    >
      <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
        <MaterialIcons name="timer" size={size.icon} color={colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Resting</Text>
        <Text style={[typography.headlineSm, { color: colors.warning, fontVariant: ["tabular-nums"] }]}>{formatClock(remaining)}</Text>
      </View>
      <Button title="+15s" variant="tonal" onPress={onExtend} accessibilityLabel="Add 15 seconds" />
      <Button title="Skip" variant="tonal" onPress={onSkip} accessibilityLabel="Skip rest" />
    </View>
  );
}

/** Compact "Rest 00:38" pill for the session header. */
export function RestPill({ endsAt }: { endsAt: number }) {
  const { colors } = useTheme();
  const remaining = useRestRemaining(endsAt);
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: size.divider, borderColor: colors.warning }}
      accessibilityLabel={`Rest ${formatClock(remaining)}`}
    >
      <MaterialIcons name="timer" size={size.iconXs} color={colors.warning} />
      <Text style={[typography.labelLg, { color: colors.warning, fontVariant: ["tabular-nums"] }]}>Rest {formatClock(remaining)}</Text>
    </View>
  );
}

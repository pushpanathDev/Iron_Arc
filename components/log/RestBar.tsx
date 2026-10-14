import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { Button } from "../ui/Button";

export const formatClock = (seconds: number) => {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Sticky "RESTING 00:38 · +15s · Skip" bar while the rest timer runs. */
export function RestBar({ remaining, onExtend, onSkip }: { remaining: number; onExtend: () => void; onSkip: () => void }) {
  const { colors } = useTheme();
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

export default RestBar;

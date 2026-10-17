import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

/** Drawn height of the chip; the tap area around it stays a full 48. */
const VISUAL_HEIGHT = 40;

/**
 * Filter / period chip. The 48-high touch area holds a lighter 40-high box
 * (like Chip), so a row of them doesn't look heavy. Selected = solid accent.
 */
export function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={{ minHeight: size.control, justifyContent: "center" }}>
      {({ pressed }) => (
        <View
          style={{
            minHeight: VISUAL_HEIGHT,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.lg,
            justifyContent: "center",
            backgroundColor: active ? colors.accent : pressed ? colors.surfaceContainerHigh : colors.raised,
          }}
        >
          <Text style={[typography.labelLg, { color: active ? colors.onAccent : colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

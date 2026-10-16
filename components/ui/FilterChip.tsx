import { Pressable, Text } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

/** 48-high filter / period chip; the whole box takes the tap. Selected = solid accent. */
export function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        minHeight: size.control,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        justifyContent: "center",
        backgroundColor: active ? colors.accent : pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
      <Text pointerEvents="none" style={[typography.labelLg, { color: active ? colors.onAccent : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, spacing, typography, semibold } from "../../theme/tokens";
import type { IconName } from "./iconName";

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const VISUAL_HEIGHT = 40;
// Extends the touch area to 48dp without making the pill look heavy.
const HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: ChipProps) {
  const { colors } = useTheme();
  const fg = disabled ? colors.textMuted : selected ? colors.onAccent : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: VISUAL_HEIGHT,
          minWidth: 48,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.full,
          borderWidth: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.xs,
          backgroundColor: selected
            ? pressed
              ? colors.accentPressed
              : colors.accent
            : pressed
              ? colors.border
              : colors.raised,
          borderColor: selected ? colors.accent : colors.border,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={fg} />}
      {selected && !icon && <Ionicons name="checkmark" size={16} color={fg} />}
      <Text style={[typography.bodyMd, { color: fg, ...semibold }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

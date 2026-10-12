import { Pressable, Text, ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  style,
}: Props) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: disabled ? colors.border : colors.accent,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          alignItems: "center",
          marginVertical: spacing.sm,
          opacity: pressed && !disabled ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: disabled ? colors.textSecondary : colors.onAccent,
          fontSize: 16,
          fontWeight: "600",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius as radii, spacing } from "../../theme/tokens";

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  radius?: "md" | "lg";
  padded?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Card({
  children,
  onPress,
  radius = "lg",
  padded = true,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: CardProps) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii[radius],
    padding: padded ? spacing.md : 0,
  };

  if (!onPress) {
    return (
      <View style={[base, style]} accessibilityLabel={accessibilityLabel} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        base,
        { minHeight: 48 },
        pressed && { backgroundColor: colors.raised },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export default Card;

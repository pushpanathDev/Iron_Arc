import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius as radii, spacing, touchTarget } from "../../theme/tokens";
import { PressableScale } from "./PressableScale";

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  radius?: "md" | "lg" | "xl";
  padded?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Card({
  children,
  onPress,
  radius = "xl",
  padded = true,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: CardProps) {
  const { colors } = useTheme();
  // Borderless on the raised surface (the Weight screen's card style): depth
  // comes from the surface step, not an outline.
  const base: ViewStyle = {
    backgroundColor: colors.raised,
    borderRadius: radii[radius],
    padding: padded ? spacing.lg : 0,
  };

  if (!onPress) {
    return (
      <View style={[base, style]} accessibilityLabel={accessibilityLabel} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        base,
        { minHeight: touchTarget },
        pressed && { backgroundColor: colors.surfaceContainerHigh },
        style,
      ]}
    >
      {children}
    </PressableScale>
  );
}

export default Card;

import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../theme/theme";

export type ProgressRingProps = {
  /** 0 to 1; values outside are clamped. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** e.g. "3 of 4 workouts this week" */
  accessibilityLabel: string;
  /** Colour of the unfilled track; defaults to the border colour. */
  trackColor?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ProgressRing({
  progress,
  size = 72,
  strokeWidth = 8,
  accessibilityLabel,
  trackColor,
  children,
  style,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}
    >
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? colors.border} strokeWidth={strokeWidth} fill="none" />
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            fill="none"
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

export default ProgressRing;

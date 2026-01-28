import { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { useTheme } from "../../src/theme/theme";

type Props = {
  data: number[];
  height?: number;
  strokeWidth?: number;
};

export default function MiniLineChart({
  data,
  height = 120,
  strokeWidth = 3,
}: Props) {
  /* ------------------ HOOKS (ALWAYS RUN) ------------------ */

  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const progress = useSharedValue(0);
  const pulse = useSharedValue(1);

  const AnimatedPath = Animated.createAnimatedComponent(Path);
  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 600 });
  }, [data]);

  useEffect(() => {
    pulse.value = withTiming(1.15, { duration: 300 }, () => {
      pulse.value = withTiming(1);
    });
  }, [data]);

  /* ------------------ SAFE EARLY EXIT (AFTER HOOKS) ------------------ */

  if (!data || data.length < 2) {
    return null;
  }

  /* ------------------ CHART CALCULATIONS ------------------ */

  const chartWidth = width - 64;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * chartWidth;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  const lastPoint = points[points.length - 1];
  const pathLength = path.length;

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - progress.value),
  }));

  const animatedCircleProps = useAnimatedProps(() => ({
    r: 5 * pulse.value,
  }));

  /* ------------------ UI ------------------ */

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Main Line */}
        <AnimatedPath
          d={path}
          fill="none"
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          animatedProps={animatedPathProps}
        />

        {/* Highlight Latest Point */}
        <AnimatedCircle
          cx={lastPoint.x}
          cy={lastPoint.y}
          fill={colors.accent}
          animatedProps={animatedCircleProps}
        />
      </Svg>
    </View>
  );
}

/**
 * Animated Weight Scale Component
 * ================================
 * A realistic analog bathroom scale with animated needle.
 * The needle moves in real-time as the weight value changes.
 * 
 * Typical bathroom scales range from 0-150kg or 0-200kg.
 * This uses 0-200kg for broader compatibility.
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Line, Path, G, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  interpolate,
} from "react-native-reanimated";

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface WeightScaleProps {
  weight: number;        // Current weight value (0-200)
  size?: number;         // Component size (width/height)
  maxWeight?: number;    // Maximum scale value
  colors: {
    accent: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    surface: string;
    surfaceElevated: string;
    cardBorder: string;
  };
}

export function WeightScale({ 
  weight, 
  size = 240, 
  maxWeight = 200,
  colors 
}: WeightScaleProps) {
  const animatedWeight = useSharedValue(0);
  
  // Animate needle when weight changes
  useEffect(() => {
    animatedWeight.value = withSpring(Math.min(weight, maxWeight), {
      damping: 15,
      stiffness: 90,
      mass: 1,
    });
  }, [weight]);

  const center = size / 2;
  const radius = size * 0.38;
  const needleLength = radius * 0.75;
  
  // Scale goes from -120° to +120° (240° arc) - leaves room at bottom
  const startAngle = -120;
  const endAngle = 120;
  const angleRange = endAngle - startAngle;

  // Generate tick marks - every 20kg for cleaner look
  const majorTicks: Array<{
    x1: number; y1: number; x2: number; y2: number;
    label: string; labelX: number; labelY: number; angle: number;
  }> = [];
  const minorTicks: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  
  for (let i = 0; i <= maxWeight; i += 10) {
    const angle = startAngle + (i / maxWeight) * angleRange;
    const rad = (angle * Math.PI) / 180;
    
    const isMajor = i % 40 === 0; // Major ticks at 0, 40, 80, 120, 160, 200
    const tickLength = isMajor ? 10 : 5;
    const outerRadius = radius + 6;
    const innerRadius = outerRadius - tickLength;
    
    const x1 = center + Math.cos(rad) * outerRadius;
    const y1 = center + Math.sin(rad) * outerRadius;
    const x2 = center + Math.cos(rad) * innerRadius;
    const y2 = center + Math.sin(rad) * innerRadius;
    
    if (isMajor) {
      const labelRadius = radius - 14;
      const lx = center + Math.cos(rad) * labelRadius;
      const ly = center + Math.sin(rad) * labelRadius;
      
      majorTicks.push({
        x1, y1, x2, y2,
        label: i.toString(),
        labelX: lx,
        labelY: ly,
        angle,
      });
    } else {
      minorTicks.push({ x1, y1, x2, y2 });
    }
  }

  // Animated needle props
  const animatedNeedleProps = useAnimatedProps(() => {
    const angle = interpolate(
      animatedWeight.value,
      [0, maxWeight],
      [startAngle, endAngle]
    );
    const rad = (angle * Math.PI) / 180;
    
    return {
      x2: center + Math.cos(rad) * needleLength,
      y2: center + Math.sin(rad) * needleLength,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="scaleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.surface} />
            <Stop offset="100%" stopColor={colors.surfaceElevated} />
          </LinearGradient>
          <LinearGradient id="needleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#EF4444" />
            <Stop offset="100%" stopColor="#DC2626" />
          </LinearGradient>
        </Defs>

        {/* Scale Background */}
        <Circle
          cx={center}
          cy={center}
          r={radius + 15}
          fill="url(#scaleGradient)"
          stroke={colors.cardBorder}
          strokeWidth={2}
        />
        
        {/* Inner Circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius - 25}
          fill={colors.surface}
          stroke={colors.cardBorder}
          strokeWidth={1}
        />

        {/* Arc Track */}
        <Path
          d={describeArc(center, center, radius, startAngle, endAngle)}
          fill="none"
          stroke={colors.cardBorder}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Colored Progress Arc */}
        {weight > 0 && (
          <Path
            d={describeArc(
              center, 
              center, 
              radius, 
              startAngle, 
              startAngle + (Math.min(weight, maxWeight) / maxWeight) * angleRange
            )}
            fill="none"
            stroke={colors.accent}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.6}
          />
        )}

        {/* Minor Tick Marks */}
        {minorTicks.map((tick, i) => (
          <Line
            key={`minor-${i}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={colors.textMuted}
            strokeWidth={1}
          />
        ))}

        {/* Major Tick Marks + Labels */}
        {majorTicks.map((tick, i) => (
          <G key={`major-${i}`}>
            <Line
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={colors.textSecondary}
              strokeWidth={2}
            />
            <SvgText
              x={tick.labelX}
              y={tick.labelY}
              fill={colors.textSecondary}
              fontSize={10}
              fontWeight="500"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {tick.label}
            </SvgText>
          </G>
        ))}

        {/* Needle */}
        <AnimatedLine
          x1={center}
          y1={center}
          animatedProps={animatedNeedleProps}
          stroke="#EF4444"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Center Cap */}
        <Circle
          cx={center}
          cy={center}
          r={8}
          fill="#EF4444"
          stroke="#DC2626"
          strokeWidth={2}
        />
        <Circle
          cx={center}
          cy={center}
          r={4}
          fill="#FFF"
        />
      </Svg>

      {/* Digital Display - Below the scale */}
      <View style={[styles.digitalDisplay, { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.cardBorder }]}>
        <Text style={[styles.digitalText, { color: colors.textPrimary }]}>
          {weight > 0 ? weight.toFixed(1) : "0.0"}
        </Text>
        <Text style={[styles.digitalUnit, { color: colors.textMuted }]}>kg</Text>
      </View>
    </View>
  );
}

// Helper function to describe an SVG arc
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  digitalDisplay: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  digitalText: {
    fontSize: 32,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  digitalUnit: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 4,
  },
});

export default WeightScale;

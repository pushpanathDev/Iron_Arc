import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useTheme } from "../../theme/theme";
import { size, spacing, typography } from "../../theme/tokens";

export type ProgressPoint = {
  key: string;
  /** In the display unit. */
  value: number;
  /** Shown when the point is selected, e.g. "12 Oct · 85 kg × 8". */
  label: string;
  record: boolean;
};

const AXIS_W = 36;
const PAD = 8;
const DOT = 4;
const DOT_SELECTED = 6;

/** Line of one value per session; record sessions are amber dots. Tap near a point to read it. */
export function ProgressChart({ points, unitLabel }: { points: ProgressPoint[]; unitLabel: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const height = size.trendChart;

  const model = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1) {
      min -= 1;
      max += 1;
    }
    const plotW = width - AXIS_W - PAD * 2;
    const plotH = height - PAD * 2;
    const x = (i: number) => AXIS_W + PAD + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * plotH;
    const xy = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
    const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return { xy, path, min, max };
  }, [points, width, height]);

  const shown = selected != null && points[selected] ? points[selected] : points[points.length - 1];
  const round = (n: number) => String(Math.round(n * 10) / 10);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.labelMd, { color: colors.textSecondary }]} numberOfLines={1}>
        {shown ? `${selected == null ? "Latest: " : ""}${shown.label}` : " "}
      </Text>
      <Pressable
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (!model) return;
          const tx = e.nativeEvent.locationX;
          let best = 0;
          model.xy.forEach((p, i) => Math.abs(p.x - tx) < Math.abs(model.xy[best].x - tx) && (best = i));
          setSelected((cur) => (cur === best ? null : best));
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={`Progress chart, ${points.length} sessions`}
        style={{ height }}
      >
        {model && (
          <Svg width={width} height={height}>
            {[model.max, (model.max + model.min) / 2, model.min].map((v, i) => {
              const yy = PAD + (i / 2) * (height - PAD * 2);
              return <Line key={i} x1={AXIS_W} x2={width} y1={yy} y2={yy} stroke={colors.surfaceContainerHigh} strokeWidth={size.divider} />;
            })}
            <Path d={model.path} stroke={colors.accent} strokeWidth={size.chainLine} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {model.xy.map((p, i) => (
              <Circle
                key={points[i].key}
                cx={p.x}
                cy={p.y}
                r={i === selected ? DOT_SELECTED : DOT}
                fill={points[i].record ? colors.amber : colors.accent}
                stroke={colors.raised}
                strokeWidth={2}
              />
            ))}
          </Svg>
        )}
        {model &&
          [model.max, (model.max + model.min) / 2, model.min].map((v, i) => (
            <Text
              key={i}
              style={[
                typography.labelSm,
                { position: "absolute", left: 0, width: AXIS_W - spacing.xs, top: PAD + (i / 2) * (height - PAD * 2) - typography.labelSm.lineHeight / 2, fontSize: size.chartLabel, color: colors.textSecondary },
              ]}
            >
              {round(v)}
            </Text>
          ))}
      </Pressable>
      <Text style={[typography.labelSm, { fontSize: size.chartLabel, color: colors.textSecondary, textAlign: "right" }]}>{unitLabel} · amber = record</Text>
    </View>
  );
}

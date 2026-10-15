import { useMemo, useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import type { BodyWeight } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { alpha, fontFamily, radius, size, spacing, typography } from "../../theme/tokens";
import { formatValue, toDisplay } from "../../utils/bodyWeightRules";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";

export type TrendRange = "7D" | "30D" | "90D" | "1Y";
export const TREND_RANGES: TrendRange[] = ["7D", "30D", "90D", "1Y"];
const RANGE_DAYS: Record<TrendRange, number> = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365 };

const DAY_MS = 86_400_000;
const AXIS_W = 36;
const PAD_TOP = 12;
const PAD_RIGHT = 6;
const X_AXIS = 18;
const MAX_DOTS = 31;
const X_LABELS = 4;
/** Goal is drawn inside the chart only when it's this close to the data (in multiples of the data's spread); otherwise it's an edge label. */
const GOAL_REACH = 1.5;
const MIN_SPAN = 1;

const dayMs = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00`);
export const shortDate = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Entries in the chosen range, oldest first. */
export function entriesInRange(entries: BodyWeight[], range: TrendRange, todayKey: string) {
  const from = dayMs(todayKey) - RANGE_DAYS[range] * DAY_MS;
  return [...entries].filter((e) => dayMs(e.date) > from).sort((a, b) => a.date.localeCompare(b.date));
}

export type WeightTrendChartProps = {
  entries: BodyWeight[];
  unit: WeightUnit;
  todayKey: string;
  /** Target weight in kg, or null. */
  goalKg: number | null;
};

export function WeightTrendChart({ entries, unit, todayKey, goalKg }: WeightTrendChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const height = size.trendChart;
  const goal = goalKg == null ? null : toDisplay(goalKg, unit);

  const model = useMemo(() => {
    if (width === 0 || entries.length < 2) return null;
    const values = entries.map((e) => toDisplay(e.weight, unit));
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const spread = Math.max(dataMax - dataMin, MIN_SPAN);
    // Include the goal in the scale when it's near the data; a far-off goal would flatten the line.
    const goalInside = goal != null && goal >= dataMin - spread * GOAL_REACH && goal <= dataMax + spread * GOAL_REACH;
    const lo = Math.min(dataMin, goalInside ? goal! : dataMin) - spread * 0.08;
    const hi = Math.max(dataMax, goalInside ? goal! : dataMax) + spread * 0.08;
    const t0 = dayMs(entries[0].date);
    const t1 = dayMs(entries[entries.length - 1].date);
    const plotW = width - AXIS_W - PAD_RIGHT;
    const plotH = height - PAD_TOP - X_AXIS;
    const x = (t: number) => AXIS_W + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW);
    const y = (v: number) => PAD_TOP + (1 - (v - lo) / (hi - lo)) * plotH;
    const points = entries.map((e, i) => ({ x: x(dayMs(e.date)), y: y(values[i]), value: values[i], date: e.date }));
    const line = points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
    const bottom = PAD_TOP + plotH;
    const area = `${line} L${points[points.length - 1].x} ${bottom} L${points[0].x} ${bottom} Z`;
    const n = Math.min(X_LABELS, points.length);
    const xLabelIdx = [...new Set(Array.from({ length: n }, (_, i) => Math.round((i * (points.length - 1)) / (n - 1))))];
    return { points, line, area, xLabelIdx, y, dataMin, dataMax, goalInside, bottom };
  }, [entries, unit, width, height, goal]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const onPress = (e: GestureResponderEvent) => {
    if (!model) return;
    const tx = e.nativeEvent.locationX;
    let best = 0;
    model.points.forEach((p, i) => {
      if (Math.abs(p.x - tx) < Math.abs(model.points[best].x - tx)) best = i;
    });
    setSelected((cur) => (cur === best ? null : best));
  };

  const sel = model && selected != null ? model.points[Math.min(selected, model.points.length - 1)] : null;
  const label = (v: number) => formatValue(v);
  // Hide the goal axis label when it would collide with the min/max labels.
  const goalY = model && goal != null && model.goalInside ? model.y(goal) : null;
  const collides = (yy: number) => goalY != null && Math.abs(goalY - yy) < size.chartLabel + spacing.xs;

  return (
    <View onLayout={onLayout}>
      <Pressable
        onPress={onPress}
        disabled={!model}
        accessibilityRole="image"
        accessibilityLabel={
          model
            ? `Weight trend from ${label(model.points[0].value)} on ${shortDate(model.points[0].date)} to ${label(model.points[model.points.length - 1].value)} ${weightLabel(unit)} on ${shortDate(model.points[model.points.length - 1].date)}${goal != null ? `. Goal ${label(goal)} ${weightLabel(unit)}` : ""}`
            : "Not enough entries for a trend yet"
        }
        accessibilityHint={model ? "Tap to see a day's weight" : undefined}
        style={{ height }}
      >
        {model ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="weightTrendFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent} stopOpacity={alpha.faint} />
                <Stop offset="0.6" stopColor={colors.accent} stopOpacity={alpha.band / 1.25} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* Grid at max / middle / min of the data */}
            {[model.dataMax, (model.dataMax + model.dataMin) / 2, model.dataMin].map((v, i) => (
              <Line key={i} x1={AXIS_W} x2={width - PAD_RIGHT} y1={model.y(v)} y2={model.y(v)} stroke={colors.surfaceContainerHigh} strokeDasharray={i === 2 ? undefined : "3 3"} strokeWidth={size.divider} />
            ))}
            {/* Axis labels: max, min (and the goal, in amber) */}
            {!collides(model.y(model.dataMax)) && (
              <SvgText x={0} y={model.y(model.dataMax) + 4} fontSize={size.chartLabel} fontFamily={fontFamily.medium} fill={colors.textSecondary}>
                {label(model.dataMax)}
              </SvgText>
            )}
            {!collides(model.y(model.dataMin)) && (
              <SvgText x={0} y={model.y(model.dataMin) + 4} fontSize={size.chartLabel} fontFamily={fontFamily.medium} fill={colors.textSecondary}>
                {label(model.dataMin)}
              </SvgText>
            )}
            {goalY != null && (
              <>
                <SvgText x={0} y={goalY + 4} fontSize={size.chartLabel} fontFamily={fontFamily.semibold} fill={colors.warning}>
                  {label(goal!)}
                </SvgText>
                <Line x1={AXIS_W} x2={width - PAD_RIGHT} y1={goalY} y2={goalY} stroke={colors.warning} strokeDasharray="4 3" strokeWidth={1.2} strokeOpacity={0.85} />
                <SvgText x={width - PAD_RIGHT} y={goalY - spacing.xs} fontSize={size.chartLabel} fontFamily={fontFamily.semibold} fill={colors.warning} textAnchor="end">
                  {`Goal ${label(goal!)}`}
                </SvgText>
              </>
            )}
            <Path d={model.area} fill="url(#weightTrendFill)" />
            <Path d={model.line} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {model.points.length <= MAX_DOTS &&
              model.points.map((p, i) => {
                const last = i === model.points.length - 1;
                return <Circle key={p.date} cx={p.x} cy={p.y} r={last ? 4.5 : 3} fill={last ? colors.accent : colors.raised} stroke={colors.accent} strokeWidth={1.5} />;
              })}
            {sel && (
              <>
                <Line x1={sel.x} x2={sel.x} y1={PAD_TOP} y2={model.bottom} stroke={colors.textMuted} strokeWidth={size.divider} />
                <Circle cx={sel.x} cy={sel.y} r={5.5} fill={colors.accent} stroke={colors.bg} strokeWidth={2} />
              </>
            )}
            {model.xLabelIdx.map((i, n) => {
              const p = model.points[i];
              const anchor = n === 0 ? "start" : n === model.xLabelIdx.length - 1 ? "end" : "middle";
              return (
                <SvgText key={`x${p.date}`} x={p.x} y={height - 3} fontSize={size.chartLabel} fontFamily={fontFamily.medium} fill={colors.textSecondary} textAnchor={anchor}>
                  {p.date.slice(0, 10) === todayKey ? "Today" : shortDate(p.date)}
                </SvgText>
              );
            })}
          </Svg>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>
              {entries.length === 1 ? "One entry in this range \nLog another day to see a trend" : "No entries in this range yet."}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Tooltip for the tapped day */}
      {model && sel && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: Math.max(0, sel.y - size.control),
            left: Math.min(Math.max(0, sel.x - size.goalCard / 2), width - size.goalCard),
            width: size.goalCard,
            alignItems: "center",
          }}
        >
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHighest }}>
            <Text style={[typography.labelMd, { color: colors.text }]}>
              {`${label(sel.value)} ${weightLabel(unit)} · ${sel.date.slice(0, 10) === todayKey ? "Today" : shortDate(sel.date)}`}
            </Text>
          </View>
        </View>
      )}

      {/* A goal too far from the data to draw sits as a note under the chart. */}
      {model && goal != null && !model.goalInside && (
        <Text style={[typography.labelSm, { color: colors.warning, marginTop: spacing.xs }]}>
          {`Goal ${label(goal)} ${weightLabel(unit)} is ${goal < model.dataMin ? "below" : "above"} this range`}
        </Text>
      )}
    </View>
  );
}

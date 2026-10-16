import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

// Illustrative sample data for the intro slides only; not the user's data.
const REST_SECONDS = 90;
const SPARK_POINTS: [number, number][] = [
  [10, 65], [50, 58], [90, 60], [130, 46], [170, 38], [210, 40], [250, 20], [270, 14],
];
const SPARK_DOTS = [0, 2, 4];

function DemoCard({ children, gap = spacing.md }: { children: ReactNode; gap?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Example screen"
      style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap }}
    >
      {children}
    </View>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
      <View style={{ flexShrink: 1 }}>
        <Text style={[typography.headlineMd, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

function Chip({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: colors.raised,
      }}
    >
      {children}
    </View>
  );
}

// Slide 1: logging

function useCountdown(start: number) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s <= 1 ? start : s - 1)), 1000);
    return () => clearInterval(id);
  }, [start]);
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
}

const COLS = { set: 2, prev: 4, load: 4, done: 2 };

function SetRow({ set, prev, active }: { set: number; prev: string; active?: boolean }) {
  const { colors } = useTheme();
  const valueBox = (v: string) => (
    <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.bg }}>
      <Text style={[typography.headlineSm, { color: colors.text }]}>{v}</Text>
    </View>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: active ? spacing.sm : spacing.md,
        borderRadius: radius.md,
        backgroundColor: active ? colors.surfaceContainerHigh : colors.raised,
      }}
    >
      <Text style={[typography.headlineSm, { flex: COLS.set, color: active ? colors.textSecondary : colors.text }]}>{set}</Text>
      <Text style={[typography.bodyMd, { flex: COLS.prev, color: colors.textSecondary }]}>{prev}</Text>
      {active ? (
        <View style={{ flex: COLS.load, flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {valueBox("80")}
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>×</Text>
          {valueBox("8")}
        </View>
      ) : (
        <View style={{ flex: COLS.load, flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
          <Text style={[typography.headlineSm, { color: colors.text }]}>80</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>kg ×</Text>
          <Text style={[typography.headlineSm, { color: colors.text }]}>8</Text>
        </View>
      )}
      <View style={{ flex: COLS.done, alignItems: "flex-end" }}>
        <View
          style={{
            width: size.iconLg,
            height: size.iconLg,
            borderRadius: radius.sm,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? colors.surfaceContainerLowest : colors.accentContainer,
          }}
        >
          {active ? (
            <View style={{ width: size.dot, height: size.dot, borderRadius: radius.full, backgroundColor: colors.border }} />
          ) : (
            <MaterialIcons name="check" size={size.iconSm} color={colors.onAccent} />
          )}
        </View>
      </View>
    </View>
  );
}

export function LogDemoCard() {
  const { colors } = useTheme();
  const timer = useCountdown(REST_SECONDS);
  return (
    <DemoCard>
      <CardHeader
        title="Barbell Bench Press"
        subtitle="Working sets"
        right={
          <Chip>
            <MaterialIcons name="timer" size={size.iconSm} color={colors.textSecondary} />
            <Text style={[typography.headlineSm, { color: colors.text, fontVariant: ["tabular-nums"] }]}>{timer}</Text>
          </Chip>
        }
      />
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md }}>
          {(
            [
              ["Set", COLS.set],
              ["Previous", COLS.prev],
              ["Weight & reps", COLS.load],
            ] as const
          ).map(([label, flex]) => (
            <Text key={label} style={[typography.labelSm, { flex, color: colors.textSecondary }]}>
              {label}
            </Text>
          ))}
          <Text style={[typography.labelSm, { flex: COLS.done, color: colors.textSecondary, textAlign: "right" }]}>Done</Text>
        </View>
        <SetRow set={1} prev="77.5 kg × 8" />
        <SetRow set={2} prev="80 kg × 8" />
        <SetRow set={3} prev="80 kg × 7" active />
      </View>
    </DemoCard>
  );
}

// Slide 2: progress

function Tile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.raised }}>
      <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.headlineMd, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function TrackDemoCard() {
  const { colors } = useTheme();
  const path = SPARK_POINTS.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const last = SPARK_POINTS[SPARK_POINTS.length - 1];
  return (
    <DemoCard>
      <CardHeader
        title="Estimated 1RM trend"
        subtitle="Bench press · past 8 weeks"
        right={
          <Chip>
            <Text style={[typography.headlineSm, { color: colors.amber }]}>PR 102.5 kg</Text>
          </Chip>
        }
      />
      <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.raised, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Net progression</Text>
          <Text style={[typography.headlineSm, { color: colors.accent }]}>+8.5%</Text>
        </View>
        <Svg width="100%" height={size.chart} viewBox="0 0 280 80" fill="none">
          <Path d={path} stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {SPARK_DOTS.map((i) => (
            <Circle key={i} cx={SPARK_POINTS[i][0]} cy={SPARK_POINTS[i][1]} r={3} fill={colors.accentContainer} />
          ))}
          <Circle cx={last[0]} cy={last[1]} r={4} fill={colors.accent} />
        </Svg>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Week 1 (94 kg)</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Today (102.5 kg)</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Tile label="Weekly sets" value="16 sets" />
        <Tile label="Volume load" value="12,480 kg" />
      </View>
    </DemoCard>
  );
}

// Slide 3: plans

const ROUTINE = [
  { name: "Standing Overhead Press", detail: "4 sets · 4–6 reps · 180s rest" },
  { name: "Weighted Pull-Up", detail: "4 sets · 6 reps · 150s rest" },
  { name: "Incline Dumbbell Row", detail: "3 sets · 8–10 reps · 120s rest" },
];

export function PlanDemoCard() {
  const { colors } = useTheme();
  return (
    <DemoCard gap={spacing.md}>
      <CardHeader
        title="Upper Power A"
        right={
          <Chip>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Day 1</Text>
          </Chip>
        }
      />
      <View style={{ gap: spacing.sm }}>
        {ROUTINE.map((ex, i) => (
          <View
            key={ex.name}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.raised,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 }}>
              <Text style={[typography.headlineSm, { color: colors.textSecondary }]}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={{ flexShrink: 1 }}>
                <Text style={[typography.bodyMdMedium, { color: colors.text }]} numberOfLines={1}>
                  {ex.name}
                </Text>
                <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{ex.detail}</Text>
              </View>
            </View>
            <MaterialIcons name="drag-indicator" size={size.iconSm} color={colors.textSecondary} />
          </View>
        ))}
      </View>
    </DemoCard>
  );
}

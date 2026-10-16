import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProgressChart, type ProgressPoint } from "../../components/analytics/ProgressChart";
import { Button } from "../../components/ui/Button";
import { FilterChip } from "../../components/ui/FilterChip";
import { Reveal } from "../../components/ui/Reveal";
import { displayCategory } from "../../hooks/workoutDraft";
import { useStartPlanSession } from "../../hooks/useStartPlanSession";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useAllWorkouts } from "../../hooks/useWorkouts";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { withinReach } from "../../utils/analytics";
import {
  displayWeightRounded,
  estimate1RM,
  exerciseIndexFor,
  exerciseKey,
  formatGain,
  formatSet,
  heaviestSet,
  prEventsFor,
  prGain,
} from "../../utils/exerciseHistory";
import { toKg, weightLabel, weightStep } from "../../utils/unitConversion";
import { formatDate, parseLocalDate } from "../../utils/dates";

const NO_WORKOUTS: never[] = [];
const MAX_POINTS = 30;
const RECENT_SESSIONS = 8;
const shortDate = (key: string, year = false) =>
  parseLocalDate(key).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });

/** One exercise's progress: best lifts, a chart per session, records and recent sessions. */
export default function ExerciseProgress() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // expo-router hands params over already decoded.
  const { name: rawName } = useLocalSearchParams<{ name: string }>();
  const name = rawName ?? "";
  const { unit } = useUnitPreference();
  const { data } = useAllWorkouts();
  const workouts = data ?? NO_WORKOUTS;
  const startSession = useStartPlanSession();
  const todayKey = formatDate(new Date());

  const model = useMemo(() => {
    const { index } = exerciseIndexFor(workouts);
    const h = index.get(exerciseKey(name));
    if (!h) return null;
    const records = prEventsFor(workouts).filter((e) => exerciseKey(e.exercise) === exerciseKey(name));
    const recordDays = new Set(records.map((r) => r.date));
    const sessions = h.sessions
      .map((s) => {
        const weighted = s.sets.filter((x) => x.weight > 0);
        return { date: s.date, sets: s.sets, top: heaviestSet(weighted), best1RM: weighted.reduce((m, x) => Math.max(m, estimate1RM(x)), 0) };
      })
      .filter((s) => s.sets.length > 0);
    const weighted = sessions.filter((s) => s.top);
    const all = h.sessions.flatMap((s) => s.sets);
    const best = heaviestSet(all.filter((s) => s.weight > 0));
    const best1RM = all.reduce((m, s) => Math.max(m, s.weight > 0 ? estimate1RM(s) : 0), 0);
    const reach = withinReach(new Map([[exerciseKey(name), h]]), todayKey, toKg(weightStep(unit), unit), Number.POSITIVE_INFINITY)[0] ?? null;
    return { h, records: [...records].reverse(), recordDays, sessions, weighted, best, best1RM, reach };
  }, [workouts, name, todayKey, unit]);

  // Heaviest set, or estimated 1-rep max (fairer when rep counts vary: 70 × 15 vs 75 × 8).
  const [metric, setMetric] = useState<"top" | "e1rm">("top");
  const valueOf = (s: NonNullable<typeof model>["weighted"][number]) => (metric === "top" ? s.top!.weight : s.best1RM);
  const points: ProgressPoint[] = useMemo(
    () =>
      (model?.weighted ?? []).slice(-MAX_POINTS).map((s) => ({
        key: s.date,
        value: displayWeightRounded(metric === "top" ? s.top!.weight : s.best1RM, unit),
        label:
          metric === "top"
            ? `${shortDate(s.date)} · ${formatSet(s.top, unit)}${model?.recordDays.has(s.date) ? " · record" : ""}`
            : `${shortDate(s.date)} · est. ${Math.round(displayWeightRounded(s.best1RM, unit))} ${weightLabel(unit)}${model?.recordDays.has(s.date) ? " · record" : ""}`,
        record: !!model?.recordDays.has(s.date),
      })),
    [model, unit, metric],
  );

  const first = model?.weighted[0];
  const latest = model?.weighted[model.weighted.length - 1];
  const change = first && latest && model.weighted.length > 1 ? Math.round((valueOf(latest) - valueOf(first)) * 10) / 10 : null;
  const lastSetCount = model?.sessions[model.sessions.length - 1]?.sets.length ?? 3;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.xs }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({ width: size.control, height: size.control, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[typography.headlineSm, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">
            {name}
          </Text>
          {model && <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{displayCategory(model.h.category)}</Text>}
        </View>
      </View>

      {!model ? (
        <View style={{ padding: spacing.screen, gap: spacing.md }}>
          <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>No logged sets for this exercise yet.</Text>
          <Button title="Back" variant="tonal" onPress={() => router.back()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}>
          {/* Summary */}
          <Reveal index={0} style={{ flexDirection: "row", gap: spacing.sm }}>
            <Tile label="Best set" value={model.best ? String(displayWeightRounded(model.best.weight, unit)) : "—"} unit={model.best ? `${weightLabel(unit)} × ${model.best.reps}` : undefined} />
            <Tile label="Est. 1-rep max" value={model.best1RM > 0 ? String(Math.round(displayWeightRounded(model.best1RM, unit))) : "—"} unit={model.best1RM > 0 ? weightLabel(unit) : undefined} />
            <Tile label="Sessions" value={String(model.sessions.length)} />
          </Reveal>

          {/* Progress chart */}
          {points.length >= 2 && (
            <Reveal index={1}>
              <Card>
                <View style={{ gap: spacing.xxs }}>
                  <Text style={[typography.headlineSm, { color: colors.text }]}>{metric === "top" ? "Heaviest set per session" : "Estimated 1-rep max per session"}</Text>
                  {change != null && first && (
                    <Text style={[typography.bodyMd, { color: change > 0 ? colors.trendGood : colors.textSecondary }]}>
                      {change === 0 ? `Same as on ${shortDate(first.date, true)}` : `${formatGain(change, unit)} since ${shortDate(first.date, true)}`}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <FilterChip label="Heaviest set" active={metric === "top"} onPress={() => setMetric("top")} />
                  <FilterChip label="Est. 1RM" active={metric === "e1rm"} onPress={() => setMetric("e1rm")} />
                </View>
                <ProgressChart points={points} unitLabel={weightLabel(unit)} />
                {metric === "e1rm" && (
                  <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
                    An estimate from weight and reps (Epley formula), so sets with different reps can be compared. Not a tested max.
                  </Text>
                )}
              </Card>
            </Reveal>
          )}

          {/* Next record */}
          {model.reach && (
            <Reveal index={2}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.border }}>
                <MaterialIcons name="flag" size={size.iconLg} color={colors.accent} />
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{formatSet(model.reach.target, unit)} would be a record</Text>
                  <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
                    Last time: {formatSet(model.reach.last, unit)} on {shortDate(model.reach.lastDate)}
                  </Text>
                </View>
              </View>
            </Reveal>
          )}

          {/* Records */}
          <Reveal index={3}>
            <Card>
              <Text style={[typography.headlineSm, { color: colors.text }]}>Records</Text>
              {model.records.length === 0 ? (
                <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
                  {model.sessions.length < 2 ? "Records start from your second session." : "No records yet. Beat your best set to set one."}
                </Text>
              ) : (
                model.records.map((r, i) => (
                  <View key={r.date} style={{ minHeight: size.control, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: i === 0 ? 0 : size.divider, borderTopColor: colors.surfaceContainerHigh }}>
                    <MaterialIcons name="star" size={size.iconSm} color={colors.amber} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{formatSet(r.set, unit)}</Text>
                      <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
                        {shortDate(r.date, true)} · was {formatSet(r.previous, unit)}
                      </Text>
                    </View>
                    <Text style={[typography.labelMd, { color: colors.amber }]}>{prGain(r.set, r.previous, r.kind, unit)}</Text>
                  </View>
                ))
              )}
            </Card>
          </Reveal>

          {/* Recent sessions */}
          <Reveal index={4}>
            <Card>
              <Text style={[typography.headlineSm, { color: colors.text }]}>Recent sessions</Text>
              {[...model.sessions]
                .reverse()
                .slice(0, RECENT_SESSIONS)
                .map((s, i) => (
                  <View key={s.date} style={{ paddingVertical: spacing.sm, gap: spacing.xxs, borderTopWidth: i === 0 ? 0 : size.divider, borderTopColor: colors.surfaceContainerHigh }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                      <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{shortDate(s.date, true)}</Text>
                      {model.recordDays.has(s.date) && <MaterialIcons name="star" size={size.iconXs} color={colors.amber} />}
                    </View>
                    <Text style={[typography.bodyMd, { color: colors.text }]}>{s.sets.map((x) => formatSet(x, unit)).join("  ·  ")}</Text>
                  </View>
                ))}
            </Card>
          </Reveal>

          <Button
            title={`Log ${name}`}
            icon="add"
            onPress={() => startSession([{ name: model.h.name, sets: lastSetCount, category: model.h.category }])}
            fullWidth
          />
        </ScrollView>
      )}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.raised, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>{children}</View>;
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}
      style={{ flex: 1, minHeight: size.statTile, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.raised, justifyContent: "space-between" }}
    >
      <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]} numberOfLines={1}>
        {label}
      </Text>
      <View>
        <Text style={[typography.headlineMd, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit && <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
    </View>
  );
}

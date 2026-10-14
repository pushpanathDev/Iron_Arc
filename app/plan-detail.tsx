/**
 * Plan day view (AI Plans - Plan Detail Day View mockup): pick a weekday,
 * see its exercises (sets × reps, target or last time, rest), swap any of
 * them, and start that session in the log. Coach chat opens from the header.
 * Navigate here with /plan-detail?id=<planId>.
 */
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { aiErrorMessage, PlanActions } from "../components/plans/PlanActions";
import { Button } from "../components/ui/Button";
import { Sheet } from "../components/ui/Sheet";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { TextField } from "../components/ui/TextField";
import { useToast } from "../context/ToastContext";
import { takePlanDayRequest } from "../hooks/planDayRequest";
import { useExerciseIndex } from "../hooks/useLogData";
import { usePlan, useSubstituteExercise } from "../hooks/usePlan";
import { useStartPlanSession } from "../hooks/useStartPlanSession";
import { useUnitPreference } from "../hooks/useUnitPreference";
import type { Plan } from "../services/api";
import { useTheme } from "../theme/theme";
import { radius, size, spacing, tracking, typography } from "../theme/tokens";
import { displayWeightRounded, exerciseKey, formatSet, type ExerciseSummary } from "../utils/exerciseHistory";
import {
  daySetCount,
  daysByWeekday,
  exerciseTags,
  getPlanWeekDays,
  isRestDayTitle,
  isTrainingDay,
  planDayShortName,
  planWeekCount,
  restLabel,
  type PlanDay,
  type PlanExercise,
} from "../utils/planData";
import { weightLabel, type WeightUnit } from "../utils/unitConversion";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const REASON_MAX = 150;
/** Today as 0 = Monday … 6 = Sunday. */
const todayIndex = () => (new Date().getDay() + 6) % 7;

export default function PlanDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plan, isLoading, isError, refetch } = usePlan(id);

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, padding: spacing.screen, gap: spacing.lg }}>
        <BackHeader />
        {isLoading ? (
          <View style={{ gap: spacing.md }} accessibilityLabel="Loading plan">
            <SkeletonBlock height={size.exerciseRow} radius="lg" />
            <SkeletonBlock height={size.goalCard} radius="xl" />
            <SkeletonBlock height={size.goalCard} radius="xl" />
          </View>
        ) : (
          <View style={{ gap: spacing.md, alignItems: "center", paddingTop: spacing.xl }}>
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>{isError ? "Couldn't load this plan." : "This plan no longer exists."}</Text>
            {isError && <Button title="Try again" variant="tonal" onPress={() => void refetch()} />}
          </View>
        )}
      </View>
    );
  }
  return <DayView plan={plan} />;
}

function DayView({ plan }: { plan: Plan }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { unit } = useUnitPreference();
  const { summaries } = useExerciseIndex();
  const startSession = useStartPlanSession();
  const substitute = useSubstituteExercise();

  const weeks = planWeekCount(plan.planData);
  const [week, setWeek] = useState(Math.min(Math.max(plan.weekNumber || 1, 1), weeks));
  const days = useMemo(() => daysByWeekday(getPlanWeekDays(plan.planData, week)), [plan.planData, week]);
  const trainingCount = days.filter(isTrainingDay).length;

  // Start on today; on a rest day, the next training day.
  const [selected, setSelected] = useState(() => {
    const t = todayIndex();
    for (let i = 0; i < 7; i++) if (isTrainingDay(days[(t + i) % 7])) return (t + i) % 7;
    return t;
  });
  useEffect(() => {
    if (selected > 6) setSelected(0);
  }, [selected]);
  // Back from the coach's "View plan": open the first day it changed.
  useFocusEffect(
    useCallback(() => {
      const day = takePlanDayRequest(plan.id);
      if (day != null) setSelected(day);
    }, [plan.id]),
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<PlanExercise | null>(null);
  const [reason, setReason] = useState("");

  const day = days[selected];
  const restNote = days[selected]?.recoveryNote?.trim();
  const training = isTrainingDay(day);
  const exercises = training ? (day.exercises ?? []).filter((e) => e.name) : [];
  const isToday = selected === todayIndex() && week === (plan.weekNumber || 1);
  const short = training ? planDayShortName(day) : "Rest";

  const swap = () => {
    const ex = swapTarget;
    if (!ex?.exerciseId) return;
    substitute.mutate(
      { planId: plan.id, exerciseId: ex.exerciseId, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          showToast({ type: "success", message: "Exercise swapped", subtitle: `${ex.name} was replaced.` });
          setSwapTarget(null);
          setReason("");
        },
        onError: (e) => showToast({ type: "error", message: "Couldn't swap", subtitle: aiErrorMessage(e) }),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ minHeight: size.appBar, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingLeft: spacing.xs, paddingRight: spacing.sm }}>
        <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.headlineMd, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} numberOfLines={1} accessibilityRole="header">
            {plan.name}
          </Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
            Week {week} · {trainingCount} training {trainingCount === 1 ? "day" : "days"}
            {plan.isActive ? " · Active" : ""}
          </Text>
        </View>
        <IconButton icon="forum" label="Ask the plan coach" onPress={() => router.push({ pathname: "/plan-chat", params: { id: plan.id } })} />
        <IconButton icon="settings" label="Plan options" onPress={() => setMenuOpen(true)} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.lg }}>
        {/* Weeks (only when the plan has more than one) */}
        {weeks > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
              <Pressable
                key={w}
                onPress={() => setWeek(w)}
                accessibilityRole="button"
                accessibilityState={{ selected: w === week }}
                style={({ pressed }) => ({
                  minHeight: size.control - spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.full,
                  justifyContent: "center",
                  backgroundColor: w === week ? colors.accentSubtle : pressed ? colors.surfaceContainerHigh : colors.raised,
                })}
              >
                <Text style={[typography.labelLg, { color: w === week ? colors.accent : colors.textSecondary }]}>Week {w}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Day tabs */}
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {days.map((d, i) => (
            <DayTab key={i} index={i} day={d} selected={i === selected} today={i === todayIndex()} onPress={() => setSelected(i)} />
          ))}
        </View>

        {/* Session overview */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: size.divider, borderBottomColor: colors.surfaceContainerHigh }}>
          <Text style={[typography.bodyMdMedium, { flex: 1, color: colors.text }]}>
            {WEEKDAY_LONG[selected]} · {short}
            {training ? (
              <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
                {"  "}· {exercises.length} exercises, {daySetCount(day)} sets
              </Text>
            ) : null}
          </Text>
          {training && day.estimatedDurationMinutes ? <Text style={[typography.labelMd, { color: colors.accent }]}>Est. {day.estimatedDurationMinutes} min</Text> : null}
        </View>

        {training ? (
          exercises.map((e, i) => (
            <ExerciseCard key={`${e.name}-${i}`} exercise={e} unit={unit} summary={summaries.get(exerciseKey(e.name!))} onSwap={e.exerciseId ? () => setSwapTarget(e) : undefined} />
          ))
        ) : (
          <View style={{ alignItems: "center", gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.raised }}>
            <MaterialIcons name="self-improvement" size={size.iconLg * 2} color={colors.accent} />
            <Text style={[typography.headlineSm, { color: colors.text }]}>Rest day</Text>
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>
              {restNote && !isRestDayTitle(restNote) ? restNote : "Recovery is part of the plan."}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Start this session */}
      {training && (
        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.bg }}>
          <Button
            title={isToday ? `Start today's ${short} session` : `Start ${WEEKDAY_SHORT[selected]} · ${short}`}
            icon="play"
            onPress={() => startSession(exercises.map((e) => ({ name: e.name, sets: e.sets, restSeconds: e.restSeconds })), day.targetMuscles)}
            fullWidth
          />
        </View>
      )}

      {/* Swap */}
      <Sheet
        visible={!!swapTarget}
        onClose={substitute.isPending ? undefined : () => setSwapTarget(null)}
        title={`Swap ${swapTarget?.name ?? ""}`}
        subtitle="The AI picks a replacement that trains the same muscles with your equipment."
      >
        <TextField label="Why swap? (optional)" placeholder="e.g. hurts my shoulder, no rack free" value={reason} onChangeText={setReason} maxLength={REASON_MAX} />
        <Button title={substitute.isPending ? "Finding a replacement…" : "Swap with AI"} icon="swap-horizontal" onPress={swap} loading={substitute.isPending} disabled={substitute.isPending} fullWidth />
      </Sheet>

      <PlanActions plan={menuOpen ? plan : null} onClose={() => setMenuOpen(false)} leaveOnDelete />
    </View>
  );
}

/* ==============================
   PIECES
   ============================== */

function IconButton({ icon, label, onPress }: { icon: "arrow-back" | "forum" | "settings"; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: size.control, height: size.control, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
    >
      <MaterialIcons name={icon} size={icon === "arrow-back" ? size.iconLg : size.icon} color={icon === "arrow-back" ? colors.text : colors.textSecondary} />
    </Pressable>
  );
}

function BackHeader() {
  return (
    <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", marginLeft: -spacing.sm }}>
      <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
    </View>
  );
}

const DayTab = memo(function DayTab({ index, day, selected, today, onPress }: { index: number; day: PlanDay | null; selected: boolean; today: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const training = isTrainingDay(day);
  const label = training ? planDayShortName(day) : "Rest";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${WEEKDAY_LONG[index]}: ${training ? label : "rest day"}${today ? ", today" : ""}`}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: size.exerciseRow,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xxs,
        borderRadius: radius.lg,
        borderWidth: today && !selected ? 1 : 0,
        borderColor: colors.accent,
        backgroundColor: selected ? colors.accentSubtle : pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
      <Text style={[typography.labelSm, { fontSize: size.chartLabel, color: selected ? colors.accent : colors.textSecondary, textTransform: "uppercase" }]}>{WEEKDAY_SHORT[index]}</Text>
      <Text style={[typography.labelMd, { color: selected ? colors.accent : training ? colors.text : colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ width: size.dot, height: size.dot, borderRadius: radius.full, backgroundColor: training ? (selected ? colors.accent : colors.textSecondary) : "transparent" }} />
    </Pressable>
  );
});

const ExerciseCard = memo(function ExerciseCard({ exercise, unit, summary, onSwap }: { exercise: PlanExercise; unit: WeightUnit; summary?: ExerciseSummary; onSwap?: () => void }) {
  const { colors } = useTheme();
  const tags = exerciseTags(exercise.name ?? "");
  const target = exercise.targetWeight_kg && exercise.targetWeight_kg > 0 ? `Target: ${displayWeightRounded(exercise.targetWeight_kg, unit)} ${weightLabel(unit)}` : null;
  const last = !target && summary?.lastBest ? `Last: ${formatSet(summary.lastBest, unit)}` : null;
  const rest = restLabel(exercise.restSeconds);
  const meta = [target ?? last, rest ? `Rest: ${rest}` : null].filter(Boolean).join(" · ");

  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          {tags ? <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{tags}</Text> : null}
          <Text style={[typography.headlineSm, { color: colors.text }]}>{exercise.name}</Text>
          {exercise.substitutedFrom ? <Text style={[typography.labelSm, { color: colors.textMuted }]}>Swapped from {exercise.substitutedFrom}</Text> : null}
        </View>
        {onSwap ? <Button title="Swap" icon="swap-vertical" variant="tonal" onPress={onSwap} accessibilityLabel={`Swap ${exercise.name}`} /> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
        <Text style={[typography.headlineSm, { color: colors.text }]}>
          {exercise.sets ?? "–"} sets <Text style={{ color: colors.textMuted }}>×</Text> {exercise.reps ?? "–"} reps
        </Text>
        {meta ? <Text style={[typography.labelMd, { flex: 1, color: colors.textSecondary, textAlign: "right" }]}>{meta}</Text> : null}
      </View>
      {exercise.progressionNote ? (
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          <MaterialIcons name="trending-up" size={size.iconSm} color={colors.accent} />
          <Text style={[typography.labelSm, { flex: 1, color: colors.textSecondary }]}>{exercise.progressionNote}</Text>
        </View>
      ) : null}
    </View>
  );
});

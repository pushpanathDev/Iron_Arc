import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, SkeletonBlock } from "../ui";
import { formatMuscles, isRestDayTitle, type PlanDay, type PlanExercise } from "../../utils/planData";
import { useStartPlanSession } from "../../hooks/useStartPlanSession";
import type { Session } from "../../hooks/useWorkoutSummary";
import { useTheme } from "../../theme/theme";
import { alpha, radius, size, spacing, tracking, typography, withAlpha } from "../../theme/tokens";
import { perfStart } from "../../utils/perf";
import { displayWeight, weightLabel } from "../../utils/unitConversion";
import { formatDate } from "../../utils/weekUtils";
import { useCountUp, sessionName } from "./homeShared";

const MAX_CHIPS = 6;

type ChipItem = { name: string; done?: boolean };

export function TodayCard({
  loadingPlan,
  planDay,
  hasPlan,
  todaySession,
  nextSessionNumber,
  unit,
  trainingDayToday,
}: {
  loadingPlan: boolean;
  planId: string | null;
  planDay: PlanDay | null;
  hasPlan: boolean;
  todaySession: Session | null;
  nextSessionNumber: number;
  unit: "kg" | "lbs";
  /** From the user's chosen weekdays; null when they haven't picked any. */
  trainingDayToday: boolean | null;
}) {
  const { colors } = useTheme();
  const startPlanSession = useStartPlanSession();
  const volume = useCountUp(todaySession ? Math.round(displayWeight(todaySession.volumeKg, unit)) : 0, !!todaySession);
  // The one card you act on: same surface as the rest, lit by an accent glow (HeroGlow).
  const shell = {
    backgroundColor: colors.raised,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: "hidden" as const,
  };

  if (loadingPlan && !todaySession) {
    return (
      <View style={shell}>
        <HeroGlow />
        <SkeletonBlock width="25%" height={typography.labelMd.lineHeight} radius="sm" />
        <SkeletonBlock width="55%" height={typography.headlineMd.lineHeight} radius="sm" />
        <SkeletonBlock height={size.control} radius="lg" />
      </View>
    );
  }

  const sessionNumber = todaySession ? todaySession.number : nextSessionNumber;
  const trainingToday = hasPlan && !!planDay && planDay.sessionType !== "rest";
  // Opens History on today with the session expanded.
  const viewWorkout = () => router.navigate({ pathname: "/(tabs)/history", params: { date: todaySession?.date ?? formatDate(new Date()) } });
  const logWorkout = () => {
    perfStart("open picker");
    router.push("/workout/pick");
  };

  // No plan and nothing logged: one action. AI plans have their own card on
  // Home, so they stay reachable whether or not you've trained today.
  if (!hasPlan && !todaySession) {
    const rest = trainingDayToday === false;
    return (
      <View style={shell}>
        <HeroGlow />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[typography.labelMd, { color: colors.accent, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Today</Text>
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh }}>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Session {sessionNumber}</Text>
          </View>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="header" style={[typography.headlineMd, { color: colors.text }]}>
            {trainingDayToday == null ? "Ready to train?" : rest ? "Rest day" : "Training day"}
          </Text>
          <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
            {rest ? "Not one of your training days. Train anyway if you feel like it." : "Nothing logged yet today."}
          </Text>
        </View>
        <Button title={rest ? "Start a workout anyway" : "Start workout"} icon="play" haptic fullWidth onPress={logWorkout} />
      </View>
    );
  }

  let badge: { label: string; done?: boolean } = { label: "Today" };
  let title: string;
  let subtitle: string;
  let chips: ChipItem[] = [];
  let button: { title: string; icon?: "play"; onPress: () => void; haptic?: boolean };

  if (trainingToday && planDay) {
    const planned = (planDay.exercises ?? []).filter((e) => e.name);
    const logged = new Set((todaySession?.exercises ?? []).map(normalizeExercise));
    const isLogged = (e: PlanExercise) =>
      logged.has(normalizeExercise(e.name ?? "")) || (!!e.exerciseId && logged.has(normalizeExercise(e.exerciseId)));
    const doneCount = planned.filter(isLogged).length;
    title = planDay.name || formatMuscles(planDay.targetMuscles) || "Workout";

    if (planned.length > 0 && doneCount === planned.length && todaySession) {
      // Plan complete.
      badge = { label: "Done today", done: true };
      subtitle = sessionSummary(todaySession, volume, unit);
      chips = planned.map((e) => ({ name: e.name!, done: true }));
      button = { title: "View workout", onPress: viewWorkout };
    } else if (doneCount > 0) {
      // In progress.
      subtitle = `${doneCount} of ${planned.length} exercises done`;
      chips = planned.map((e) => ({ name: e.name!, done: isLogged(e) }));
      const remaining = planned.filter((e) => !isLogged(e));
      button = {
        title: "Continue workout",
        icon: "play",
        haptic: true,
        onPress: () => startPlanSession(remaining, planDay.targetMuscles),
      };
    } else {
      // Planned, nothing logged.
      subtitle = [
        `${planned.length} ${planned.length === 1 ? "exercise" : "exercises"}`,
        planDay.estimatedDurationMinutes ? `about ${planDay.estimatedDurationMinutes} min` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      chips = planned.map((e) => ({ name: e.name! }));
      button = {
        title: "Start workout",
        icon: "play",
        haptic: true,
        onPress: () => startPlanSession(planned, planDay.targetMuscles),
      };
    }
  } else if (todaySession) {
    // No plan workout today (no plan, rest day, or day not in plan) but something was logged.
    badge = { label: "Logged today" };
    title = sessionName(todaySession);
    subtitle = sessionSummary(todaySession, volume, unit);
    chips = todaySession.exercises.map((name) => ({ name }));
    button = { title: "View workout", onPress: viewWorkout };
  } else {
    // Rest day (or nothing scheduled today), nothing logged.
    const note = planDay?.recoveryNote?.trim();
    title = "Rest day";
    subtitle = note && !isRestDayTitle(note) ? note : planDay ? "Recovery is part of the plan." : "Nothing is scheduled today.";
    button = { title: "Start a workout anyway", onPress: logWorkout };
  }

  const shown = chips.slice(0, MAX_CHIPS);

  return (
    <View style={shell}>
      <HeroGlow />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {badge.done && <MaterialIcons name="check-circle" size={size.iconSm} color={colors.accent} />}
          <Text style={[typography.labelMd, { color: colors.accent, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>{badge.label}</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh }}>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Session {sessionNumber}</Text>
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.headlineMd, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      {shown.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.inline }}>
          {shown.map((c, i) => (
            <View
              key={`${c.name}-${i}`}
              accessibilityLabel={c.done ? `${c.name}, done` : c.name}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceContainerHigh,
              }}
            >
              {c.done && <MaterialIcons name="check" size={size.iconXs} color={colors.accent} />}
              <Text style={[typography.labelSm, { color: c.done ? colors.textSecondary : colors.text }]}>{c.name}</Text>
            </View>
          ))}
          {chips.length > shown.length && (
            <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>+{chips.length - shown.length} more</Text>
            </View>
          )}
        </View>
      )}
      <Button title={button.title} icon={button.icon} haptic={button.haptic} fullWidth onPress={button.onPress} />
    </View>
  );
}

/** Accent glow from the top-left corner, fading into the card surface; text stays on the plain surface tone. */
function HeroGlow() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[withAlpha(colors.accentContainer, alpha.faint), withAlpha(colors.accentContainer, alpha.band), withAlpha(colors.accentContainer, 0)]}
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    />
  );
}

/** Case/punctuation-insensitive key for matching plan exercises to logged ones. */
function normalizeExercise(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "2 exercises · 6 sets · 900 kg" (volume omitted for bodyweight-only sessions). */
function sessionSummary(s: Session, volume: number, unit: "kg" | "lbs") {
  const parts = [
    `${s.exercises.length} ${s.exercises.length === 1 ? "exercise" : "exercises"}`,
    `${s.sets} ${s.sets === 1 ? "set" : "sets"}`,
  ];
  if (s.volumeKg > 0) parts.push(`${volume.toLocaleString()} ${weightLabel(unit)}`);
  return parts.join(" · ");
}

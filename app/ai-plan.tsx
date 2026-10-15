/**
 * AI plans (AI_Plans_Plan_List mockup): the active routine, other saved
 * plans, and "Generate new plan" (settings sheet → honest loading screen).
 */
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState, type ComponentProps } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GeneratingOverlay } from "../components/plans/GeneratingOverlay";
import { aiErrorMessage, PlanActions } from "../components/plans/PlanActions";
import { PlanSettingsSheet } from "../components/plans/PlanSettingsSheet";
import { Button } from "../components/ui/Button";
import { Reveal } from "../components/ui/Reveal";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, effectiveWeeklyGoal, formatDays } from "../data/trainingProfile";
import { useToast } from "../providers/ToastContext";
import { useActivatePlan, useGeneratePlan, usePlans } from "../hooks/usePlan";
import { useProfile } from "../hooks/useProfile";
import { useAllWorkouts } from "../hooks/useWorkouts";
import type { Plan, PlanCriteriaPayload } from "../services/api";
import { useTheme } from "../theme/theme";
import { radius, size, spacing, tracking, typography } from "../theme/tokens";
import { planSummary } from "../utils/planData";
import { DAY_MS } from "../utils/dates";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

/** "today", "yesterday", "3 days ago", "12 Sep". */
function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
/** The plan's own summary, cut to its first two sentences. */
const firstSentences = (text: string) => (text.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join(" ") ?? text).trim();

export default function AIPlanScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast, clearErrors } = useToast();
  const { data: profile } = useProfile();
  const { data: workouts } = useAllWorkouts();
  const { data, isLoading, isError, refetch } = usePlans();
  const generate = useGeneratePlan();
  const activate = useActivatePlan();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [menuFor, setMenuFor] = useState<Plan | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const plans = useMemo(() => [...(data ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.updatedAt.localeCompare(a.updatedAt)), [data]);
  const active = plans.find((p) => p.isActive) ?? null;
  const others = plans.filter((p) => !p.isActive);

  /** Exactly what the server builds from (shown while generating). */
  const inputs = useMemo(() => {
    const days = profile?.trainingDays?.length ? `${profile.trainingDays.length} training days (${formatDays(profile.trainingDays)})` : `${effectiveWeeklyGoal(profile) ?? 4} training days a week`;
    const eq = EQUIPMENT_OPTIONS.find((o) => o.value === profile?.equipment)?.label;
    const xp = EXPERIENCE_OPTIONS.find((o) => o.value === profile?.experienceLevel)?.label;
    return [days, profile?.sessionMinutes ? `${profile.sessionMinutes} min sessions` : null, eq, xp, workouts?.length ? "Your recent workouts" : "No workout history yet: starting conservatively"].filter(
      (x): x is string => !!x,
    );
  }, [profile, workouts?.length]);

  const onGenerate = (criteria: PlanCriteriaPayload) => {
    setSettingsOpen(false);
    setWaiting(true);
    // A retry makes the last "Couldn't create the plan" out of date.
    clearErrors();
    generate.mutate(criteria, {
      onSuccess: ({ data: plan }) => {
        showToast({ type: "success", message: "Your new plan is ready", subtitle: plan.name });
        router.push({ pathname: "/plan-detail", params: { id: plan.id } });
      },
      onError: (e) => showToast({ type: "error", message: "Couldn't create the plan", subtitle: aiErrorMessage(e) }),
      onSettled: () => setWaiting(false),
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingLeft: spacing.xs, paddingRight: spacing.screen }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({ width: size.control, height: size.control, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.text} />
        </Pressable>
        <Text style={[typography.headlineMd, { flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
          AI plans
        </Text>
        {active && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.accentSubtle }}>
            <View style={{ width: size.dot, height: size.dot, borderRadius: radius.full, backgroundColor: colors.accent }} />
            <Text style={[typography.labelMd, { color: colors.accent }]}>1 Active</Text>
          </View>
        )}
      </View>

      {isLoading && plans.length === 0 ? (
        <View style={{ padding: spacing.screen, gap: spacing.lg }} accessibilityLabel="Loading plans">
          <SkeletonBlock height={size.goalCard * 2.2} radius="xl" />
          <SkeletonBlock height={size.goalCard * 1.3} radius="xl" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} />}
        >
          {isError && plans.length === 0 ? (
            <EmptyCard icon="cloud-off" title="Couldn't load your plans" body="Check your connection and pull down to try again." />
          ) : plans.length === 0 ? (
            <Reveal index={0}>
              <IntroCard onGenerate={() => setSettingsOpen(true)} busy={generate.isPending} />
            </Reveal>
          ) : null}

          {active && (
            <Reveal index={0} style={{ gap: spacing.sm }}>
              <SectionLabel left="Current routine" right={`Updated ${ago(active.updatedAt)}`} />
              <ActiveCard plan={active} onMenu={() => setMenuFor(active)} />
            </Reveal>
          )}

          {others.length > 0 && (
            <Reveal index={1} style={{ gap: spacing.sm }}>
              <SectionLabel left={active ? "Other plans" : "Your plans"} right={`${others.length} saved`} />
              {others.map((p) => (
                <OtherCard
                  key={p.id}
                  plan={p}
                  onMenu={() => setMenuFor(p)}
                  activating={activate.isPending && activate.variables === p.id}
                  onActivate={() =>
                    activate.mutate(p.id, {
                      onSuccess: () => showToast({ type: "success", message: `${p.name} is now active` }),
                      onError: (e) => showToast({ type: "error", message: "Couldn't make it active", subtitle: aiErrorMessage(e) }),
                    })
                  }
                />
              ))}
            </Reveal>
          )}
        </ScrollView>
      )}

      {/* Generate (the intro card has its own button before the first plan) */}
      {plans.length > 0 && (
        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.bg }}>
          <Button title="Generate new plan" icon="add" onPress={() => setSettingsOpen(true)} disabled={generate.isPending} loading={generate.isPending && !waiting} fullWidth />
        </View>
      )}

      <PlanSettingsSheet visible={settingsOpen} profile={profile} generating={generate.isPending} onClose={() => setSettingsOpen(false)} onGenerate={onGenerate} />
      <GeneratingOverlay visible={waiting} title="Building your week…" inputs={inputs} onStopWaiting={() => setWaiting(false)} />
      <PlanActions plan={menuFor} onClose={() => setMenuFor(null)} />
    </View>
  );
}

// Pieces

function SectionLabel({ left, right }: { left: string; right?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>{left}</Text>
      {right ? <Text style={[typography.labelSm, { color: colors.textMuted }]}>{right}</Text> : null}
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: "accent" | "muted" }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.md, backgroundColor: tone === "accent" ? colors.accentSubtle : colors.surfaceContainerHigh }}>
      <Text style={[typography.labelSm, { color: tone === "accent" ? colors.accent : colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function MenuButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} options`}
      style={({ pressed }) => ({ width: size.control, height: size.control, marginRight: -spacing.sm, marginTop: -spacing.sm, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
    >
      <MaterialIcons name="more-vert" size={size.icon} color={colors.textSecondary} />
    </Pressable>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      <MaterialIcons name={icon} size={size.iconSm} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function ActiveCard({ plan, onMenu }: { plan: Plan; onMenu: () => void }) {
  const { colors } = useTheme();
  const s = planSummary(plan);
  return (
    <View style={{ gap: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.accentSubtle }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            <Chip label="Active" tone="accent" />
            <Chip label={`Week ${plan.weekNumber || 1}`} tone="muted" />
          </View>
          <Text style={[typography.headlineLg, { color: colors.text }]}>{plan.name}</Text>
        </View>
        <MenuButton onPress={onMenu} label={plan.name} />
      </View>
      {s.explanation ? <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{firstSentences(s.explanation)}</Text> : null}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Stat icon="event" label="Frequency" value={`${s.trainingDays} ${s.trainingDays === 1 ? "day" : "days"} a week`} />
        {s.minutes ? <Stat icon="schedule" label="Duration" value={`${s.minutes} min / session`} /> : null}
      </View>
      <Button title="View day-by-day plan" trailingIcon="chevron-forward" variant="tonal" onPress={() => router.push({ pathname: "/plan-detail", params: { id: plan.id } })} fullWidth />
    </View>
  );
}

function OtherCard({ plan, onMenu, onActivate, activating }: { plan: Plan; onMenu: () => void; onActivate: () => void; activating: boolean }) {
  const { colors } = useTheme();
  const s = planSummary(plan);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/plan-detail", params: { id: plan.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${plan.name}. ${s.trainingDays} days a week${s.minutes ? `, ${s.minutes} minute sessions` : ""}. Opens the plan`}
      style={({ pressed }) => ({ gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Chip label="Saved" tone="muted" />
        <Text style={[typography.labelSm, { flex: 1, color: colors.textMuted }]}>Created {shortDate(plan.createdAt)}</Text>
        <Pressable onPress={onActivate} disabled={activating} accessibilityRole="button" hitSlop={spacing.sm} style={({ pressed }) => ({ opacity: pressed || activating ? 0.6 : 1 })}>
          <Text style={[typography.labelLg, { color: colors.accent }]}>{activating ? "Activating…" : "Make active"}</Text>
        </Pressable>
        <MenuButton onPress={onMenu} label={plan.name} />
      </View>
      <Text style={[typography.headlineSm, { color: colors.text }]}>{plan.name}</Text>
      {s.explanation ? (
        <Text style={[typography.bodyMd, { color: colors.textSecondary }]} numberOfLines={2}>
          {firstSentences(s.explanation)}
        </Text>
      ) : null}
      <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
        • {s.trainingDays} {s.trainingDays === 1 ? "day" : "days"} a week{s.minutes ? `   • ${s.minutes} min sessions` : ""}
      </Text>
    </Pressable>
  );
}

/** Before the first plan: what you get, and the one button. */
function IntroCard({ onGenerate, busy }: { onGenerate: () => void; busy: boolean }) {
  const { colors } = useTheme();
  const points: [IconName, string, string][] = [
    ["event", "A week built around you", "Your training days, session length, equipment and experience"],
    ["swap-horiz", "Swap anything", "Don't like an exercise? The AI picks one for the same muscles"],
    ["forum", "Ask the coach", "\"Make it 3 days\" or \"shorter sessions\" and the plan changes"],
    ["play-arrow", "Start in one tap", "Each day opens straight into the log with its sets"],
  ];
  return (
    <View style={{ gap: spacing.lg, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.accentSubtle }}>
      <View style={{ alignItems: "center", gap: spacing.md }}>
        <View style={{ width: size.iconBadge, height: size.iconBadge, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accent }}>
          <MaterialIcons name="auto-awesome" size={size.iconLg} color={colors.accent} />
        </View>
        <Text style={[typography.headlineMd, { color: colors.text, textAlign: "center" }]}>Your first AI plan</Text>
        <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>Built from your profile in about a minute.</Text>
      </View>
      <View style={{ gap: spacing.md }}>
        {points.map(([icon, title, body]) => (
          <View key={title} style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
              <MaterialIcons name={icon} size={size.icon} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{title}</Text>
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Button title="Generate my plan" icon="sparkles" onPress={onGenerate} loading={busy} disabled={busy} fullWidth />
    </View>
  );
}

function EmptyCard({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.raised }}>
      <View style={{ width: size.iconBadge, height: size.iconBadge, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
        <MaterialIcons name={icon} size={size.iconLg} color={colors.accent} />
      </View>
      <Text style={[typography.headlineSm, { color: colors.text, textAlign: "center", textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>{title}</Text>
      <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>{body}</Text>
    </View>
  );
}

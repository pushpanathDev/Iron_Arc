import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { AVOID_OPTIONS, defaultSplitFor, effectiveWeeklyGoal, EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, formatDays, SESSION_OPTIONS, SPLIT_LABELS } from "../../data/trainingProfile";
import type { PlanCriteriaPayload, User } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { GOALS } from "../onboarding/OnboardingProfileSetup";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

type Split = "full_body" | "upper_lower" | "push_pull_legs" | "body_part";
type Pace = "conservative" | "moderate" | "aggressive";

const SPLITS: { value: Split; label: string }[] = [
  { value: "full_body", label: "Full body" },
  { value: "upper_lower", label: "Upper / Lower" },
  { value: "push_pull_legs", label: "Push / Pull / Legs" },
  { value: "body_part", label: "Body part" },
];
const PACES: { value: Pace; label: string; hint: string }[] = [
  { value: "conservative", label: "Steady", hint: "Slow, sustainable" },
  { value: "moderate", label: "Standard", hint: "Balanced" },
  { value: "aggressive", label: "Fast", hint: "Push harder" },
];
const PRIORITY = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "legs", label: "Legs" },
  { key: "glutes", label: "Glutes" },
  { key: "core", label: "Core" },
];

const labelOf = <T,>(options: { value: T; label: string }[], v: T | null | undefined) => options.find((o) => o.value === v)?.label ?? null;

export type PlanSettingsSheetProps = {
  visible: boolean;
  profile: User | null | undefined;
  generating: boolean;
  onClose: () => void;
  onGenerate: (criteria: PlanCriteriaPayload) => void;
};

/**
 * New plan: asks nothing already answered. The profile (goal, days, session,
 * equipment, experience, go-easy areas) is shown as a summary the server
 * reads directly; only plan-only choices live here, each with a default.
 */
export function PlanSettingsSheet({ visible, profile, generating, onClose, onGenerate }: PlanSettingsSheetProps) {
  const { colors } = useTheme();
  const [split, setSplit] = useState<Split | null>(null); // null = automatic from days
  const [pace, setPace] = useState<Pace>("moderate");
  const [priority, setPriority] = useState<string[]>([]);
  useEffect(() => {
    if (!visible) return;
    setSplit(null);
    setPace("moderate");
    setPriority([]);
  }, [visible]);

  const days = effectiveWeeklyGoal(profile) ?? 4;
  const autoSplit = defaultSplitFor(days);
  const summary: [ComponentProps<typeof MaterialIcons>["name"], string, string | null][] = [
    ["track-changes", "Goal", GOALS.find((g) => g.id === profile?.fitnessGoal)?.title ?? null],
    ["calendar-today", "Training days", profile?.trainingDays?.length ? formatDays(profile.trainingDays) : null],
    ["timer", "Session", labelOf(SESSION_OPTIONS, profile?.sessionMinutes)],
    ["fitness-center", "Equipment", labelOf(EQUIPMENT_OPTIONS, profile?.equipment)],
    ["military-tech", "Experience", labelOf(EXPERIENCE_OPTIONS, profile?.experienceLevel)],
    ["healing", "Go easy on", profile?.avoidAreas?.length ? profile.avoidAreas.map((a) => labelOf(AVOID_OPTIONS, a)).join(", ") : "Nothing"],
  ];
  const missing = summary.filter(([, , v]) => !v).length;

  const generate = () =>
    onGenerate({
      ...(split ? { splitPreference: split } : {}),
      intensity: pace,
      ...(priority.length ? { priorityMuscles: priority } : {}),
    });

  return (
    <Sheet visible={visible} onClose={generating ? undefined : onClose} title="New plan" subtitle="Built from your profile. Pick the plan-only options if you like.">
      {/* From the profile (not asked again) */}
      <View style={{ borderRadius: radius.lg, backgroundColor: colors.raised, padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>From your profile</Text>
          <Pressable
            onPress={() => {
              onClose();
              router.navigate("/(tabs)/profile");
            }}
            accessibilityRole="button"
            hitSlop={spacing.sm}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[typography.labelLg, { color: colors.accent }]}>Edit in Profile</Text>
          </Pressable>
        </View>
        {summary.map(([icon, k, v]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: size.iconLg }}>
            <MaterialIcons name={icon} size={size.iconSm} color={colors.accent} />
            <Text style={[typography.labelMd, { flex: 1, color: colors.textSecondary }]}>{k}</Text>
            <Text style={[typography.labelMd, { flexShrink: 1, textAlign: "right", color: v ? colors.text : colors.warning }]} numberOfLines={1}>
              {v ?? "Not set"}
            </Text>
          </View>
        ))}
        {missing > 0 && <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Anything not set uses a sensible default.</Text>}
      </View>

      {/* Plan-only choices */}
      <Group label="Weekly split" note={split ? undefined : `Auto: ${SPLIT_LABELS[autoSplit] ?? autoSplit} for ${days} days`}>
        <Chips options={[{ value: null, label: "Auto" }, ...SPLITS]} value={split} onChange={setSplit} />
      </Group>
      <Group label="Priority muscles" note="Optional: a little extra volume">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {PRIORITY.map((m) => {
            const on = priority.includes(m.key);
            return (
              <ChipButton key={m.key} label={m.label} on={on} onPress={() => setPriority((p) => (on ? p.filter((x) => x !== m.key) : [...p, m.key]))} />
            );
          })}
        </View>
      </Group>
      <Group label="Progression pace" note={PACES.find((p) => p.value === pace)?.hint}>
        <Chips options={PACES} value={pace} onChange={setPace} />
      </Group>

      <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.accentTint }}>
        <MaterialIcons name="update" size={size.iconSm} color={colors.accent} />
        <Text style={[typography.labelSm, { flex: 1, color: colors.textSecondary }]}>Recalibrate any time: the AI adjusts sets and weights from your recent workouts.</Text>
      </View>

      <Button title="Generate plan" icon="sparkles" onPress={generate} loading={generating} disabled={generating} fullWidth />
    </Sheet>
  );
}

function Group({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm }}>
        <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>{label}</Text>
        {note ? <Text style={[typography.labelSm, { flexShrink: 1, color: colors.accent, textAlign: "right" }]}>{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Chips<T>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {options.map((o) => (
        <ChipButton key={String(o.value)} label={o.label} on={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

function ChipButton({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({
        minHeight: size.control,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: on ? colors.accent : colors.border,
        backgroundColor: on ? colors.accentSubtle : pressed ? colors.surfaceContainerHigh : "transparent",
      })}
    >
      <Text style={[typography.labelLg, { color: on ? colors.accent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

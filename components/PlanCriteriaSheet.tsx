/**
 * PlanCriteriaSheet
 *
 * A bottom-sheet that collects real fitness programming parameters before
 * the AI generates a workout plan. Each criterion directly shapes the Groq
 * prompt and produces a far more personalised output.
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
export interface PlanCriteria {
  sessionDuration: 30 | 45 | 60 | 90;
  equipment: "full_gym" | "dumbbells" | "bodyweight";
  experienceLevel: "beginner" | "intermediate" | "advanced";
  splitPreference: "full_body" | "upper_lower" | "push_pull_legs" | "body_part";
  progressionStyle: "linear" | "undulating" | "block";
  priorityMuscles: string[];
  intensity: "conservative" | "moderate" | "aggressive";
  restDayLayout: "spread" | "weekends" | "back_to_back";
}

export const DEFAULT_CRITERIA: PlanCriteria = {
  sessionDuration: 60,
  equipment: "full_gym",
  experienceLevel: "intermediate",
  splitPreference: "push_pull_legs",
  progressionStyle: "linear",
  priorityMuscles: [],
  intensity: "moderate",
  restDayLayout: "spread",
};

/* ─────────────────────────────────────────────────────────────
   Option Definitions
───────────────────────────────────────────────────────────── */
const SESSION_DURATIONS: Array<{ value: PlanCriteria["sessionDuration"]; label: string; sub: string }> = [
  { value: 30, label: "30 min", sub: "Quick" },
  { value: 45, label: "45 min", sub: "Efficient" },
  { value: 60, label: "60 min", sub: "Standard" },
  { value: 90, label: "90 min", sub: "Extended" },
];

const EQUIPMENT_OPTIONS: Array<{ value: PlanCriteria["equipment"]; label: string; icon: string; sub: string }> = [
  { value: "full_gym", label: "Full Gym", icon: "barbell-outline", sub: "Barbells, cables, machines" },
  { value: "dumbbells", label: "Dumbbells", icon: "fitness-outline", sub: "DB + bench at home or gym" },
  { value: "bodyweight", label: "Bodyweight", icon: "body-outline", sub: "No equipment needed" },
];

const EXPERIENCE_OPTIONS: Array<{ value: PlanCriteria["experienceLevel"]; label: string; sub: string; color: string }> = [
  { value: "beginner", label: "Beginner", sub: "< 1 year training", color: "#22C55E" },
  { value: "intermediate", label: "Intermediate", sub: "1–3 years training", color: "#F59E0B" },
  { value: "advanced", label: "Advanced", sub: "3+ years training", color: "#EF4444" },
];

const SPLIT_OPTIONS: Array<{ value: PlanCriteria["splitPreference"]; label: string; sub: string; days: string }> = [
  { value: "full_body", label: "Full Body", sub: "Train all muscles every session", days: "3×/wk ideal" },
  { value: "upper_lower", label: "Upper / Lower", sub: "Alternate upper & lower body", days: "4×/wk ideal" },
  { value: "push_pull_legs", label: "Push / Pull / Legs", sub: "PPL — most popular advanced split", days: "6×/wk ideal" },
  { value: "body_part", label: "Body Part", sub: "Classic bro split, one muscle/day", days: "5×/wk ideal" },
];

const PROGRESSION_OPTIONS: Array<{ value: PlanCriteria["progressionStyle"]; label: string; sub: string; icon: string }> = [
  { value: "linear", label: "Linear", sub: "Add weight every session — best for beginners", icon: "trending-up-outline" },
  { value: "undulating", label: "Undulating (DUP)", sub: "Vary reps/intensity daily — best intermediate", icon: "pulse-outline" },
  { value: "block", label: "Block (Periodisation)", sub: "4-week focus phases — best advanced", icon: "layers-outline" },
];

const MUSCLE_OPTIONS = [
  { key: "chest", label: "Chest", icon: "fitness-outline" },
  { key: "back", label: "Back", icon: "body-outline" },
  { key: "shoulders", label: "Shoulders", icon: "person-outline" },
  { key: "arms", label: "Arms", icon: "barbell-outline" },
  { key: "legs", label: "Legs", icon: "walk-outline" },
  { key: "glutes", label: "Glutes", icon: "ellipse-outline" },
  { key: "core", label: "Core", icon: "flash-outline" },
  { key: "cardio", label: "Cardio", icon: "heart-outline" },
];

const INTENSITY_OPTIONS: Array<{ value: PlanCriteria["intensity"]; label: string; sub: string; color: string }> = [
  { value: "conservative", label: "Conservative", sub: "Slow, sustainable progress — low injury risk", color: "#22C55E" },
  { value: "moderate", label: "Moderate", sub: "Balanced challenge and recovery", color: "#F59E0B" },
  { value: "aggressive", label: "Aggressive", sub: "Push hard — faster gains, higher fatigue", color: "#EF4444" },
];

const REST_DAY_OPTIONS: Array<{ value: PlanCriteria["restDayLayout"]; label: string; sub: string; icon: string }> = [
  { value: "spread", label: "Spread Out", sub: "Rest days evenly between sessions", icon: "grid-outline" },
  { value: "weekends", label: "Weekends Off", sub: "Mon–Fri training, Sat–Sun rest", icon: "home-outline" },
  { value: "back_to_back", label: "2 Rest Days Together", sub: "All rest days consecutive", icon: "pause-outline" },
];

/* ─────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────── */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>
      <Text style={{ ...typography.label, color: colors.textMuted, letterSpacing: 0.8 }}>
        {title.toUpperCase()}
      </Text>
      {subtitle && (
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function Chip({
  label,
  sub,
  selected,
  onPress,
  accentColor,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  accentColor?: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const accent = accentColor ?? colors.accent;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? accent : colors.cardBorder,
        backgroundColor: selected ? accent + "14" : colors.surface,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          ...typography.caption,
          color: selected ? accent : colors.textPrimary,
          fontWeight: selected ? "700" : "500",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
      {sub && (
        <Text
          style={{
            fontSize: 10,
            color: selected ? accent : colors.textMuted,
            textAlign: "center",
            marginTop: 1,
          }}
        >
          {sub}
        </Text>
      )}
    </Pressable>
  );
}

function CardOption({
  label,
  sub,
  icon,
  selected,
  onPress,
  accentColor,
  rightLabel,
}: {
  label: string;
  sub: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
  accentColor?: string;
  rightLabel?: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const accent = accentColor ?? colors.accent;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? accent : colors.cardBorder,
        backgroundColor: selected ? accent + "10" : colors.surface,
        marginBottom: spacing.sm,
      }}
    >
      {icon && (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.full,
            backgroundColor: selected ? accent + "20" : colors.surfaceElevated,
            justifyContent: "center",
            alignItems: "center",
            marginRight: spacing.md,
          }}
        >
          <Ionicons name={icon as any} size={18} color={selected ? accent : colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...typography.bodyMedium,
            color: selected ? accent : colors.textPrimary,
            fontWeight: selected ? "700" : "500",
          }}
        >
          {label}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 1 }}>
          {sub}
        </Text>
      </View>
      {rightLabel && (
        <View
          style={{
            backgroundColor: selected ? accent + "20" : colors.surfaceElevated,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: selected ? accent : colors.textMuted,
              fontWeight: "600",
            }}
          >
            {rightLabel}
          </Text>
        </View>
      )}
      {selected && !rightLabel && (
        <Ionicons name="checkmark-circle" size={20} color={accent} />
      )}
    </Pressable>
  );
}

function MuscleTag({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.cardBorder,
        backgroundColor: selected ? colors.accentLight : colors.surface,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <Ionicons
        name={icon as any}
        size={14}
        color={selected ? colors.accent : colors.textSecondary}
        style={{ marginRight: 5 }}
      />
      <Text
        style={{
          ...typography.caption,
          color: selected ? colors.accent : colors.textSecondary,
          fontWeight: selected ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
interface PlanCriteriaSheetProps {
  visible: boolean;
  criteria: PlanCriteria;
  onChange: (updated: Partial<PlanCriteria>) => void;
  onGenerate: () => void;
  onClose: () => void;
  isGenerating?: boolean;
  isRegenerate?: boolean;
}

export function PlanCriteriaSheet({
  visible,
  criteria,
  onChange,
  onGenerate,
  onClose,
  isGenerating,
  isRegenerate,
}: PlanCriteriaSheetProps) {
  const { colors, spacing, radius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(800)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 800,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const toggleMuscle = (key: string) => {
    const current = criteria.priorityMuscles;
    const next = current.includes(key)
      ? current.filter((m) => m !== key)
      : [...current, key];
    onChange({ priorityMuscles: next });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
        onPress={onClose}
      />

      {/* Sheet */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.background,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: "92%",
          transform: [{ translateY: slideAnim }],
          ...shadows.lg,
        }}
      >
        {/* Handle */}
        <View style={{ alignItems: "center", paddingTop: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.cardBorder,
            }}
          />
        </View>

        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.h3, color: colors.textPrimary }}>
              {isRegenerate ? "Regenerate Plan" : "Customise Your Plan"}
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
              These choices shape every set, rep, and exercise
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={{
              padding: spacing.sm,
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.full,
            }}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Scrollable content */}
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + 120,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Session Duration ── */}
          <SectionHeader
            title="Session Length"
            subtitle="How long do you have per workout?"
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {SESSION_DURATIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                sub={opt.sub}
                selected={criteria.sessionDuration === opt.value}
                onPress={() => onChange({ sessionDuration: opt.value })}
              />
            ))}
          </View>

          {/* ── Equipment ── */}
          <SectionHeader
            title="Available Equipment"
            subtitle="We only suggest exercises you can actually do"
          />
          {EQUIPMENT_OPTIONS.map((opt) => (
            <CardOption
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              icon={opt.icon}
              selected={criteria.equipment === opt.value}
              onPress={() => onChange({ equipment: opt.value })}
            />
          ))}

          {/* ── Experience Level ── */}
          <SectionHeader
            title="Experience Level"
            subtitle="Sets complexity, rep ranges, and exercise selection"
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                sub={opt.sub}
                selected={criteria.experienceLevel === opt.value}
                onPress={() => onChange({ experienceLevel: opt.value })}
                accentColor={opt.color}
              />
            ))}
          </View>

          {/* ── Split Preference ── */}
          <SectionHeader
            title="Weekly Split"
            subtitle="How you want your training week structured"
          />
          {SPLIT_OPTIONS.map((opt) => (
            <CardOption
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={criteria.splitPreference === opt.value}
              onPress={() => onChange({ splitPreference: opt.value })}
              rightLabel={opt.days}
            />
          ))}

          {/* ── Progression Style ── */}
          <SectionHeader
            title="Progression Style"
            subtitle="How the AI increases difficulty over weeks"
          />
          {PROGRESSION_OPTIONS.map((opt) => (
            <CardOption
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              icon={opt.icon}
              selected={criteria.progressionStyle === opt.value}
              onPress={() => onChange({ progressionStyle: opt.value })}
            />
          ))}

          {/* ── Priority Muscles ── */}
          <SectionHeader
            title="Priority Muscles"
            subtitle="Add extra volume to these areas (optional)"
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {MUSCLE_OPTIONS.map((m) => (
              <MuscleTag
                key={m.key}
                label={m.label}
                icon={m.icon}
                selected={criteria.priorityMuscles.includes(m.key)}
                onPress={() => toggleMuscle(m.key)}
              />
            ))}
          </View>

          {/* ── Intensity ── */}
          <SectionHeader
            title="Progression Intensity"
            subtitle="How aggressively load increases each week"
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {INTENSITY_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                sub={opt.sub}
                selected={criteria.intensity === opt.value}
                onPress={() => onChange({ intensity: opt.value })}
                accentColor={opt.color}
              />
            ))}
          </View>

          {/* ── Rest Day Layout ── */}
          <SectionHeader
            title="Rest Day Layout"
            subtitle="When do you prefer your recovery days?"
          />
          {REST_DAY_OPTIONS.map((opt) => (
            <CardOption
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              icon={opt.icon}
              selected={criteria.restDayLayout === opt.value}
              onPress={() => onChange({ restDayLayout: opt.value })}
            />
          ))}
        </ScrollView>

        {/* ── Sticky Generate Button ── */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + spacing.md,
            paddingTop: spacing.md,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
          }}
        >
          <Pressable
            onPress={onGenerate}
            disabled={isGenerating}
            style={{
              backgroundColor: isGenerating ? colors.textMuted : colors.accent,
              borderRadius: radius.xl,
              paddingVertical: spacing.md + 2,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.sm,
              opacity: isGenerating ? 0.7 : 1,
            }}
          >
            <Ionicons
              name={isGenerating ? "hourglass-outline" : "sparkles"}
              size={20}
              color={colors.onAccent}
            />
            <Text style={{ color: colors.onAccent, fontWeight: "700", fontSize: 17 }}>
              {isGenerating
                ? "Generating your plan…"
                : isRegenerate
                  ? "Regenerate Plan"
                  : "Generate My Plan"}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

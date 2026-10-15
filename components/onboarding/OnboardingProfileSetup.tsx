/**
 * Profile setup, in two short steps (about a minute, mostly taps):
 *   1. About you: name, age, height, weight (optional)
 *   2. Your training: goal, experience, training days, session length,
 *      equipment, and optional fine-tuning (target weight, areas to avoid)
 * Every answer feeds the AI plan or something the app shows; nothing else is
 * asked. Saves through the onComplete callback.
 */

import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef, useState, type ElementRef, type ReactNode, type Ref } from "react";
import { Reveal } from "../ui/Reveal";
import { Text, TextInput, View, type KeyboardTypeOptions, type LayoutChangeEvent } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, touchTarget, tracking, typography } from "../../theme/tokens";
import { kgToLbs, toKg, weightLabel } from "../../utils/unitConversion";
import {
  AVOID_OPTIONS,
  DEFAULT_SESSION_MINUTES,
  DEFAULT_TRAINING_DAYS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  SESSION_OPTIONS,
  type AvoidArea,
  type Equipment,
  type ExperienceLevel,
  type SessionMinutes,
  type Weekday,
} from "../../data/trainingProfile";
import { ChoiceChips } from "../training/ChoiceChips";
import { TrainingDaysPicker } from "../training/TrainingDaysPicker";
import { HeightRuler, type HeightUnit } from "./HeightRuler";
import { Button, FadingMessage, PressableScale } from "../ui";
import type { MaterialIconName } from "../ui/iconName";

export type FitnessGoal = "strength" | "muscle" | "endurance" | "weight-loss" | "general";

export type ProfileSetupResult = {
  name: string;
  age: number;
  fitnessGoal: FitnessGoal;
  heightCm: number;
  weightKg: number | null;
  /** Number of training days (mirrors trainingDays.length). */
  weeklyGoal: number;
  experienceLevel: ExperienceLevel;
  equipment: Equipment;
  sessionMinutes: SessionMinutes;
  trainingDays: Weekday[];
  avoidAreas: AvoidArea[];
  targetWeightKg: number | null;
};

type Props = {
  initialName?: string;
  /** Resolves true when saved; false keeps the user on this screen. */
  onComplete: (result: ProfileSetupResult) => Promise<boolean>;
  onBack: () => void;
};


/** Fitness goals (onboarding cards; Profile → Fitness goal). */
export const GOALS: { id: FitnessGoal; title: string; description: string; icon: MaterialIconName }[] = [
  { id: "strength", title: "Build strength", description: "Heavy loads, low reps", icon: "fitness-center" },
  { id: "muscle", title: "Build muscle", description: "Hypertrophy volume, 8–12 reps", icon: "sports-gymnastics" },
  { id: "weight-loss", title: "Lose weight", description: "Conditioning and calorie burn", icon: "local-fire-department" },
  { id: "general", title: "Stay fit", description: "Balanced health and mobility", icon: "favorite" },
  { id: "endurance", title: "Build endurance", description: "Stamina and work capacity", icon: "directions-run" },
];

const GOAL_ROWS = GOALS.reduce<(typeof GOALS)[]>((rows, g, i) => {
  if (i % 2 === 0) rows.push([g]);
  else rows[rows.length - 1].push(g);
  return rows;
}, []);

const DEFAULT_HEIGHT_CM = 170;
const AGE_MIN = 13;
const AGE_MAX = 100;
const WEIGHT_MIN_KG = 20;
const WEIGHT_MAX_KG = 300;

type Field = "name" | "age" | "weight" | "goal" | "experience" | "days" | "equipment" | "target";
const STEP1_FIELDS: Field[] = ["name", "age", "weight"];
const STEP2_FIELDS: Field[] = ["goal", "experience", "days", "equipment", "target"];
/** Target weight is offered only where it means something. */
const TARGET_GOALS: FitnessGoal[] = ["weight-loss", "muscle"];

// Small building blocks

function SectionCard({
  title,
  right,
  children,
  onLayout,
  index = 0,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Entrance order (cards rise in one after another). */
  index?: number;
}) {
  const { colors } = useTheme();
  return (
    // Reveal carries onLayout so scroll-to-field still gets the card's position in the form.
    <Reveal index={index} onLayout={onLayout} style={{ backgroundColor: colors.raised, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        <Text
          accessibilityRole="header"
          style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}
        >
          {title}
        </Text>
        {right}
      </View>
      {children}
    </Reveal>
  );
}

function MetricField({
  label,
  value,
  onChangeText,
  placeholder,
  suffix,
  keyboardType = "default",
  error,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string | null;
  inputRef?: Ref<TextInput>;
  returnKeyType?: "next" | "done";
  onSubmitEditing?: () => void;
  autoComplete?: "name" | "off";
  /** One line under the field explaining what it is. */
  hint?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs, flex: 1 }}>
      <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{label}</Text>
      <View
        style={{
          height: size.control,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceContainerLowest,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          borderWidth: error ? size.divider : 0,
          borderColor: colors.danger,
        }}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.borderStrong}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoComplete={autoComplete}
          accessibilityLabel={suffix ? `${label} in ${suffix}` : label}
          accessibilityHint={error ?? undefined}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={[typography.headlineSm, { flex: 1, height: size.control, color: colors.text, paddingVertical: 0 }]}
        />
        {suffix && <Text style={[typography.labelSm, { color: colors.borderStrong }]}>{suffix}</Text>}
      </View>
      {hint ? <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{hint}</Text> : null}
      <FadingMessage message={error} color={colors.danger} live />
    </View>
  );
}

/** "Step 1 of 2" as two bars. */
function StepDots({ step }: { step: 1 | 2 }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`Step ${step} of 2`} style={{ flexDirection: "row", gap: spacing.xs, paddingBottom: spacing.xs }}>
      {[1, 2].map((n) => (
        <View key={n} style={{ flex: 1, height: size.progressBar, borderRadius: radius.full, backgroundColor: n <= step ? colors.accent : colors.surfaceContainerHighest }} />
      ))}
    </View>
  );
}

// Screen

export function OnboardingProfileSetup({ initialName = "", onComplete, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { unit: weightUnit } = useUnitPreference();

  const [name, setName] = useState(initialName);
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState<FitnessGoal | null>(null);
  const [heightCm, setHeightCm] = useState(DEFAULT_HEIGHT_CM);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [weight, setWeight] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [days, setDays] = useState<Weekday[]>(DEFAULT_TRAINING_DAYS);
  const [session, setSession] = useState<SessionMinutes>(DEFAULT_SESSION_MINUTES);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [fineTune, setFineTune] = useState(false);
  const [target, setTarget] = useState("");
  const [avoid, setAvoid] = useState<AvoidArea[]>([]);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ElementRef<typeof KeyboardAwareScrollView>>(null);
  const ageRef = useRef<TextInput>(null);
  const offsets = useRef<Partial<Record<Field, number>>>({});
  const track = (field: Field, also?: Field) => (e: LayoutChangeEvent) => {
    offsets.current[field] = e.nativeEvent.layout.y;
    if (also) offsets.current[also] = e.nativeEvent.layout.y;
  };

  const clearError = (field: Field) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const parseKg = (text: string) => toKg(Number(text.replace(",", ".")), weightUnit);
  const weightRangeError =
    weightUnit === "kg"
      ? `Enter a weight from ${WEIGHT_MIN_KG} to ${WEIGHT_MAX_KG} kg.`
      : `Enter a weight from ${Math.ceil(kgToLbs(WEIGHT_MIN_KG))} to ${Math.floor(kgToLbs(WEIGHT_MAX_KG))} lbs.`;

  const validate = (which: 1 | 2) => {
    const next: Partial<Record<Field, string>> = {};
    if (which === 1) {
      if (!name.trim()) next.name = "Enter your name.";
      const ageNum = Number(age);
      if (!age.trim() || !Number.isInteger(ageNum) || ageNum < AGE_MIN || ageNum > AGE_MAX) {
        next.age = `Enter an age from ${AGE_MIN} to ${AGE_MAX}.`;
      }
      if (weight.trim()) {
        const kg = parseKg(weight);
        if (!Number.isFinite(kg) || kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) next.weight = weightRangeError;
      }
    } else {
      if (!goal) next.goal = "Choose a goal.";
      if (!experience) next.experience = "Choose your experience.";
      if (days.length === 0) next.days = "Pick at least one training day.";
      if (!equipment) next.equipment = "Choose your equipment.";
      if (showTarget && target.trim()) {
        const kg = parseKg(target);
        if (!Number.isFinite(kg) || kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) next.target = weightRangeError;
      }
    }
    return next;
  };

  const showErrors = (next: Partial<Record<Field, string>>, fields: Field[]) => {
    setErrors(next);
    const firstInvalid = fields.find((f) => next[f]);
    if (!firstInvalid) return false;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (firstInvalid === "target") setFineTune(true);
    scrollRef.current?.scrollTo({ y: Math.max(0, (offsets.current[firstInvalid] ?? 0) - spacing.lg), animated: true });
    return true;
  };

  const next = () => {
    if (showErrors(validate(1), STEP1_FIELDS)) return;
    setStep(2);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const back = () => {
    if (step === 2) {
      setErrors({});
      setStep(1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } else onBack();
  };

  const finish = async () => {
    if (savingRef.current) return;
    if (showErrors(validate(2), STEP2_FIELDS)) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const ok = await onComplete({
        name: name.trim(),
        age: Number(age),
        fitnessGoal: goal!,
        heightCm,
        weightKg: weight.trim() ? Math.round(parseKg(weight) * 10) / 10 : null,
        weeklyGoal: days.length,
        experienceLevel: experience!,
        equipment: equipment!,
        sessionMinutes: session,
        trainingDays: days,
        avoidAreas: avoid,
        targetWeightKg: showTarget && target.trim() ? Math.round(parseKg(target) * 10) / 10 : null,
      });
      if (!ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const showTarget = !!goal && TARGET_GOALS.includes(goal);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View style={{ height: size.appBar, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PressableScale
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={step === 2 ? "Back to about you" : "Back to intro"}
          style={{ width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }}
        >
          {({ pressed }) => <MaterialIcons name="arrow-back" size={size.iconLg} color={pressed ? colors.text : colors.textSecondary} />}
        </PressableScale>
        <Text
          accessibilityRole="header"
          style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}
        >
          {step === 1 ? "About you" : "Your training"}
        </Text>
        <View style={{ width: touchTarget }} />
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={size.keyboardClearance}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.lg }}
      >
        <View style={{ paddingTop: spacing.sm, gap: spacing.xs }}>
          <StepDots step={step} />
          <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>
            {step === 1 ? "Set your baseline" : "How you train"}
          </Text>
          <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
            {step === 1 ? "These numbers tune your plans, targets and stats." : "Your AI plan is built from these. Change them anytime in Profile."}
          </Text>
        </View>

        {step === 1 && (
          <>

        {/* 1. Identity */}
        <SectionCard index={0} title="Athlete identity" onLayout={track("name", "age")}>
          <MetricField
            label="Display name"
            value={name}
            onChangeText={(t) => {
              setName(t);
              clearError("name");
            }}
            placeholder="Your name"
            autoComplete="name"
            returnKeyType="next"
            onSubmitEditing={() => ageRef.current?.focus()}
            error={errors.name}
          />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <MetricField
              label="Age"
              inputRef={ageRef}
              value={age}
              onChangeText={(t) => {
                setAge(t.replace(/[^0-9]/g, ""));
                clearError("age");
              }}
              placeholder="Age"
              suffix="yrs"
              keyboardType="number-pad"
              returnKeyType="done"
              error={errors.age}
            />
            <View style={{ flex: 1 }} />
          </View>
        </SectionCard>

        {/* 3. Stature */}
        <SectionCard index={1}
          title="Stature"
          right={
            <View
              accessibilityRole="radiogroup"
              style={{
                height: size.linkMin,
                padding: spacing.xxs,
                borderRadius: radius.md,
                flexDirection: "row",
                backgroundColor: colors.surfaceContainerLowest,
              }}
            >
              {(["cm", "ft"] as HeightUnit[]).map((u) => {
                const active = heightUnit === u;
                return (
                  <PressableScale
                    key={u}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setHeightUnit(u);
                    }}
                    hitSlop={{ top: (touchTarget - size.linkMin) / 2, bottom: (touchTarget - size.linkMin) / 2 }}
                    accessibilityRole="radio"
                    accessibilityLabel={u === "cm" ? "Centimetres" : "Feet and inches"}
                    accessibilityState={{ selected: active }}
                    style={{
                      height: "100%",
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.sm,
                      justifyContent: "center",
                      backgroundColor: active ? colors.surfaceContainerHigh : "transparent",
                    }}
                  >
                    <Text style={[typography.labelSm, { color: active ? colors.accent : colors.borderStrong }]}>
                      {u === "cm" ? "cm" : "ft-in"}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          }
        >
          <View style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", gap: spacing.md }}>
            {/* The ruler shows its own live readout (smooth scrolling: the form only updates when it settles). */}
            <View style={{ alignSelf: "stretch" }}>
              <HeightRuler cm={heightCm} unit={heightUnit} onChangeCm={setHeightCm} />
            </View>
            <Text style={[typography.labelSm, { color: colors.borderStrong, textAlign: "center" }]}>
              Used to tune your plans and stats.
            </Text>
          </View>
        </SectionCard>

        {/* 4. Weight (optional) */}
        <SectionCard index={2}
          title="Weight"
          onLayout={track("weight")}
          right={<Text style={[typography.labelSm, { color: colors.borderStrong }]}>Optional</Text>}
        >
          <MetricField
            label="Current weight"
            value={weight}
            onChangeText={(t) => {
              setWeight(t.replace(/[^0-9.,]/g, ""));
              clearError("weight");
            }}
            placeholder={weightUnit === "kg" ? "e.g. 78.5" : "e.g. 173"}
            suffix={weightLabel(weightUnit)}
            keyboardType="decimal-pad"
            returnKeyType="done"
            error={errors.weight}
          />
          <Text style={[typography.labelSm, { color: colors.borderStrong }]}>You can log this anytime in the Weight tab.</Text>
        </SectionCard>

          </>
        )}

        {step === 2 && (
          <>
        {/* Goal */}
        <SectionCard index={0}
          title="Primary objective"
          onLayout={track("goal")}
          right={<Text style={[typography.labelSm, { color: goal ? colors.accent : colors.textSecondary }]}>{goal ? "1 selected" : "Choose one"}</Text>}
        >
          <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
            {GOAL_ROWS.map((row) => (
              <View key={row[0].id} style={{ flexDirection: "row", gap: spacing.sm }}>
                {row.map((g) => {
              const selected = goal === g.id;
              return (
                <PressableScale
                  key={g.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setGoal(g.id);
                    clearError("goal");
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={`${g.title}. ${g.description}`}
                  accessibilityState={{ selected }}
                  style={{
                    flex: 1,
                    height: size.goalCard,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    justifyContent: "space-between",
                    backgroundColor: selected ? colors.surfaceContainerHigh : colors.surfaceContainerLowest,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <MaterialIcons name={g.icon} size={size.iconLg} color={selected ? colors.accent : colors.borderStrong} />
                    <View
                      style={{
                        width: size.goalDot,
                        height: size.goalDot,
                        borderRadius: radius.full,
                        backgroundColor: selected ? colors.accent : colors.surfaceContainerHighest,
                      }}
                    />
                  </View>
                  <View>
                    <Text style={[typography.headlineSm, { color: selected ? colors.accent : colors.text }]}>{g.title}</Text>
                    <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={2}>
                      {g.description}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
                {row.length === 1 && <View style={{ flex: 1 }} />}
              </View>
            ))}
          </View>
          <FadingMessage message={errors.goal} color={colors.danger} live />
        </SectionCard>

            <SectionCard index={1} title="Experience" onLayout={track("experience")}>
              <ChoiceChips accessibilityLabel="Training experience" options={EXPERIENCE_OPTIONS} value={experience} onChange={(v) => { setExperience(v); clearError("experience"); }} />
              <Text style={[typography.labelSm, { color: colors.borderStrong }]}>Sets how hard and how fast your plan progresses.</Text>
              <FadingMessage message={errors.experience} color={colors.danger} live />
            </SectionCard>

            <SectionCard index={2} title="Which days do you train?" onLayout={track("days")}>
              <TrainingDaysPicker value={days} onChange={(d) => { setDays(d); clearError("days"); }} />
              <Text style={[typography.labelSm, { color: colors.borderStrong }]}>Your plan, weekly goal and reminders follow these days.</Text>
              <FadingMessage message={errors.days} color={colors.danger} live />
            </SectionCard>

            <SectionCard index={3} title="Session length">
              <ChoiceChips accessibilityLabel="Session length" options={SESSION_OPTIONS} value={session} onChange={setSession} columns={2} />
            </SectionCard>

            <SectionCard index={4} title="Equipment" onLayout={track("equipment")}>
              <ChoiceChips accessibilityLabel="Equipment" options={EQUIPMENT_OPTIONS} value={equipment} onChange={(v) => { setEquipment(v); clearError("equipment"); }} />
              <FadingMessage message={errors.equipment} color={colors.danger} live />
            </SectionCard>

            {/* Optional fine-tuning, collapsed */}
            <SectionCard index={5} title="Fine-tune" onLayout={track("target")} right={<Text style={[typography.labelSm, { color: colors.borderStrong }]}>Optional</Text>}>
              <PressableScale
                onPress={() => setFineTune((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: fineTune }}
                accessibilityLabel={fineTune ? "Hide optional settings" : "Show optional settings"}
                style={{ minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={[typography.bodyMd, { color: colors.textSecondary, flex: 1 }]}>
                  {showTarget ? "Body weight goal and areas to go easy on" : "Areas to go easy on"}
                </Text>
                <MaterialIcons name={fineTune ? "expand-less" : "expand-more"} size={size.iconLg} color={colors.textSecondary} />
              </PressableScale>
              {fineTune && (
                <View style={{ gap: spacing.md }}>
                  {showTarget && (
                    <MetricField
                      label="Your body weight goal"
                      value={target}
                      onChangeText={(t) => {
                        setTarget(t.replace(/[^0-9.,]/g, ""));
                        clearError("target");
                      }}
                      placeholder={weightUnit === "kg" ? "e.g. 72" : "e.g. 160"}
                      hint="The body weight you are aiming for. It becomes your goal on the Weight page."
                      suffix={weightLabel(weightUnit)}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      error={errors.target}
                    />
                  )}
                  <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Go easy on</Text>
                    <ChoiceChips<AvoidArea> accessibilityLabel="Areas to go easy on" multiple options={AVOID_OPTIONS} value={avoid} onChange={setAvoid} columns={2} />
                    <Text style={[typography.labelSm, { color: colors.borderStrong }]}>Your plan avoids exercises that load these areas heavily.</Text>
                  </View>
                </View>
              )}
            </SectionCard>
          </>
        )}

        {/* Finish: at the natural end of the scroll, never overlapping fields */}
        <View style={{ paddingTop: spacing.sm, gap: spacing.md }}>
          <Button
            title={step === 1 ? "Continue" : "Finish setup"}
            trailingIcon="arrow-forward"
            uppercase
            haptic
            onPress={step === 1 ? next : finish}
            loading={saving}
            disabled={saving}
            fullWidth
            style={{ minHeight: size.ctaTall }}
          />
          <Text style={[typography.labelSm, { color: colors.borderStrong, textAlign: "center" }]}>
            You can change all of this later in Profile.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

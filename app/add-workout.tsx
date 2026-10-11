import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CategoryPicker from "../components/ui/CategoryPicker";
import ExercisePicker from "../components/ui/ExercisePicker";
import { ProfileCompletionPrompt } from "../components/ProfileCompletionPrompt";
import { RestTimer } from "../components/RestTimer";

import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { ExerciseCategory } from "../data/exercises";
import { workoutApi } from "../services/api";
import { useWorkout, useCreateWorkout, useUpdateWorkout } from "../hooks/useWorkouts";
import { useProfile, useUpdateProfile } from "../hooks/useProfile";
import { useUnitPreference } from "../hooks/useUnitPreference";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../theme/theme";
import { formatDate, parseLocalDate } from "../utils/weekUtils";
import { displayWeight, toKg, weightLabel, weightStep } from "../utils/unitConversion";

const setSchema = z.object({
  reps: z
    .string()
    .min(1, "Reps required")
    .refine((v) => Number(v) > 0, { message: "Reps must be > 0" })
    .refine((v) => Number(v) <= 999, { message: "Reps must be ≤ 999" }),
  weight: z
    .string()
    .min(1, "Weight required")
    .refine((v) => !isNaN(Number(v)), { message: "Weight must be a number" })
    .refine((v) => Number(v) >= 0, { message: "Weight must be ≥ 0" }),
});

const workoutSchema = z.object({
  exercise: z.string({ required_error: "Please select an exercise" }).min(1, "Please select an exercise"),
  category: z.string({ required_error: "Please select a category" }).min(1, "Please select a category"),
  sets: z.array(setSchema).min(1, "At least one set is required"),
});


/* =========================
   LONG PRESS BUTTON (for hold-to-increment)
   ========================= */
interface LongPressButtonProps {
  onIncrement: () => void;
  children: React.ReactNode;
  style?: any;
  initialDelay?: number;
  repeatInterval?: number;
}

function LongPressButton({
  onIncrement,
  children,
  style,
  initialDelay = 300, // Slower start for better control
  repeatInterval = 80,
}: LongPressButtonProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPressingRef = useRef(false);
  const pressCountRef = useRef(0);

  const scheduleNext = useCallback(
    (delay: number) => {
      // Guard: ensure only one timer runs at a time
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        // Guard: check if still pressing before executing
        if (!isPressingRef.current) {
          timerRef.current = null;
          return;
        }

        onIncrement();
        pressCountRef.current++;

        // Progressive acceleration: gradually reduce delay
        // Start at initialDelay, reduce by 3ms per increment, floor at repeatInterval
        const accelerationFactor = Math.max(
          0,
          initialDelay - pressCountRef.current * 3,
        );
        const nextDelay = Math.max(repeatInterval, accelerationFactor);

        scheduleNext(nextDelay);
      }, delay);
    },
    [onIncrement, initialDelay, repeatInterval],
  );

  const start = useCallback(() => {
    // Guard: prevent stacking multiple presses
    if (isPressingRef.current) {
      return;
    }

    isPressingRef.current = true;
    pressCountRef.current = 0;

    // Call immediately on first press
    onIncrement();
    pressCountRef.current++;

    // Schedule first repeat after initialDelay
    scheduleNext(initialDelay);
  }, [onIncrement, scheduleNext, initialDelay]);

  const stop = useCallback(() => {
    isPressingRef.current = false;

    // Immediately clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    pressCountRef.current = 0;
  }, []);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      onLongPress={() => {}} // Required for proper button feedback on some Android devices
      style={style}
    >
      {children}
    </Pressable>
  );
}

const REP_PRESETS = [12, 13, 14, 15];

export default function AddWorkout() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { id } = useLocalSearchParams();
  const isEdit = Boolean(id);
  const insets = useSafeAreaInsets();

  const { user } = useAuth();
  const { showToast } = useToast();

  // Fetch existing workout when in edit mode
  const { data: existingWorkout } = useWorkout(isEdit ? String(id) : "");
  const { data: profile, isFetching: isProfileFetching } = useProfile();
  const updateProfile = useUpdateProfile();
  const { unit, loaded: unitLoaded } = useUnitPreference();
  const step = weightStep(unit);

  const createWorkout = useCreateWorkout();
  const updateWorkout = useUpdateWorkout();

  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const profileCheckDoneRef = useRef(false);

  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState([{ reps: "", weight: "" }]);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [exercise, setExercise] = useState<string | null>(null);
  const [workoutDate, setWorkoutDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Save is "in progress" from the first tap until the screen navigates away:
  // the mutation's own pending state, plus the post-success delay before back().
  const submitLockRef = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const saving = createWorkout.isPending || updateWorkout.isPending || leaving;
  const [message, setMessage] = useState<string | null>(null);
  const [populated, setPopulated] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  /* =========================
     POPULATE FORM (EDIT MODE)
     ========================= */
  useEffect(() => {
    // Wait until the unit preference has been read from storage; otherwise
    // sets would fill in as kg under an lbs label and be divided by 2.2 on save.
    if (!unitLoaded) return;
    if (isEdit && existingWorkout && !populated) {
      setCategory((existingWorkout.category as ExerciseCategory) ?? null);
      setExercise(existingWorkout.exercise);
      setNotes(existingWorkout.notes ?? "");
      // Local-date parse: new Date("YYYY-MM-DD") is UTC and shifts the day.
      setWorkoutDate(parseLocalDate(existingWorkout.date));
      setSets(
        existingWorkout.sets.map((s) => ({
          reps: String(s.reps),
          weight: String(displayWeight(s.weight, unit)),
        })),
      );
      setPopulated(true);
    }
  }, [isEdit, existingWorkout, populated, unitLoaded, unit]);

  /* =========================
     PROFILE COMPLETION CHECK (NEW WORKOUT)
     ========================= */
  useEffect(() => {
    // Wait for any in-flight refetch so a stale persisted profile doesn't trigger the prompt.
    if (!isEdit && profile && !isProfileFetching && !profileCheckDoneRef.current) {
      profileCheckDoneRef.current = true;
      if (!profile.weight && !profile.age) {
        setShowProfileCompletion(true);
      }
    }
  }, [isEdit, profile, isProfileFetching]);

  /* =========================
     SAVE & HELPER FUNCTIONS
     ========================= */
  const addSet = () => setSets([...sets, { reps: "", weight: "" }]);

  const updateSet = (
    index: number,
    field: "reps" | "weight",
    value: string,
  ) => {
    const updated = [...sets];
    updated[index][field] = value;
    setSets(updated);
  };

  const incrementValue = (
    index: number,
    field: "reps" | "weight",
    step: number = 1,
  ) => {
    setSets((prev) => {
      const updated = [...prev];
      const currentValue = parseFloat(updated[index][field]) || 0;
      let newValue = Math.max(0, currentValue + step);

      // Safety bounds: prevent excessive values
      if (field === "weight") {
        // Cap weight at 999.9kg to prevent runaway values
        newValue = Math.min(999.9, newValue);
        updated[index][field] = newValue.toFixed(1);
      } else {
        // Cap reps at 999 to prevent runaway values
        newValue = Math.min(999, newValue);
        updated[index][field] = String(Math.floor(newValue));
      }

      return updated;
    });
  };

  const removeSet = (index: number) =>
    setSets(sets.filter((_, i) => i !== index));

  const saveWorkout = async () => {
    if (!user) return;

    // Zod validation
    const parsed = workoutSchema.safeParse({ exercise, category, sets });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      });
      setValidationErrors(errors);
      // Show the first error as a toast
      showToast({ message: parsed.error.issues[0].message, type: "warning" });
      return;
    }
    setValidationErrors({});

    // State updates are async, so a second tap in the same frame would get
    // past `isSaving`; the ref blocks it synchronously.
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    const parsedSets = sets.map((s) => ({
      reps: Number(s.reps),
      weight: toKg(Number(s.weight), unit),
    }));

    try {
      if (isEdit && id) {
        await updateWorkout.mutateAsync({
          id: String(id),
          data: {
            date: formatDate(workoutDate),
            exercise: exercise!,
            category: category!,
            notes: notes || null,
            sets: parsedSets,
          },
        });
      } else {
        await createWorkout.mutateAsync({
          date: formatDate(workoutDate),
          exercise: exercise!,
          category: category!,
          notes: notes || undefined,
          sets: parsedSets,
        });
      }

      // Keep the button disabled until the screen has navigated away; the
      // lock is never released on success because the screen unmounts.
      setLeaving(true);
      setMessage(isEdit ? "Workout updated ✓" : "Workout saved ✓");
      setTimeout(() => router.back(), 600);
    } catch (e) {
      console.error("Error saving workout:", e);
      submitLockRef.current = false; // allow a manual retry after a failure
    }
  };

  const handleProfileCompletion = async (
    weight: number | null,
    age: number | null
  ) => {
    const updates: { weight?: number; age?: number } = {};
    if (weight !== null && weight > 0) updates.weight = weight;
    if (age !== null && age > 0) updates.age = age;

    // Goes through the mutation hook so the cached ["profile"] is updated;
    // errors propagate to the prompt, which shows them inline.
    if (Object.keys(updates).length > 0) {
      await updateProfile.mutateAsync(updates);
    }

    setShowProfileCompletion(false);
    setMessage("Profile updated ✓");
    setTimeout(() => setMessage(null), 1500);
  };

  /* =========================
     UI
     ========================= */

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 12}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          padding: spacing.md,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
      {/* HEADER */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.xs,
          }}
        >
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={{ marginRight: spacing.sm }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ ...typography.h1, color: colors.textPrimary }}>
            {isEdit ? "Edit Workout" : "Add Workout"}
          </Text>
        </View>
        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            marginBottom: spacing.lg,
          }}
        >
          {isEdit ? "Update your workout details" : "Log your training session"}
        </Text>
      </Animated.View>

      {/* DATE PICKER */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.md,
          }}
        >
          DATE
        </Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceElevated,
          }}
        >
          <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
            {formatDate(workoutDate)}
          </Text>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: colors.accentLight,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
          </View>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={workoutDate}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, d) => {
              setShowDatePicker(false);
              if (d) setWorkoutDate(d);
            }}
          />
        )}
      </Animated.View>

      {/* EXERCISE SELECTION */}
      <Animated.View
        entering={FadeInUp.delay(150).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.md,
          }}
        >
          EXERCISE
        </Text>
        <CategoryPicker value={category} onChange={setCategory} />
        {validationErrors["category"] && (
          <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
            {validationErrors["category"]}
          </Text>
        )}
        <ExercisePicker
          category={category}
          value={exercise}
          onChange={setExercise}
        />
        {validationErrors["exercise"] && (
          <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
            {validationErrors["exercise"]}
          </Text>
        )}
      </Animated.View>

      {/* SETS */}
      <Animated.View entering={FadeInUp.delay(200).duration(400)}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.sm,
          }}
        >
          <Text style={{ ...typography.label, color: colors.textMuted }}>
            SETS
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={() => setShowRestTimer(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                backgroundColor: colors.secondaryLight,
                borderRadius: radius.lg,
              }}
            >
              <Ionicons name="timer-outline" size={16} color={colors.secondary} />
              <Text
                style={{
                  color: colors.secondary,
                  fontWeight: "600",
                  fontSize: 14,
                  marginLeft: 4,
                }}
              >
                Rest
              </Text>
            </Pressable>
            <Pressable
              onPress={addSet}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                backgroundColor: colors.accentLight,
                borderRadius: radius.lg,
              }}
            >
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text
                style={{
                  color: colors.accent,
                  fontWeight: "600",
                  fontSize: 14,
                  marginLeft: 4,
                }}
              >
                Add Set
              </Text>
            </Pressable>
          </View>
        </View>

        {sets.map((set, index) => (
          <Animated.View
            key={index}
            entering={FadeInUp.delay(250 + index * 30).duration(300)}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.md,
              marginBottom: spacing.sm,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              ...shadows.sm,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.sm,
              }}
            >
              <View
                style={{
                  backgroundColor: colors.accent,
                  paddingVertical: spacing.xxs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.md,
                }}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}
                >
                  SET {index + 1}
                </Text>
              </View>
              {sets.length > 1 && (
                <Pressable
                  onPress={() => removeSet(index)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.md,
                    backgroundColor: colors.errorLight,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={colors.error}
                  />
                </Pressable>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {/* Reps with +/- buttons */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                    marginBottom: spacing.xs,
                  }}
                >
                  Reps
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                  }}
                >
                  <LongPressButton
                    onIncrement={() => incrementValue(index, "reps", -1)}
                    style={{
                      width: 40,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceElevated,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </LongPressButton>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={set.reps}
                    onChangeText={(v) => updateSet(index, "reps", v)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.xs,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceElevated,
                      color: colors.textPrimary,
                      fontSize: 16,
                      fontWeight: "600",
                      textAlign: set.reps ? "center" : "left",
                      minWidth: 50,
                    }}
                  />
                  <LongPressButton
                    onIncrement={() => incrementValue(index, "reps", 1)}
                    style={{
                      width: 40,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: colors.accentLight,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="add" size={20} color={colors.accent} />
                  </LongPressButton>
                </View>
                {/* Quick reps presets */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.xs,
                    marginTop: spacing.xs,
                  }}
                >
                  {REP_PRESETS.map((value) => {
                    const isSelected = set.reps === String(value);
                    return (
                      <Pressable
                        key={value}
                        onPress={() =>
                          updateSet(index, "reps", String(value))
                        }
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: spacing.sm,
                          borderRadius: radius.md,
                          backgroundColor: isSelected
                            ? colors.accent
                            : colors.surfaceElevated,
                          borderWidth: 1,
                          borderColor: isSelected
                            ? colors.accent
                            : colors.cardBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: isSelected
                              ? colors.textOnAccent
                              : colors.textSecondary,
                          }}
                        >
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {/* Reps validation error — outside the presets row, inside reps column */}
                {validationErrors[`sets.${index}.reps`] && (
                  <Text style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>
                    {validationErrors[`sets.${index}.reps`]}
                  </Text>
                )}
              </View>
              {/* END reps column */}

              {/* Weight with +/- buttons */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                    marginBottom: spacing.xs,
                  }}
                >
                  Weight ({weightLabel(unit)})
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                  }}
                >
                  <LongPressButton
                    onIncrement={() => incrementValue(index, "weight", -step)}
                    style={{
                      width: 40,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceElevated,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </LongPressButton>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={set.weight}
                    onChangeText={(v) => updateSet(index, "weight", v)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.xs,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceElevated,
                      color: colors.textPrimary,
                      fontSize: 16,
                      fontWeight: "600",
                      textAlign: set.weight ? "center" : "left",
                      minWidth: 50,
                    }}
                  />
                  <LongPressButton
                    onIncrement={() => incrementValue(index, "weight", step)}
                    style={{
                      width: 40,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: colors.accentLight,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="add" size={20} color={colors.accent} />
                  </LongPressButton>
                </View>
                {/* Weight validation error — outside the buttons row, inside weight column */}
                {validationErrors[`sets.${index}.weight`] && (
                  <Text style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>
                    {validationErrors[`sets.${index}.weight`]}
                  </Text>
                )}
              </View>
              {/* END weight column */}

            </View>
            {/* END reps + weight row */}
          </Animated.View>
        ))}
      </Animated.View>

      {/* NOTES */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.md,
          }}
        >
          NOTES (OPTIONAL)
        </Text>
        <TextInput
          placeholder="Add any notes about your workout..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceElevated,
            color: colors.textPrimary,
            minHeight: 80,
            textAlignVertical: "top",
            fontSize: typography.body.fontSize,
          }}
        />
      </Animated.View>

      {/* MESSAGE */}
      {message && (
        <Animated.View entering={FadeInUp.duration(200)}>
          <Text
            style={{
              textAlign: "center",
              color: message.includes("✓") ? colors.success : colors.error,
              marginBottom: spacing.md,
              fontWeight: "500",
            }}
          >
            {message}
          </Text>
        </Animated.View>
      )}

      {/* SAVE BUTTON */}
      <Animated.View entering={FadeInUp.delay(350).duration(400)}>
        <Pressable
          onPress={saveWorkout}
          disabled={saving}
          style={{
            backgroundColor: colors.accent,
            padding: spacing.md,
            borderRadius: radius.xl,
            alignItems: "center",
            opacity: saving ? 0.6 : 1,
            ...shadows.md,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>
            {saving ? "Saving..." : isEdit ? "Update Workout" : "Save Workout"}
          </Text>
        </Pressable>
      </Animated.View>
      </ScrollView>

      {/* Profile Completion Prompt */}
      <ProfileCompletionPrompt
        visible={showProfileCompletion}
        onDismiss={() => {
          // User skipped profile completion — keep them on the form to log their workout
          setShowProfileCompletion(false);
        }}
        onSave={handleProfileCompletion}
        currentWeight={profile?.weight}
        currentAge={profile?.age}
        isLoading={updateProfile.isPending}
      />

      {/* Rest Timer */}
      <RestTimer
        visible={showRestTimer}
        onClose={() => setShowRestTimer(false)}
      />

    </KeyboardAvoidingView>
  );
}

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

import * as Crypto from "expo-crypto";

import CategoryPicker from "../components/ui/CategoryPicker";
import ExercisePicker from "../components/ui/ExercisePicker";

import { useAuth } from "../auth/AuthContext";
import { ExerciseCategory } from "../data/exercises";
import { getAllWorkouts, insertWorkout } from "../db/workouts";
import { useTheme } from "../theme/theme";
import { formatDate } from "../utils/weekUtils";

/* =========================
   SAFE UUID GENERATOR
   ========================= */
function generateWorkoutId() {
  try {
    return Crypto.randomUUID();
  } catch {
    // Ultra-rare fallback (should almost never happen)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

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
  initialDelay = 400,
  repeatInterval = 80,
}: LongPressButtonProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    onIncrement();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onIncrement, repeatInterval);
    }, initialDelay);
  }, [onIncrement, initialDelay, repeatInterval]);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return (
    <Pressable onPressIn={start} onPressOut={stop} style={style}>
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

  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState([{ reps: "", weight: "" }]);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [exercise, setExercise] = useState<string | null>(null);
  const [workoutDate, setWorkoutDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [originalCreatedAt, setOriginalCreatedAt] = useState<number | null>(
    null,
  );

  /* =========================
     LOAD WORKOUT (EDIT MODE)
     ========================= */
  useEffect(() => {
    if (!isEdit || !user) return;

    const loadWorkout = async () => {
      const workouts = await getAllWorkouts(user.uid);
      const workout = workouts.find((w) => w.id === id);
      if (!workout) return;

      setCategory((workout.category as ExerciseCategory) ?? null);
      setExercise(workout.exercise);
      setNotes(workout.notes ?? "");
      setWorkoutDate(new Date(workout.date));
      setOriginalCreatedAt(workout.createdAt);
      setSets(
        workout.sets.map((s) => ({
          reps: String(s.reps),
          weight: String(s.weight),
        })),
      );
    };

    loadWorkout();
  }, [id, user]);

  /* =========================
     SET HELPERS
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
      const newValue = Math.max(0, currentValue + step);
      updated[index][field] =
        field === "weight"
          ? newValue.toFixed(1)
          : String(Math.floor(newValue));
      return updated;
    });
  };

  const removeSet = (index: number) =>
    setSets(sets.filter((_, i) => i !== index));

  /* =========================
     SAVE WORKOUT
     ========================= */
  const saveWorkout = async () => {
    if (!category || !exercise || !user) {
      setMessage("Please select a category and exercise");
      return;
    }

    try {
      setSaving(true);

      const workout = {
        id: isEdit ? String(id) : generateWorkoutId(),
        userId: user.uid,
        date: formatDate(workoutDate),
        exercise,
        category,
        notes,
        createdAt: isEdit ? originalCreatedAt ?? Date.now() : Date.now(),
        sets: sets.map((s) => ({
          reps: Number(s.reps),
          weight: Number(s.weight),
        })),
      };

      // ✅ SQLite only (offline-first)
      // Firebase sync happens on pull-to-refresh via syncWorkoutQueue()
      await insertWorkout(workout);

      setMessage(isEdit ? "Workout updated ✓" : "Workout saved ✓");
      setTimeout(() => router.back(), 600);
    } catch (e) {
      console.error(e);
      setMessage("Failed to save workout");
    } finally {
      setSaving(false);
    }
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
          paddingBottom: spacing.xxl,
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
            onPress={() => router.back()}
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
        <ExercisePicker
          category={category}
          value={exercise}
          onChange={setExercise}
        />
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
              </View>

              {/* Weight with +/- buttons */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                    marginBottom: spacing.xs,
                  }}
                >
                  Weight (kg)
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                  }}
                >
                  <LongPressButton
                    onIncrement={() => incrementValue(index, "weight", -2.5)}
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
                    onIncrement={() => incrementValue(index, "weight", 2.5)}
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
              </View>
            </View>
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
    </KeyboardAvoidingView>
  );
}

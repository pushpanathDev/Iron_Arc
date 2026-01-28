import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";

import * as Crypto from "expo-crypto";

import Card from "../components/ui/Card";
import CategoryPicker from "../components/ui/CategoryPicker";
import ExercisePicker from "../components/ui/ExercisePicker";
import PrimaryButton from "../components/ui/PrimaryButton";

import { useAuth } from "../src/auth/AuthContext";
import { ExerciseCategory } from "../src/data/exercises";
import { getAllWorkouts, insertWorkout } from "../src/db/workouts";
import { syncWorkoutAdd } from "../src/firebase/sync";
import { useTheme } from "../src/theme/theme";
import { debugSQLite } from "./(tabs)/history";

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

export default function AddWorkout() {
  const { colors, spacing, radius } = useTheme();
  const { id } = useLocalSearchParams();
  const isEdit = Boolean(id);

  const { user } = useAuth();

  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState([{ reps: "", weight: "" }]);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [exercise, setExercise] = useState<string | null>(null);
  const [workoutDate, setWorkoutDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const formatDate = (date: Date) => date.toISOString().split("T")[0];

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
      setSets(
        workout.sets.map((s) => ({
          reps: String(s.reps),
          weight: String(s.weight),
        }))
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
    value: string
  ) => {
    const updated = [...sets];
    updated[index][field] = value;
    setSets(updated);
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
        createdAt: Date.now(),
        sets: sets.map((s) => ({
          reps: Number(s.reps),
          weight: Number(s.weight),
        })),
      };

      // ✅ SQLite (source of truth for UI)
      await insertWorkout(workout);
      await debugSQLite(user.uid);

      // ☁️ Firebase sync (background, non-blocking UX)
      await syncWorkoutAdd(user.uid, workout);

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
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.md,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: spacing.md,
        }}
      >
        {isEdit ? "Edit Workout" : "Add Workout"}
      </Text>

      {/* DATE + PICKERS */}
      <Card>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            padding: spacing.md,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: colors.textPrimary }}>
            {formatDate(workoutDate)}
          </Text>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={colors.textSecondary}
          />
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

        <CategoryPicker value={category} onChange={setCategory} />
        <ExercisePicker
          category={category}
          value={exercise}
          onChange={setExercise}
        />
      </Card>

      {/* SETS */}
      {sets.map((set, index) => (
        <Card key={index}>
          <Text style={{ color: colors.textPrimary }}>
            Set {index + 1}
          </Text>

          <TextInput
            placeholder="Reps"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={set.reps}
            onChangeText={(v) => updateSet(index, "reps", v)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.sm,
              marginTop: spacing.sm,
              color: colors.textPrimary,
            }}
          />

          <TextInput
            placeholder="Weight (kg)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={set.weight}
            onChangeText={(v) => updateSet(index, "weight", v)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.sm,
              marginTop: spacing.sm,
              color: colors.textPrimary,
            }}
          />

          {sets.length > 1 && (
            <PrimaryButton
              title="Remove Set"
              onPress={() => removeSet(index)}
            />
          )}
        </Card>
      ))}

      <PrimaryButton title="+ Add Set" onPress={addSet} />

      {/* NOTES */}
      <Card>
        <TextInput
          placeholder="Notes (optional)"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.sm,
            minHeight: 80,
            color: colors.textPrimary,
          }}
        />
      </Card>

      {message && (
        <Text style={{ color: colors.accent, marginVertical: spacing.sm }}>
          {message}
        </Text>
      )}

      <PrimaryButton
        title={
          saving ? "Saving..." : isEdit ? "Update Workout" : "Save Workout"
        }
        disabled={saving}
        onPress={saveWorkout}
      />
    </ScrollView>
  );
}

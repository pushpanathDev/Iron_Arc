import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { signOut } from "firebase/auth";
import { auth } from "../../src/firebase/config";

import { useTheme } from "../../src/theme/theme";
import { useAuth } from "../../src/auth/AuthContext";

import {
  Workout,
  deleteWorkoutById,
  getAllWorkouts,
  insertWorkout,
} from "../../src/db/workouts";

import {
  syncWorkoutAdd,
  syncWorkoutDelete,
} from "../../src/firebase/sync";

const SWIPE_THRESHOLD = -60;
const DELETE_WIDTH = 80;

export default function History() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [deletedWorkout, setDeletedWorkout] = useState<Workout | null>(null);

  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchWorkouts();
  }, [user]);

  const fetchWorkouts = async () => {
    const data = await getAllWorkouts(user!.uid);
    setWorkouts(data);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const deleteWorkout = async (workout: Workout) => {
    setDeletedWorkout(workout);
    setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));

    await deleteWorkoutById(workout.id, user!.uid);
    await syncWorkoutDelete(user!.uid, workout.id);

    undoTimer.current = setTimeout(() => {
      setDeletedWorkout(null);
    }, 4000);
  };

  const undoDelete = async () => {
    if (!deletedWorkout || !user) return;

    if (undoTimer.current) clearTimeout(undoTimer.current);

    await insertWorkout(deletedWorkout);
    await syncWorkoutAdd(user.uid, deletedWorkout);

    await fetchWorkouts();
    setDeletedWorkout(null);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <View style={{ padding: spacing.md }}>
        {/* HEADER */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            Workout History
          </Text>

          <Pressable onPress={handleLogout}>
            <Ionicons
              name="log-out-outline"
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* LIST */}
        {workouts.map((workout) => (
          <SwipeRow
            key={workout.id}
            workout={workout}
            onDelete={() => deleteWorkout(workout)}
          />
        ))}
      </View>

      {/* UNDO TOAST */}
      {deletedWorkout && (
        <View
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            right: 16,
            backgroundColor: colors.card,
            padding: spacing.md,
            borderRadius: radius.md,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textPrimary }}>
            Workout deleted
          </Text>

          <Pressable onPress={undoDelete}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>
              UNDO
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

/* =========================
   SWIPE ROW
   ========================= */
function SwipeRow({
  workout,
  onDelete,
}: {
  workout: Workout;
  onDelete: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd(() => {
      translateX.value =
        translateX.value < SWIPE_THRESHOLD
          ? withTiming(-DELETE_WIDTH)
          : withTiming(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={{
        marginBottom: spacing.sm,
        borderRadius: radius.md,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: DELETE_WIDTH,
          backgroundColor: "#DC2626",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Pressable onPress={onDelete}>
          <Ionicons name="trash" size={22} color="#FFF" />
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            animatedStyle,
            {
              backgroundColor: colors.card,
              padding: spacing.md,
              borderRadius: radius.md,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: colors.textPrimary,
            }}
          >
            {workout.exercise}
          </Text>

          <Text style={{ color: colors.textSecondary }}>
            {workout.date} • {workout.category}
          </Text>

          {workout.sets.map((set, i) => (
            <Text key={i} style={{ color: colors.textPrimary }}>
              Set {i + 1}: {set.reps} reps @ {set.weight} kg
            </Text>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

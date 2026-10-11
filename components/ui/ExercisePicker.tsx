import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useAuth } from "../../auth/AuthContext";
import {
  getExercisesForCategory,
  refreshExercisesForCategory,
} from "../../data/exerciseCatalog";
import { EXERCISES, ExerciseCategory } from "../../data/exercises";
import { exerciseApi, workoutApi } from "../../services/api";
import { useTheme } from "../../theme/theme";

type Props = {
  category: ExerciseCategory | null;
  value: string | null;
  onChange: (exercise: string) => void;
};

export default function ExercisePicker({ category, value, onChange }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [frequentExercises, setFrequentExercises] = useState<string[]>([]);
  const [customExercises, setCustomExercises] = useState<string[]>([]);
  const [catalogExercises, setCatalogExercises] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Load frequently used and custom exercises when category changes
  // Clear query but preserve exercise selection when category changes
  useEffect(() => {
    setQuery("");
    // Only clear exercise if no value is set or category actually changed
    if (!value) {
      onChange(null as any);
    }
    setOpen(false);
    setFrequentExercises([]);
    setCustomExercises([]);
    setCatalogExercises([]);

    if (category && user) {
      loadFrequentExercises();
      loadCustomExercises();
    }
  }, [category, user]);

  // Load exercise catalog (base + remote cache)
  useEffect(() => {
    let active = true;

    if (!category) {
      setCatalogExercises([]);
      return () => {
        active = false;
      };
    }

    // Start with local base list for instant render
    setCatalogExercises(EXERCISES[category] ?? []);

    const load = async () => {
      const cachedList = await getExercisesForCategory(category);
      if (active) setCatalogExercises(cachedList);

      const refreshed = await refreshExercisesForCategory(category);
      if (active && refreshed) setCatalogExercises(refreshed);
    };

    load();

    return () => {
      active = false;
    };
  }, [category]);

  const loadFrequentExercises = async () => {
    if (!category || !user) return;
    try {
      // Derive frequent exercises from recent workouts for this category
      const result = await workoutApi.list({ category, limit: 50 });
      const countMap = new Map<string, number>();
      for (const w of result.workouts ?? []) {
        countMap.set(w.exercise, (countMap.get(w.exercise) ?? 0) + 1);
      }
      const frequent = [...countMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);
      setFrequentExercises(frequent);
    } catch (e) {
      console.log("Error loading frequent exercises:", e);
    }
  };

  const loadCustomExercises = async () => {
    if (!category || !user) return;
    try {
      const customs = await exerciseApi.list(category);
      setCustomExercises(customs.map((c) => c.name));
    } catch (e) {
      console.log("Error loading custom exercises:", e);
    }
  };

  const handleAddCustomExercise = async () => {
    if (!category || !user || !newExerciseName.trim()) return;

    setIsAdding(true);
    try {
      const predefinedExists = exercises.some(
        (ex) => ex.toLowerCase() === newExerciseName.trim().toLowerCase(),
      );

      if (predefinedExists) {
        Alert.alert("Already Exists", "This exercise already exists in the predefined list.");
        setIsAdding(false);
        return;
      }

      const existingCustoms = await exerciseApi.list(category);
      const customExists = existingCustoms.some(
        (c) => c.name.toLowerCase() === newExerciseName.trim().toLowerCase()
      );
      if (customExists) {
        Alert.alert("Already Exists", "You've already added this custom exercise.");
        setIsAdding(false);
        return;
      }

      await exerciseApi.create({ category, name: newExerciseName.trim() });
      await loadCustomExercises();

      onChange(newExerciseName.trim());
      setNewExerciseName("");
      setShowAddModal(false);
      setOpen(false);
    } catch (e) {
      console.log("Error adding custom exercise:", e);
      Alert.alert("Error", "Failed to add custom exercise. Please try again.");
    }
    setIsAdding(false);
  };

  const exercises = category ? catalogExercises : [];

  // Combine predefined and custom exercises
  const allExercises = useMemo(() => {
    return [...exercises, ...customExercises];
  }, [exercises, customExercises]);

  // Sort exercises: frequent ones first, then custom, then alphabetically
  const sortedExercises = useMemo(() => {
    if (frequentExercises.length === 0 && customExercises.length === 0)
      return exercises;

    const frequentSet = new Set(frequentExercises);
    const customSet = new Set(customExercises);

    const frequent = allExercises.filter((ex) => frequentSet.has(ex));
    const custom = customExercises.filter((ex) => !frequentSet.has(ex));
    const others = exercises.filter((ex) => !frequentSet.has(ex));

    // Sort frequent by their usage order, others alphabetically
    frequent.sort(
      (a, b) => frequentExercises.indexOf(a) - frequentExercises.indexOf(b),
    );
    others.sort((a, b) => a.localeCompare(b));
    custom.sort((a, b) => a.localeCompare(b));

    return [...frequent, ...custom, ...others];
  }, [exercises, frequentExercises, customExercises, allExercises]);

  const filtered = useMemo(() => {
    return sortedExercises.filter((ex) =>
      ex.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query, sortedExercises]);

  // Check if an exercise is frequent
  const isFrequent = (exercise: string) => frequentExercises.includes(exercise);

  // Check if an exercise is custom
  const isCustom = (exercise: string) => customExercises.includes(exercise);

  return (
    <View>
      <Text
        style={{
          ...typography.caption,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        }}
      >
        Exercise
      </Text>
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.surfaceElevated,
          padding: spacing.md,
          borderRadius: radius.lg,
          opacity: category ? 1 : 0.5,
        }}
        disabled={!category}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text
          style={{
            ...typography.bodyMedium,
            color: value ? colors.textPrimary : colors.textMuted,
          }}
        >
          {value ?? "Select exercise"}
        </Text>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.sm,
            backgroundColor: colors.accentLight,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.accent}
          />
        </View>
      </Pressable>

      {open && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{
            marginTop: spacing.xs,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.lg,
            overflow: "hidden",
            maxHeight: 320,
          }}
        >
          {/* Search Input */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
            }}
          >
            <Ionicons
              name="search"
              size={18}
              color={colors.textMuted}
              style={{ marginRight: spacing.xs }}
            />
            <TextInput
              placeholder="Search exercise..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              style={{
                flex: 1,
                color: colors.textPrimary,
                fontSize: typography.body.fontSize,
              }}
            />
          </View>

          {/* Frequent exercises hint */}
          {frequentExercises.length > 0 && !query && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                backgroundColor: colors.accentLight,
              }}
            >
              <Ionicons name="time-outline" size={14} color={colors.accent} />
              <Text
                style={{
                  ...typography.caption,
                  color: colors.accent,
                  marginLeft: spacing.xxs,
                }}
              >
                Your frequently used exercises appear first
              </Text>
            </View>
          )}

          <ScrollView
            style={{ maxHeight: 240 }}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {filtered.map((exercise, index) => {
              const frequent = isFrequent(exercise);
              const custom = isCustom(exercise);
              const isFirstNonFrequent =
                !frequent && index > 0 && isFrequent(filtered[index - 1]);

              return (
                <View key={exercise}>
                  {/* Divider between frequent and other exercises */}
                  {isFirstNonFrequent && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: colors.divider,
                        marginVertical: spacing.xs,
                      }}
                    />
                  )}
                  <Pressable
                    style={{
                      padding: spacing.md,
                      borderBottomWidth:
                        index < filtered.length - 1 && !isFirstNonFrequent
                          ? 1
                          : 0,
                      borderBottomColor: colors.divider,
                      backgroundColor:
                        value === exercise ? colors.accentLight : "transparent",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                    onPress={() => {
                      onChange(exercise);
                      setOpen(false);
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.body,
                          color:
                            value === exercise
                              ? colors.accent
                              : colors.textPrimary,
                          fontWeight:
                            value === exercise
                              ? "600"
                              : frequent
                                ? "500"
                                : "400",
                        }}
                      >
                        {exercise}
                      </Text>
                      {custom && (
                        <View
                          style={{
                            backgroundColor: colors.accentLight,
                            paddingHorizontal: spacing.xs,
                            paddingVertical: 2,
                            borderRadius: radius.xs,
                            marginLeft: spacing.xs,
                          }}
                        >
                          <Text
                            style={{
                              ...typography.caption,
                              color: colors.accent,
                              fontSize: 10,
                            }}
                          >
                            CUSTOM
                          </Text>
                        </View>
                      )}
                    </View>
                    {frequent && !query && (
                      <Ionicons
                        name="star"
                        size={14}
                        color={colors.accent}
                        style={{ marginLeft: spacing.xs }}
                      />
                    )}
                  </Pressable>
                </View>
              );
            })}

            {filtered.length === 0 && (
              <Text
                style={{
                  padding: spacing.md,
                  ...typography.body,
                  color: colors.textMuted,
                  fontStyle: "italic",
                  textAlign: "center",
                }}
              >
                No exercises found
              </Text>
            )}

            {/* Add Custom Exercise Option */}
            <Pressable
              style={{
                padding: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.divider,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
              }}
              onPress={() => {
                setShowAddModal(true);
                setNewExerciseName(query); // Pre-fill with search query
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.accent,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: spacing.sm,
                }}
              >
                <Ionicons name="add" size={16} color={colors.background} />
              </View>
              <Text
                style={{
                  ...typography.body,
                  color: colors.accent,
                  fontWeight: "500",
                }}
              >
                Can't find it? Add custom exercise
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      )}

      {/* Add Custom Exercise Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
          }}
          onPress={() => setShowAddModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.lg,
              padding: spacing.lg,
              width: "100%",
              maxWidth: 400,
            }}
            onPress={() => {}} // Prevent close when tapping modal content
          >
            <Text
              style={{
                ...typography.h2,
                color: colors.textPrimary,
                marginBottom: spacing.sm,
              }}
            >
              Add Custom Exercise
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                marginBottom: spacing.md,
              }}
            >
              Add a custom exercise to {category}
            </Text>

            <TextInput
              placeholder="Exercise name"
              placeholderTextColor={colors.textMuted}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              autoFocus
              style={{
                backgroundColor: colors.surface,
                padding: spacing.md,
                borderRadius: radius.md,
                color: colors.textPrimary,
                fontSize: typography.body.fontSize,
                marginBottom: spacing.md,
              }}
            />

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                style={{
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                }}
                onPress={() => {
                  setShowAddModal(false);
                  setNewExerciseName("");
                }}
              >
                <Text
                  style={{
                    ...typography.bodyMedium,
                    color: colors.textSecondary,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: newExerciseName.trim()
                    ? colors.accent
                    : colors.surfaceElevated,
                  alignItems: "center",
                  opacity: isAdding ? 0.7 : 1,
                }}
                onPress={handleAddCustomExercise}
                disabled={!newExerciseName.trim() || isAdding}
              >
                <Text
                  style={{
                    ...typography.bodyMedium,
                    color: newExerciseName.trim()
                      ? colors.background
                      : colors.textMuted,
                  }}
                >
                  {isAdding ? "Adding..." : "Add"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

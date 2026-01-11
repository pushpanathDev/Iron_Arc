import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EXERCISES, ExerciseCategory } from "../../src/data/exercises";
import { useTheme } from "../../src/theme/theme";
const { colors, spacing, radius } = useTheme();

type Props = {
  category: ExerciseCategory | null;
  value: string | null;
  onChange: (exercise: string) => void;
};

export default function ExercisePicker({ category, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Reset when category changes
  useEffect(() => {
    setQuery("");
    onChange(null as any);
    setOpen(false);
  }, [category]);

  const exercises = category ? EXERCISES[category] : [];

  const filtered = useMemo(() => {
    return exercises.filter((ex) =>
      ex.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, exercises]);

  return (
    <View style={{ marginTop: spacing.md }}>
      <Pressable
        style={[styles.trigger, !category && { opacity: 0.5 }]}
        disabled={!category}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text
          style={[
            styles.triggerText,
            !value && { color: colors.textSecondary },
          ]}
        >
          {value ?? "Select exercise"}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View style={styles.dropdown}>
          <TextInput
            placeholder="Search exercise..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />

          {filtered.map((exercise) => (
            <Pressable
              key={exercise}
              style={styles.option}
              onPress={() => {
                onChange(exercise);
                setOpen(false);
              }}
            >
              <Text style={styles.optionText}>{exercise}</Text>
            </Pressable>
          ))}

          {filtered.length === 0 && (
            <Text style={styles.empty}>No exercises found</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  search: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    color: colors.textPrimary,
  },
  option: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  empty: {
    padding: spacing.md,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
});

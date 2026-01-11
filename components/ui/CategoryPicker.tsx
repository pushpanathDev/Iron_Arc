import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ExerciseCategory } from "../../src/data/exercises";
import { useTheme } from "../../src/theme/theme";

const { colors, spacing, radius } = useTheme();

type Props = {
  value: ExerciseCategory | null;
  onChange: (category: ExerciseCategory) => void;
};

const CATEGORIES: ExerciseCategory[] = [
  "Chest",
  "Shoulders",
  "Back",
  "Legs",
  "Arms",
  "Abs",
];

export default function CategoryPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text
          style={[
            styles.triggerText,
            !value && { color: colors.textSecondary },
          ]}
        >
          {value ?? "Select body part"}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View style={styles.dropdown}>
          {CATEGORIES.map((category) => (
            <Pressable
              key={category}
              style={styles.option}
              onPress={() => {
                onChange(category);
                setOpen(false);
              }}
            >
              <Text style={styles.optionText}>{category}</Text>
            </Pressable>
          ))}
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
  option: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
});

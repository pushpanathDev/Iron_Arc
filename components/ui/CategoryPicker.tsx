import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ExerciseCategory } from "../../data/exercises";
import { useTheme } from "../../theme/theme";

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
  "Cardio",
  "Full Body",
];

export default function CategoryPicker({ value, onChange }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        style={{
          ...typography.caption,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        }}
      >
        Body Part
      </Text>
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.surfaceElevated,
          padding: spacing.md,
          borderRadius: radius.lg,
        }}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text
          style={{
            ...typography.bodyMedium,
            color: value ? colors.textPrimary : colors.textMuted,
          }}
        >
          {value ?? "Select body part"}
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
          }}
        >
          {CATEGORIES.map((category, index) => (
            <Pressable
              key={category}
              style={{
                padding: spacing.md,
                borderBottomWidth: index < CATEGORIES.length - 1 ? 1 : 0,
                borderBottomColor: colors.divider,
                backgroundColor:
                  value === category ? colors.accentLight : "transparent",
              }}
              onPress={() => {
                onChange(category);
                setOpen(false);
              }}
            >
              <Text
                style={{
                  ...typography.body,
                  color:
                    value === category ? colors.accent : colors.textPrimary,
                  fontWeight: value === category ? "600" : "400",
                }}
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

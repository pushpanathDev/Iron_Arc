import { MaterialIcons } from "@expo/vector-icons";
import { memo, useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { doneSets, isExerciseDone, type DraftExercise } from "../../hooks/logSession";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

export type ExerciseStripProps = {
  exercises: DraftExercise[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onAdd: () => void;
};

/** Horizontal chips, one per exercise ("Hack Squat · 3") plus "+"; keeps the active chip in view. */
export function ExerciseStrip({ exercises, activeKey, onSelect, onAdd }: ExerciseStripProps) {
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const positions = useRef(new Map<string, { x: number; width: number }>());
  const viewport = useRef(0);

  useEffect(() => {
    if (!activeKey) return;
    // Wait a frame so a just-added chip has been laid out.
    const id = requestAnimationFrame(() => {
      const p = positions.current.get(activeKey);
      if (p) scroll.current?.scrollTo({ x: Math.max(0, p.x - (viewport.current - p.width) / 2), animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [activeKey, exercises.length]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onLayout={(e) => (viewport.current = e.nativeEvent.layout.width)}
      contentContainerStyle={{ paddingHorizontal: spacing.screen, gap: spacing.sm, paddingVertical: spacing.xs }}
      accessibilityRole="tablist"
    >
      {exercises.map((ex) => (
        <View key={ex.key} onLayout={(e) => positions.current.set(ex.key, { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}>
          <Chip exercise={ex} active={ex.key === activeKey} onPress={onSelect} />
        </View>
      ))}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add exercise"
        style={({ pressed }) => ({
          width: size.control,
          height: size.control,
          borderRadius: radius.lg,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
        })}
      >
        <MaterialIcons name="add" size={size.iconLg} color={colors.accent} />
      </Pressable>
    </ScrollView>
  );
}

const Chip = memo(function Chip({ exercise, active, onPress }: { exercise: DraftExercise; active: boolean; onPress: (key: string) => void }) {
  const { colors } = useTheme();
  const count = doneSets(exercise).length;
  const done = isExerciseDone(exercise, active);
  return (
    <Pressable
      onPress={() => onPress(exercise.key)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${exercise.name}, ${count} ${count === 1 ? "set" : "sets"} done${done ? ", finished" : ""}`}
      style={({ pressed }) => ({
        height: size.control,
        maxWidth: size.chipMax,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: active || pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
      {done && <MaterialIcons name="check-circle" size={size.iconXs} color={colors.accent} />}
      <Text style={[typography.labelLg, { color: active ? colors.accent : colors.text, flexShrink: 1 }]} numberOfLines={1}>
        {exercise.name}
      </Text>
      <Text style={[typography.labelLg, { color: active ? colors.accent : colors.textSecondary }]}>· {count}</Text>
    </Pressable>
  );
});

export default ExerciseStrip;

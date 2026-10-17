import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { displayCategory } from "../../hooks/workoutDraft";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { IconButton } from "../ui/IconButton";

export type PickerExercise = { name: string; category: string; subgroup?: string };

export type ExerciseRowProps<T extends PickerExercise> = {
  item: T;
  /** "80 kg × 8", or null without history. */
  last: string | null;
  recentPR: boolean;
  added: boolean;
  /** Already in the session (add mode): shown as added, not tappable. */
  locked?: boolean;
  /** Stable callback (receives the item), so rows only re-render when their own props change. */
  onToggle: (item: T) => void;
  /** Custom exercises: opens their menu (delete). */
  onMore?: (item: T) => void;
};

/**
 * Picker row, fixed at size.exerciseRow so the list can skip measuring.
 * Deliberately light: a plain Pressable (no per-row animation) and no SVG,
 * drawn as one hardware layer so it scrolls as a unit.
 */
function ExerciseRowImpl<T extends PickerExercise>({ item, last, recentPR, added, locked, onToggle, onMore }: ExerciseRowProps<T>) {
  const { colors } = useTheme();
  const on = added || locked;
  const group = displayCategory(item.subgroup ?? item.category);
  const sub = [group, onMore ? "Custom" : null, last ? `Last: ${last}` : null].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onToggle(item);
      }}
      disabled={locked}
      // Draw the row once and move it as one picture while scrolling, so the
      // text can't shift against its card (the "shaky text" effect on Android).
      renderToHardwareTextureAndroid
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. ${sub}${recentPR ? ". Personal record in the last 30 days" : ""}`}
      accessibilityState={{ selected: on, disabled: locked }}
      accessibilityHint={locked ? "Already in this workout" : on ? "Removes it from the selection" : "Adds it to your workout"}
      style={({ pressed }) => ({
        height: size.exerciseRow,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: spacing.lg,
        paddingRight: spacing.sm,
        gap: onMore ? spacing.xs : spacing.md,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={[typography.bodyMdMedium, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
            {item.name}
          </Text>
          {recentPR && <PRBadge />}
        </View>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {onMore && (
        <IconButton icon="more-vert" label={`Options for ${item.name}`} onPress={() => onMore(item)} />
      )}
      <View
        style={{
          width: size.control,
          height: size.control,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on ? colors.accent : colors.surfaceContainerHigh,
        }}
      >
        <MaterialIcons name={on ? "check" : "add"} size={size.iconLg} color={on ? colors.onAccent : colors.text} />
      </View>
    </Pressable>
  );
}

export const ExerciseRow = memo(ExerciseRowImpl) as typeof ExerciseRowImpl;

/** Small "PR" badge: warning on surfaceContainerHigh. */
export function PRBadge() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.inline, paddingVertical: spacing.xxs, borderRadius: radius.sm, backgroundColor: colors.surfaceContainerHigh }}>
      <Text style={[typography.labelMd, { color: colors.warning }]}>PR</Text>
    </View>
  );
}

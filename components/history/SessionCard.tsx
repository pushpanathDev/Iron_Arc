import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { displayCategory } from "../../hooks/workoutDraft";
import type { SessionGroup } from "../../hooks/useWorkoutSummary";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { displayWeightRounded, formatWeightValue } from "../../utils/exerciseHistory";
import { displayWeight, weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { Button } from "../ui/Button";
import { PRBadge } from "../workout/ExerciseRow";
import { SwipeDeleteAction } from "../ui/SwipeDeleteAction";

export type SessionCardProps = {
  group: SessionGroup;
  /** Stable key for this session (expand state). */
  sessionKey: string;
  unit: WeightUnit;
  /** The session beat an earlier lift (History's PR badge). */
  pr: boolean;
  /** Workout ids (exercises) in this session that set a PR. */
  prWorkoutIds: Set<string>;
  expanded: boolean;
  onToggle: (key: string) => void;
  /** Swiped to delete; call close() to snap the card back (e.g. Cancel). */
  onDelete: (group: SessionGroup, close: () => void) => void;
  onEdit: (workoutId: string) => void;
  onRepeat: (group: SessionGroup) => void;
};

/** "Chest & Arms" (the app's session naming); more than two groups → "Mixed session". */
export function sessionTitle(group: SessionGroup) {
  const cats = [...new Set(group.list.map((w) => w.category).filter((c) => c && c !== "Other"))].map(displayCategory);
  if (cats.length === 0) return "Workout";
  return cats.length <= 2 ? cats.join(" & ") : "Mixed session";
}

/** Heaviest weighted set in the session (ties: more reps), with its exercise; null if all bodyweight. */
export function topSet(group: SessionGroup): { exercise: string; weight: number; reps: number } | null {
  let best: { exercise: string; weight: number; reps: number } | null = null;
  for (const w of group.list)
    for (const set of w.sets)
      if (set.weight > 0 && (!best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps))) best = { exercise: w.exercise, weight: set.weight, reps: set.reps };
  return best;
}

/**
 * One logged session. Tap to expand its exercises and sets (each editable),
 * swipe left to delete the whole session.
 */
export const SessionCard = memo(function SessionCard({ group, sessionKey, unit, pr, prWorkoutIds, expanded, onToggle, onDelete, onEdit, onRepeat }: SessionCardProps) {
  const { colors } = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);
  const exercises = [...new Set(group.list.map((w) => w.exercise))];
  const sets = group.list.reduce((n, w) => n + w.sets.length, 0);
  // The session's heaviest set: something you remember ("70 kg × 15"), unlike a volume total.
  const top = topSet(group);
  const title = sessionTitle(group);
  const meta = `${exercises.length} ${exercises.length === 1 ? "exercise" : "exercises"} · ${sets} ${sets === 1 ? "set" : "sets"}`;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={size.control}
      overshootRight={false}
      onSwipeableOpen={() => onDelete(group, () => swipeRef.current?.close())}
      renderRightActions={() => <SwipeDeleteAction />}
    >
      <View style={{ borderRadius: radius.lg, backgroundColor: colors.raised, overflow: "hidden" }}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onToggle(sessionKey);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}${pr ? ", personal record" : ""}. ${exercises.join(", ")}. ${meta}${top ? `. Top set: ${top.exercise}, ${displayWeightRounded(top.weight, unit)} ${weightLabel(unit)} for ${top.reps} reps` : ""}`}
          accessibilityHint={expanded ? "Hides the sets. Swipe left to delete." : "Shows the sets. Swipe left to delete."}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
        >
          <View style={{ flex: 1, gap: spacing.xxs }} pointerEvents="none">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide, flexShrink: 1 }]} numberOfLines={1}>
                {title}
              </Text>
              {pr && <PRBadge />}
            </View>
            <Text style={[typography.bodyMd, { color: colors.textSecondary }]} numberOfLines={expanded ? undefined : 1}>
              {exercises.join(", ")}
            </Text>
            <Text style={[typography.labelSm, { color: colors.textMuted }]}>{meta}</Text>
          </View>
          <View style={{ alignItems: "flex-end", maxWidth: size.chipMax / 2 }} pointerEvents="none">
            {top ? (
              <>
                <Text style={[typography.labelSm, { color: colors.textMuted }]}>Top set</Text>
                <Text style={[typography.headlineSm, { color: colors.text }]} numberOfLines={1}>
                  {displayWeightRounded(top.weight, unit)}
                  <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
                    {" "}
                    {weightLabel(unit)} × {top.reps}
                  </Text>
                </Text>
                <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={1}>
                  {top.exercise}
                </Text>
              </>
            ) : (
              <Text style={[typography.labelMd, { color: colors.textSecondary }]}>Bodyweight</Text>
            )}
          </View>
          <MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={size.icon} color={colors.textSecondary} />
        </Pressable>

        {expanded && (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
            {group.list.map((w) => (
              <View key={w.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh }}>
                <View style={{ flex: 1, paddingVertical: spacing.sm, gap: spacing.xxs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={[typography.bodyMdMedium, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                      {w.exercise}
                    </Text>
                    {prWorkoutIds.has(w.id) && <PRBadge />}
                  </View>
                  <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
                    {[...w.sets]
                      .sort((a, b) => a.setNumber - b.setNumber)
                      .map((s) => (s.weight > 0 ? `${formatWeightValue(displayWeight(s.weight, unit))} × ${s.reps}` : `BW × ${s.reps}`))
                      .join("  ·  ")}
                  </Text>
                  {w.notes ? (
                    <Text style={[typography.labelSm, { color: colors.textMuted }]} numberOfLines={2}>
                      {w.notes}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => onEdit(w.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${w.exercise}`}
                  style={({ pressed }) => ({
                    width: size.control,
                    height: size.control,
                    borderRadius: radius.full,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed ? colors.surfaceContainerHighest : "transparent",
                  })}
                >
                  <MaterialIcons name="edit" size={size.icon} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
            <Button title="Repeat workout" icon="repeat" variant="tonal" onPress={() => onRepeat(group)} fullWidth />
          </View>
        )}
      </View>
    </ReanimatedSwipeable>
  );
});

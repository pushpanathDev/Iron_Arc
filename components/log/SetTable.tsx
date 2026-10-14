import { MaterialIcons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { DraftExercise, DraftSet } from "../../hooks/logSession";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { formatWeightValue } from "../../utils/exerciseHistory";
import { PRBadge } from "./ExerciseRow";

export type SetTableProps = {
  exercise: DraftExercise;
  /** The set shown in the active card (left out of the table). */
  activeSetId: string | null;
  /** Same set number from the most recent previous session, e.g. "80 kg × 8". */
  lastTimeAt: (index: number) => string | null;
  prSets: Set<string>;
  onEdit: (setId: string) => void;
  onDelete: (setId: string) => void;
};

/** 82.5, 15 (never "15.0"). */
const fmtWeight = (w: number | null) => (w == null ? "–" : formatWeightValue(w));

/** SET / LAST TIME / WEIGHT / REPS / LOG table of completed sets. */
export function SetTable({ exercise, activeSetId, lastTimeAt, prSets, onEdit, onDelete }: SetTableProps) {
  const done = exercise.sets.map((set, index) => ({ set, index })).filter((r) => r.set.done && r.set.id !== activeSetId);
  if (done.length === 0) return null;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Header label="Set" width={size.setColumn} />
        <Header label="Last time" flex={1.4} />
        <Header label="Weight" flex={1} center />
        <Header label="Reps" flex={0.8} center />
        <Header label="Log" width={size.control} center />
      </View>
      {done.map(({ set, index }) => (
        <DoneRow key={set.id} set={set} number={index + 1} lastTime={lastTimeAt(index)} pr={prSets.has(set.id)} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </View>
  );
}

const DoneRow = memo(function DoneRow({
  set,
  number,
  lastTime,
  pr,
  onEdit,
  onDelete,
}: {
  set: DraftSet;
  number: number;
  lastTime: string | null;
  pr: boolean;
  onEdit: (setId: string) => void;
  onDelete: (setId: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={size.control}
      overshootRight={false}
      onSwipeableOpen={() => onDelete(set.id)}
      renderRightActions={() => (
        <View
          style={{
            width: size.control + spacing.xl,
            marginLeft: spacing.xs,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.dangerSubtle,
          }}
        >
          <MaterialIcons name="delete-outline" size={size.iconLg} color={colors.danger} />
        </View>
      )}
    >
      <Pressable
        onPress={() => onEdit(set.id)}
        accessibilityRole="button"
        accessibilityLabel={`Set ${number}: ${fmtWeight(set.weight)} by ${set.reps ?? 0} reps${pr ? ", personal record" : ""}. Done.`}
        accessibilityHint="Edit or delete this set. You can also swipe left to delete."
        style={({ pressed }) => ({
          minHeight: size.control,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
        })}
      >
        <View style={{ width: size.setColumn, flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
          <Text style={[typography.headlineSm, { color: colors.text }]}>{number}</Text>
          {pr && <MaterialIcons name="star" size={size.iconXs} color={colors.warning} />}
        </View>
        <Text style={[typography.bodyMd, { flex: 1.4, color: colors.textSecondary }]} numberOfLines={1}>
          {lastTime ?? "–"}
        </Text>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs }}>
          <Text style={[typography.headlineSm, { color: pr ? colors.warning : colors.text }]}>{fmtWeight(set.weight)}</Text>
          {pr && <PRBadge />}
        </View>
        <Text style={[typography.headlineSm, { flex: 0.8, color: colors.text, textAlign: "center" }]}>{set.reps ?? "–"}</Text>
        <View style={{ width: size.control, alignItems: "center" }}>
          <View style={{ width: size.checkBox, height: size.checkBox, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent }}>
            <MaterialIcons name="check" size={size.iconSm} color={colors.onAccent} />
          </View>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});

/** Planned sets not reached yet (from a plan, or Add set). */
export function PendingSets({ exercise, activeSetId, lastTimeAt }: Pick<SetTableProps, "exercise" | "activeSetId" | "lastTimeAt">) {
  const { colors } = useTheme();
  const pending = exercise.sets.map((set, index) => ({ set, index })).filter((r) => !r.set.done && r.set.id !== activeSetId);
  if (pending.length === 0) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      {pending.map(({ set, index }) => (
        <View
          key={set.id}
          style={{ minHeight: size.control, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: size.divider, borderColor: colors.border }}
          accessibilityLabel={`Set ${index + 1}, not done yet`}
        >
          <Text style={[typography.headlineSm, { width: size.setColumn, color: colors.textSecondary }]}>{index + 1}</Text>
          <Text style={[typography.bodyMd, { flex: 1, color: colors.textSecondary }]} numberOfLines={1}>
            {lastTimeAt(index) ? `Last time: ${lastTimeAt(index)}` : "Planned"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Header({ label, width, flex, center }: { label: string; width?: number; flex?: number; center?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={[
        typography.labelSm,
        { width, flex, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide, textAlign: center ? "center" : "left" },
      ]}
    >
      {label}
    </Text>
  );
}

export default SetTable;

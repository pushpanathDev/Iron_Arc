import { MaterialIcons } from "@expo/vector-icons";
import { memo, useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { ActiveSetCard } from "./ActiveSetCard";
import { PendingSets, SetTable } from "./SetTable";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { activeSetOf, addSet, cancelEdit, deleteSet, setExerciseNotes, startEditSet, updateDraft, updateSet, type DraftExercise, type LastTimeLookup, type WorkoutDraft } from "../../hooks/workoutDraft";
import { useTheme } from "../../theme/theme";
import { size, spacing, typography } from "../../theme/tokens";
import { formatSet, lastTimeText, previousSetAt, type ExerciseHistory, type ExerciseSummary } from "../../utils/exerciseHistory";

/** Same limit as the backend's workout notes. */
const NOTES_MAX = 500;

export const ExerciseView = memo(function ExerciseView({
  draft,
  exercise: ex,
  history,
  summary,
  prSets,
  lastTime,
  onMenu,
  onComplete,
  onDelete,
}: {
  draft: WorkoutDraft;
  exercise: DraftExercise;
  history: ExerciseHistory | undefined;
  summary: ExerciseSummary | undefined;
  prSets: Set<string>;
  lastTime: LastTimeLookup;
  onMenu: () => void;
  onComplete: (setId: string) => void;
  onDelete: (setId: string) => void;
}) {
  const { colors } = useTheme();
  const unit = draft.unit;
  const lastTimeAt = useCallback((i: number) => formatSet(previousSetAt(history, i), unit), [history, unit]);
  const activeSet = activeSetOf(ex, draft.editingSetId);
  const activeIndex = activeSet ? ex.sets.findIndex((s) => s.id === activeSet.id) : -1;
  const editing = !!activeSet && draft.editingSetId === activeSet.id;
  const onEdit = useCallback((setId: string) => updateDraft((d) => startEditSet(d, ex.key, setId)), [ex.key]);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
        <View style={{ flex: 1, gap: spacing.xxs, paddingTop: spacing.xs }}>
          <Text style={[typography.headlineMd, { color: colors.text }]} numberOfLines={2} accessibilityRole="header">
            {ex.name}
          </Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{lastTimeText(summary, unit)}</Text>
        </View>
        <Pressable
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${ex.name}`}
          style={{ width: size.control, height: size.control, marginRight: -spacing.sm, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="more-vert" size={size.icon} color={colors.textSecondary} />
        </Pressable>
      </View>

      <SetTable exercise={ex} activeSetId={activeSet?.id ?? null} lastTimeAt={lastTimeAt} prSets={prSets} onEdit={onEdit} onDelete={onDelete} />

      {activeSet && (
        <ActiveSetCard
          setNumber={activeIndex + 1}
          editing={editing}
          lastTime={lastTimeAt(activeIndex)}
          unit={unit}
          values={{ weight: activeSet.weight, reps: activeSet.reps }}
          onChange={(values) => updateDraft((d) => updateSet(d, ex.key, activeSet.id, values))}
          onComplete={() => onComplete(activeSet.id)}
          onRemove={() => updateDraft((d) => deleteSet(d, ex.key, activeSet.id))}
          onDelete={() => onDelete(activeSet.id)}
          onCancelEdit={() => updateDraft(cancelEdit)}
          exercise={ex.name}
        />
      )}

      <PendingSets exercise={ex} activeSetId={activeSet?.id ?? null} lastTimeAt={lastTimeAt} />
      <Button title="Add set" icon="add" variant="ghost" onPress={() => updateDraft((d) => addSet(d, ex.key, lastTime))} fullWidth />
      <ExerciseNote exKey={ex.key} notes={ex.notes ?? ""} />
    </View>
  );
});

/** Optional note for this exercise ("felt heavy", "new grip"), saved with it. */
function ExerciseNote({ exKey, notes }: { exKey: string; notes: string }) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <TextField
        label="Note (optional)"
        value={notes}
        onChangeText={(t) => updateDraft((d) => setExerciseNotes(d, exKey, t))}
        placeholder="How did it feel? Anything to remember?"
        multiline
        maxLength={NOTES_MAX}
      />
    </View>
  );
}

import { useState } from "react";
import { View } from "react-native";
import { doneSets, moveExercise, updateDraft, type DraftExercise, type WorkoutDraft } from "../../hooks/workoutDraft";
import { spacing } from "../../theme/tokens";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/**
 * The ⋮ menu for an exercise in the session: move it left or right, or
 * remove it (asking first when it has completed sets).
 */
export function ExerciseMenu({
  draft,
  exercise,
  onClose,
  onRemove,
}: {
  draft: WorkoutDraft;
  exercise: DraftExercise | null;
  onClose: () => void;
  onRemove: (ex: DraftExercise) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState<DraftExercise | null>(null);
  const first = draft.exercises[0]?.key;
  const last = draft.exercises[draft.exercises.length - 1]?.key;
  const move = (ex: DraftExercise, direction: -1 | 1) => {
    updateDraft((d) => moveExercise(d, ex.key, direction));
    onClose();
  };
  const done = confirmRemove ? doneSets(confirmRemove).length : 0;

  return (
    <>
      <Sheet visible={!!exercise} onClose={onClose} title={exercise?.name ?? ""}>
        {exercise && (
          <View style={{ gap: spacing.sm }}>
            <Button title="Move left" icon="arrow-back" variant="secondary" fullWidth disabled={first === exercise.key} onPress={() => move(exercise, -1)} />
            <Button title="Move right" icon="arrow-forward" variant="secondary" fullWidth disabled={last === exercise.key} onPress={() => move(exercise, 1)} />
            <Button
              title="Remove exercise"
              icon="trash-outline"
              variant="destructive"
              fullWidth
              onPress={() => {
                onClose();
                if (doneSets(exercise).length > 0) setConfirmRemove(exercise);
                else onRemove(exercise);
              }}
            />
          </View>
        )}
      </Sheet>

      <Sheet
        visible={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.name ?? "exercise"}?`}
        subtitle={confirmRemove ? `Its ${done} completed ${done === 1 ? "set" : "sets"} will be removed from this workout.` : undefined}
      >
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Remove exercise"
            variant="destructive"
            fullWidth
            onPress={() => {
              const ex = confirmRemove;
              setConfirmRemove(null);
              if (ex) onRemove(ex);
            }}
          />
          <Button title="Cancel" variant="ghost" onPress={() => setConfirmRemove(null)} fullWidth />
        </View>
      </Sheet>
    </>
  );
}

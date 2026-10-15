import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers/AuthContext";
import { useToast } from "../providers/ToastContext";
import { workoutApi, type Workout } from "../services/api";
import { ACHIEVEMENTS_KEY, useAchievementUnlockHandler } from "./useAchievements";
import {
  hidePendingDeletes,
  workoutKeys,
} from "./workoutCache";

export {
  beginWorkoutDelete,
  cancelWorkoutDelete,
  finishWorkoutDelete,
  workoutKeys,
} from "./workoutCache";

export function useAllWorkouts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: workoutKeys.list(),
    queryFn: () => workoutApi.listAll(),
    enabled: !!user,
    select: hidePendingDeletes,
  });
}

export function useWorkout(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: workoutKeys.detail(id),
    queryFn: () => workoutApi.getById(id),
    enabled: !!id && !!user,
  });
}

type WorkoutEdit = Parameters<typeof workoutApi.update>[1];

/** The workout with an edit applied, for the optimistic cache (sets get placeholder ids until the server replies). */
function applyWorkoutEdit(w: Workout, data: WorkoutEdit): Workout {
  const { sets, ...rest } = data;
  return {
    ...w,
    ...rest,
    sets: sets
      ? sets.map((set, i) => ({ id: `${w.id}-pending-${i}`, workoutId: w.id, setNumber: i + 1, reps: set.reps, weight: set.weight ?? 0 }))
      : w.sets,
    updatedAt: new Date().toISOString(),
  };
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkoutEdit }) =>
      workoutApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: workoutKeys.all });

      const previousAll = queryClient.getQueryData<Workout[]>(workoutKeys.list());
      const previousOne = queryClient.getQueryData<Workout>(workoutKeys.detail(id));

      if (previousAll) {
        queryClient.setQueryData<Workout[]>(
          workoutKeys.list(),
          previousAll.map((w) => (w.id === id ? applyWorkoutEdit(w, data) : w)),
        );
      }

      if (previousOne) {
        queryClient.setQueryData<Workout>(workoutKeys.detail(id), applyWorkoutEdit(previousOne, data));
      }

      return { previousAll, previousOne };
    },
    onError: (_err, variables, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(workoutKeys.list(), context.previousAll);
      }
      if (context?.previousOne) {
        queryClient.setQueryData(workoutKeys.detail(variables.id), context.previousOne);
      }
      showToast({ message: "Failed to update workout. Changes reverted.", type: "error" });
      queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
    },
    onSuccess: (result) => {
      void handleUnlocks(result.newlyUnlocked);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}


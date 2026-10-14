import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import { workoutApi, type Workout } from "../services/api";
import { ACHIEVEMENTS_KEY, useAchievementUnlockHandler } from "./useAchievements";
import {
  beginWorkoutDelete,
  cancelWorkoutDelete,
  finishWorkoutDelete,
  hidePendingDeletes,
  logWorkoutListResponse,
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
    queryFn: async () => {
      const rows = await workoutApi.listAll();
      logWorkoutListResponse(rows);
      return rows;
    },
    enabled: !!user,
    select: hidePendingDeletes,
  });
}

/**
 * Server-side aggregates (streaks, PRs, volume, coverage) over the full
 * history. Keyed under ["workouts"], so every workout mutation's
 * invalidation refreshes it.
 */
export function useWorkoutStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: workoutKeys.stats(),
    queryFn: () => workoutApi.stats(),
    enabled: !!user,
  });
}

export function useWorkouts(params?: {
  page?: number;
  limit?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: workoutKeys.page(params),
    queryFn: () => workoutApi.list(params),
    enabled: !!user,
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

export function useCreateWorkout() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();

  return useMutation({
    mutationFn: workoutApi.create,
    onMutate: async (newWorkout) => {
      await queryClient.cancelQueries({ queryKey: workoutKeys.all });

      const previousAll = queryClient.getQueryData<Workout[]>(workoutKeys.list());

      const optimistic: Workout = {
        id: `temp-${Date.now()}`,
        userId: "",
        date: newWorkout.date,
        exercise: newWorkout.exercise,
        category: newWorkout.category,
        notes: newWorkout.notes ?? null,
        sets: newWorkout.sets.map((s, i) => ({
          id: `temp-set-${i}`,
          workoutId: `temp-${Date.now()}`,
          setNumber: i + 1,
          reps: s.reps,
          weight: s.weight ?? 0,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (previousAll) {
        queryClient.setQueryData<Workout[]>(workoutKeys.list(), [optimistic, ...previousAll]);
      }

      return { previousAll };
    },
    onError: (_err, _newWorkout, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(workoutKeys.list(), context.previousAll);
      }
      showToast({ message: "Failed to save workout. Please try again.", type: "error" });
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

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof workoutApi.update>[1] }) =>
      workoutApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: workoutKeys.all });

      const previousAll = queryClient.getQueryData<Workout[]>(workoutKeys.list());
      const previousOne = queryClient.getQueryData<Workout>(workoutKeys.detail(id));

      if (previousAll) {
        queryClient.setQueryData<Workout[]>(
          workoutKeys.list(),
          previousAll.map((w) => (w.id === id ? { ...w, ...data, updatedAt: new Date().toISOString() } : w)),
        );
      }

      if (previousOne) {
        queryClient.setQueryData<Workout>(workoutKeys.detail(id), {
          ...previousOne,
          ...data,
          updatedAt: new Date().toISOString(),
        });
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

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();

  return useMutation({
    mutationFn: workoutApi.delete,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: workoutKeys.all });
      beginWorkoutDelete(queryClient, deletedId);
    },
    onError: (_err, deletedId) => {
      cancelWorkoutDelete(queryClient, deletedId);
      showToast({ message: "Failed to delete workout. Please try again.", type: "error" });
      queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
    },
    onSuccess: (result, deletedId) => {
      finishWorkoutDelete(queryClient, deletedId);
      void handleUnlocks(result.newlyUnlocked);
    },
  });
}

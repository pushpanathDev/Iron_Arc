import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workoutApi, Workout, PaginatedResponse } from "../services/api";
import { useToast } from "../context/ToastContext";

export function useAllWorkouts() {
  return useQuery({
    queryKey: ["workouts", "all"],
    queryFn: () => workoutApi.listAll(),
  });
}

export function useWorkouts(params?: {
  page?: number;
  limit?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ["workouts", params],
    queryFn: () => workoutApi.list(params),
  });
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: ["workout", id],
    queryFn: () => workoutApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: workoutApi.create,
    onMutate: async (newWorkout) => {
      await queryClient.cancelQueries({ queryKey: ["workouts"] });

      const previousAll = queryClient.getQueryData<Workout[]>(["workouts", "all"]);

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
        queryClient.setQueryData<Workout[]>(
          ["workouts", "all"],
          [optimistic, ...previousAll],
        );
      }

      return { previousAll };
    },
    onError: (_err, _newWorkout, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(["workouts", "all"], context.previousAll);
      }
      showToast({ message: "Failed to save workout. Please try again.", type: "error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof workoutApi.update>[1] }) =>
      workoutApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["workouts"] });
      await queryClient.cancelQueries({ queryKey: ["workout", id] });

      const previousAll = queryClient.getQueryData<Workout[]>(["workouts", "all"]);
      const previousOne = queryClient.getQueryData<Workout>(["workout", id]);

      if (previousAll) {
        queryClient.setQueryData<Workout[]>(
          ["workouts", "all"],
          previousAll.map((w) =>
            w.id === id ? { ...w, ...data, updatedAt: new Date().toISOString() } : w,
          ),
        );
      }

      if (previousOne) {
        queryClient.setQueryData<Workout>(["workout", id], {
          ...previousOne,
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousAll, previousOne };
    },
    onError: (_err, variables, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(["workouts", "all"], context.previousAll);
      }
      if (context?.previousOne) {
        queryClient.setQueryData(["workout", variables.id], context.previousOne);
      }
      showToast({ message: "Failed to update workout. Changes reverted.", type: "error" });
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout", variables.id] });
    },
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: workoutApi.delete,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["workouts"] });

      const previousAll = queryClient.getQueryData<Workout[]>(["workouts", "all"]);

      if (previousAll) {
        queryClient.setQueryData<Workout[]>(
          ["workouts", "all"],
          previousAll.filter((w) => w.id !== deletedId),
        );
      }

      return { previousAll };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(["workouts", "all"], context.previousAll);
      }
      showToast({ message: "Failed to delete workout. Please try again.", type: "error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

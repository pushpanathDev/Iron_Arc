import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { weightApi, BodyWeight } from "../services/api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../auth/AuthContext";
import { ACHIEVEMENTS_KEY, useAchievementUnlockHandler } from "./useAchievements";

export function useAllWeights() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["weights", "all"],
    queryFn: () => weightApi.listAll(),
    enabled: !!user,
  });
}

/**
 * Server-side body-weight aggregates. Keyed under ["weights"], so every
 * weight mutation's invalidation refreshes it.
 */
export function useWeightStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["weights", "stats"],
    queryFn: () => weightApi.stats(),
    enabled: !!user,
  });
}

export function useWeights(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["weights", params],
    queryFn: () => weightApi.list(params),
    enabled: !!user,
  });
}

export function useLatestWeight() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["weights", "latest"],
    queryFn: () => weightApi.getLatest(),
    enabled: !!user,
    retry: false,
  });
}

export function useLogWeight() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();

  return useMutation({
    mutationFn: weightApi.log,
    onMutate: async (newWeight) => {
      await queryClient.cancelQueries({ queryKey: ["weights"] });

      const previousAll = queryClient.getQueryData<BodyWeight[]>(["weights", "all"]);
      const previousLatest = queryClient.getQueryData<BodyWeight>(["weights", "latest"]);

      const optimistic: BodyWeight = {
        id: `temp-${Date.now()}`,
        userId: "",
        date: newWeight.date,
        weekStart: newWeight.weekStart ?? null,
        weight: newWeight.weight,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // The server upserts one entry per (user, date): replace that day's row
      // instead of adding a second one.
      if (previousAll) {
        const existing = previousAll.find((w) => w.date === newWeight.date);
        queryClient.setQueryData<BodyWeight[]>(
          ["weights", "all"],
          existing
            ? previousAll.map((w) =>
                w.id === existing.id ? { ...existing, ...optimistic, id: existing.id } : w,
              )
            : [optimistic, ...previousAll],
        );
      }

      // Only a same-or-newer date becomes the latest entry.
      if (!previousLatest || newWeight.date >= previousLatest.date) {
        queryClient.setQueryData<BodyWeight>(["weights", "latest"], optimistic);
      }

      return { previousAll, previousLatest };
    },
    onError: (_err, _newWeight, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(["weights", "all"], context.previousAll);
      }
      if (context?.previousLatest !== undefined) {
        queryClient.setQueryData(["weights", "latest"], context.previousLatest);
      }
      showToast({ message: "Failed to log weight. Please try again.", type: "error" });
      queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
    },
    onSuccess: (result) => {
      void handleUnlocks(result.newlyUnlocked);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["weights"] });
    },
  });
}

export function useDeleteWeight() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();

  return useMutation({
    mutationFn: weightApi.delete,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["weights"] });

      const previousAll = queryClient.getQueryData<BodyWeight[]>(["weights", "all"]);

      if (previousAll) {
        queryClient.setQueryData<BodyWeight[]>(
          ["weights", "all"],
          previousAll.filter((w) => w.id !== deletedId),
        );
      }

      return { previousAll };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(["weights", "all"], context.previousAll);
      }
      showToast({ message: "Failed to delete weight entry. Please try again.", type: "error" });
      queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
    },
    onSuccess: (result) => {
      void handleUnlocks(result.newlyUnlocked);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["weights"] });
    },
  });
}

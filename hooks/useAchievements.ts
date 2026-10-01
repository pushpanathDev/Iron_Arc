import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { achievementApi } from "../services/api";

export function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: () => achievementApi.list(),
  });
}

export function useUnlockAchievement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: achievementApi.unlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
    },
  });
}

export function useSyncAchievements() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: achievementApi.sync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { exerciseApi } from "../services/api";

export function useCustomExercises(category?: string) {
  return useQuery({
    queryKey: ["exercises", category],
    queryFn: () => exerciseApi.list(category),
    // Changes only through useCreateExercise/useDeleteExercise, which invalidate it.
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: exerciseApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: exerciseApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

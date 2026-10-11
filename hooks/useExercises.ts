import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { exerciseApi } from "../services/api";

export function useCustomExercises(category?: string) {
  return useQuery({
    queryKey: ["exercises", category],
    queryFn: () => exerciseApi.list(category),
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

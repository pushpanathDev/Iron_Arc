import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { isArmSubgroup, type ArmSubgroup } from "../data/armSubgroups";
import { exerciseApi } from "../services/api";
import type { CustomArms } from "../utils/analytics";

export function useCustomExercises(category?: string) {
  return useQuery({
    queryKey: ["exercises", category],
    queryFn: () => exerciseApi.list(category),
    // Changes only through useCreateExercise/useDeleteExercise, which invalidate it.
    staleTime: 5 * 60 * 1000,
  });
}

/** Your own arm exercises by lower-case name, with the tile they're saved under (Biceps, Triceps, Forearms). */
export function useCustomArms(): CustomArms {
  const customs = useCustomExercises().data;
  return useMemo(() => new Map((customs ?? []).filter((c) => isArmSubgroup(c.category)).map((c) => [c.name.trim().toLowerCase(), c.category as ArmSubgroup])), [customs]);
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

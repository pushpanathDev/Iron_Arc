import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { weightApi, BodyWeight } from "../services/api";
import { useToast } from "../context/ToastContext";

export function useAllWeights() {
  return useQuery({
    queryKey: ["weights", "all"],
    queryFn: () => weightApi.listAll(),
  });
}

export function useWeights(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ["weights", params],
    queryFn: () => weightApi.list(params),
  });
}

export function useLatestWeight() {
  return useQuery({
    queryKey: ["weights", "latest"],
    queryFn: () => weightApi.getLatest(),
    retry: false,
  });
}

export function useLogWeight() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

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

      if (previousAll) {
        queryClient.setQueryData<BodyWeight[]>(
          ["weights", "all"],
          [optimistic, ...previousAll],
        );
      }

      queryClient.setQueryData<BodyWeight>(["weights", "latest"], optimistic);

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
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["weights"] });
    },
  });
}

export function useDeleteWeight() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

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
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["weights"] });
    },
  });
}

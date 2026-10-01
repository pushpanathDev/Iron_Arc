import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plansApi, PlanCriteriaPayload, ChatMessage } from "../services/api";

const PLANS_KEY = ["plans"] as const;

/* ── List all plans ──────────────────────────────────────────────────── */
export function usePlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: plansApi.list,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

/* ── Get one plan ────────────────────────────────────────────────────── */
export function usePlan(planId: string | undefined) {
  return useQuery({
    queryKey: ["plans", planId],
    queryFn: () => plansApi.get(planId!),
    enabled: Boolean(planId),
  });
}

/* ── Generate new plan ───────────────────────────────────────────────── */
export function useGeneratePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (criteria?: PlanCriteriaPayload) => plansApi.generate(criteria),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/* ── Recalibrate a specific plan ─────────────────────────────────────── */
export function useRecalibratePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => plansApi.recalibrate(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/* ── Substitute an exercise in a specific plan ───────────────────────── */
export function useSubstituteExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      exerciseId,
      reason,
    }: {
      planId: string;
      exerciseId: string;
      reason?: string;
    }) => plansApi.substitute(planId, exerciseId, reason),
    onSuccess: (updatedPlan, vars) => {
      // Update the cached plan with the server's fresh planData
      queryClient.setQueryData(["plans", vars.planId], updatedPlan);
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    },
  });
}

/* ── Rename a plan ───────────────────────────────────────────────────── */
export function useRenamePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, name }: { planId: string; name: string }) =>
      plansApi.rename(planId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    },
  });
}

/* ── Set a plan as active ────────────────────────────────────────────── */
export function useActivatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => plansApi.activate(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/* ── Delete a plan ───────────────────────────────────────────────────── */
export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => plansApi.delete(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/* ── Chat with a plan ────────────────────────────────────────────────── */
export function usePlanChat(planId: string | undefined) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (message: string) => plansApi.chat(planId!, message),
    onSuccess: (response) => {
      // Update the plan cache with the new planData and chatHistory
      queryClient.setQueryData(["plans", planId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          planData: response.planData,
          chatHistory: response.chatHistory,
        };
      });
      if (response.planUpdated) {
        queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      }
    },
  });

  return mutation;
}

/* ── Get chat history for a plan (from cached plan data) ─────────────── */
export function usePlanChatHistory(planId: string | undefined): ChatMessage[] {
  const queryClient = useQueryClient();
  const cached = queryClient.getQueryData<any>(["plans", planId]);
  // chatHistory can come from a top-level field (future schema) or _chatHistory inside planData
  return cached?.chatHistory ?? (cached?.planData as any)?._chatHistory ?? [];
}

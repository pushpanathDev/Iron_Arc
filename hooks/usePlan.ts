import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plansApi, type PlanCriteriaPayload } from "../services/api";
import { ACHIEVEMENTS_KEY, useAchievementUnlockHandler } from "./useAchievements";

const PLANS_KEY = ["plans"] as const;

export function usePlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: plansApi.list,
    // Cheap call, and plans change from several screens (and from a generate that
    // timed out on the phone but finished on the server): always re-check on open.
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function usePlan(planId: string | undefined) {
  return useQuery({
    queryKey: ["plans", planId],
    queryFn: () => plansApi.get(planId!),
    enabled: Boolean(planId),
  });
}

export function useGeneratePlan() {
  const queryClient = useQueryClient();
  const handleUnlocks = useAchievementUnlockHandler();

  return useMutation({
    mutationFn: (criteria?: PlanCriteriaPayload) => plansApi.generate(criteria),
    retry: 0, // AI calls are expensive and rate-limited; never repeat automatically
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      void handleUnlocks(result.newlyUnlocked);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    },
  });
}

export function useRecalibratePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => plansApi.recalibrate(planId),
    retry: 0, // AI call — never repeat automatically
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY }),
    onSuccess: (updatedPlan, planId) => {
      queryClient.setQueryData(["plans", planId], updatedPlan);
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

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
    retry: 0, // AI call — never repeat automatically
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY }),
    onSuccess: (updatedPlan, vars) => {
      // Update the cached plan with the server's fresh planData
      queryClient.setQueryData(["plans", vars.planId], updatedPlan);
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    },
  });
}

export function useRenamePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, name }: { planId: string; name: string }) =>
      plansApi.rename(planId, name),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    },
  });
}

export function useActivatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => plansApi.activate(planId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => plansApi.delete(planId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function usePlanChat(planId: string | undefined) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      const started = Date.now();
      if (__DEV__) console.log(`[Coach] → sending to plan ${planId} (${message.length} chars): "${message.slice(0, 60)}"`);
      try {
        const response = await plansApi.chat(planId!, message);
        if (__DEV__) {
          const hist = Array.isArray(response?.chatHistory) ? response.chatHistory.length : "none";
          console.log(`[Coach] ← reply in ${Date.now() - started} ms · planUpdated=${response?.planUpdated} · reply ${response?.message?.length ?? 0} chars · history ${hist}`);
        }
        return response;
      } catch (e) {
        if (__DEV__) {
          const err = e as { name?: string; status?: number; kind?: string; message?: string };
          console.log(`[Coach] ✗ failed after ${Date.now() - started} ms · ${err?.name} · status=${err?.status ?? "-"} · kind=${err?.kind ?? "-"} · "${err?.message}"`);
        }
        throw e;
      }
    },
    retry: 0, // AI call — a retry would append the message to the chat twice
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY }),
    onSuccess: (response) => {
      // Keep the cached plan in step. Never let a cache problem turn an answered
      // message into "not sent" (an error thrown here would fail the mutation).
      try {
        queryClient.setQueryData(["plans", planId], (old: any) => {
          if (!old) return old;
          // The new planData carries the updated chat too (_chatHistory).
          return { ...old, planData: response.planData ?? old.planData };
        });
        if (response.planUpdated) {
          queryClient.invalidateQueries({ queryKey: PLANS_KEY });
        }
      } catch (e) {
        console.warn("[Coach] reply received but updating the cached plan failed:", e);
      }
    },
  });

  return mutation;
}


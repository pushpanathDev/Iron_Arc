import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useToast } from "../providers/ToastContext";
import { ApiError, isNetworkApiError, weightApi, type BodyWeight } from "../services/api";
import { ACHIEVEMENTS_KEY, useAchievementUnlockHandler } from "./useAchievements";

const UNDO_WINDOW_MS = 5000;

/**
 * Delete a weigh-in with a 5-second undo. During the window the entry is only
 * hidden (still in the cache), so a refetch can't bring it back; the delete is
 * sent when the window closes, or at once if the app goes to the background.
 * `describe` names the entry in the undo toast ("Yesterday entry deleted").
 */
export function useWeightDelete(describe: (item: BodyWeight) => { title: string; subtitle: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; item: BodyWeight }>());

  const setPending = (id: string, pending: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });

  const commit = useCallback(
    async (item: BodyWeight) => {
      const entry = timers.current.get(item.id);
      if (entry) clearTimeout(entry.timer);
      timers.current.delete(item.id);
      let newlyUnlocked: string[] = [];
      try {
        ({ newlyUnlocked } = await weightApi.delete(item.id));
      } catch (e) {
        // 404: already gone on the server, so it counts as deleted.
        if (!(e instanceof ApiError && e.status === 404)) {
          setPending(item.id, false);
          showToast({
            type: "error",
            message: "Couldn't delete weight entry",
            subtitle: isNetworkApiError(e) ? "Can't reach the server. It's back in your list." : "It's back in your list.",
          });
          return;
        }
      }
      queryClient.setQueryData<BodyWeight[]>(["weights", "all"], (old) => (old ? old.filter((w) => w.id !== item.id) : old));
      setPending(item.id, false);
      void queryClient.invalidateQueries({ queryKey: ["weights"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void handleUnlocks(newlyUnlocked);
    },
    [queryClient, showToast, handleUnlocks],
  );

  const remove = useCallback(
    async (item: BodyWeight) => {
      if (timers.current.has(item.id)) return;
      await queryClient.cancelQueries({ queryKey: ["weights"] });
      setPending(item.id, true);
      timers.current.set(item.id, { item, timer: setTimeout(() => void commit(item), UNDO_WINDOW_MS) });
      const { title, subtitle } = describe(item);
      showToast({
        type: "undo",
        message: title,
        subtitle,
        actionLabel: "Undo",
        duration: UNDO_WINDOW_MS,
        onAction: () => {
          const entry = timers.current.get(item.id);
          if (!entry) return;
          clearTimeout(entry.timer);
          timers.current.delete(item.id);
          setPending(item.id, false);
        },
      });
    },
    [queryClient, commit, showToast, describe],
  );

  // Backgrounded or leaving: send pending deletes now rather than dropping them.
  // (Through a ref, so this runs on unmount only, not whenever callbacks change.)
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    const pending = timers.current;
    const flush = () => pending.forEach(({ item }) => void commitRef.current(item));
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") flush();
    });
    return () => {
      sub.remove();
      flush();
      void queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
    };
  }, [queryClient]);

  return { pendingIds, remove };
}

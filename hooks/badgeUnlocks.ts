import { useCallback, useSyncExternalStore } from "react";
import type { Achievement } from "../services/api";

/*
 * Newly unlocked badges waiting to be celebrated, one sheet at a time
 * (BadgeUnlockHost shows them over whatever screen is open).
 */
let queue: Achievement[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function enqueueUnlocks(badges: Achievement[]) {
  const fresh = badges.filter((b) => !queue.some((q) => q.key === b.key));
  if (!fresh.length) return;
  queue = [...queue, ...fresh];
  emit();
}

export function useUnlockQueue() {
  const current = useSyncExternalStore(subscribe, () => queue);
  const dismiss = useCallback(() => {
    queue = queue.slice(1);
    emit();
  }, []);
  return { current: current[0] ?? null, waiting: Math.max(0, current.length - 1), dismiss };
}

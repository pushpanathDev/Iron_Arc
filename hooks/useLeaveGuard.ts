import type { NavigationAction } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { cancelRestEndNotification } from "../notifications/notificationService";
import { clearDraft, clearRest, getDraft, hasDoneSets, updateDraft, writeNow } from "./workoutDraft";

/**
 * Leaving a session that has completed sets asks first ("Leave workout?");
 * a session with nothing done is simply dropped. Set `allowLeave.current`
 * before navigating away on purpose (after saving).
 */
export function useLeaveGuard(userId: string | undefined) {
  const navigation = useNavigation();
  const allowLeave = useRef(false);
  const [pendingLeave, setPendingLeave] = useState<NavigationAction | null>(null);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (allowLeave.current) return;
        const d = getDraft();
        if (!d) return;
        if (!hasDoneSets(d)) {
          void cancelRestEndNotification();
          void clearDraft(d.userId);
          return;
        }
        e.preventDefault();
        setPendingLeave(e.data.action);
      }),
    [navigation],
  );

  /** Leave after the prompt: keep the session for later, or discard it. */
  const leave = async (keep: boolean) => {
    const action = pendingLeave;
    setPendingLeave(null);
    allowLeave.current = true;
    void cancelRestEndNotification();
    updateDraft(clearRest);
    if (keep) await writeNow();
    else await clearDraft(userId);
    if (action) navigation.dispatch(action);
  };

  return { pendingLeave, leave, stay: () => setPendingLeave(null), allowLeave };
}

import { useFocusEffect } from "expo-router";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../providers/AuthContext";
import { clearEmailVerificationStart, getEmailVerificationStart, setEmailVerificationStart } from "../services/verificationStore";
import { DAY_MS } from "../utils/dates";

const GRACE_DAYS = 7;

/**
 * Unverified email accounts get a 7-day grace period, counted from the first
 * time we see them unverified. When it runs out, the verification prompt
 * opens and can't be skipped. Rechecked whenever the screen is focused.
 */
export function useEmailVerificationGrace(user: User | null) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const { onEmailVerified } = useAuth();

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      await user.reload();
    } catch {}
    if (user.emailVerified) {
      setDaysLeft(null);
      await clearEmailVerificationStart(user.uid);
      return;
    }
    let start = await getEmailVerificationStart(user.uid);
    if (!start) {
      start = Date.now();
      await setEmailVerificationStart(user.uid, start);
    }
    const elapsedDays = Math.floor((Date.now() - start) / DAY_MS);
    setDaysLeft(Math.max(0, GRACE_DAYS - elapsedDays));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    if (user && !user.emailVerified && daysLeft === 0) setPromptOpen(true);
  }, [user, daysLeft]);

  const onVerified = async () => {
    setPromptOpen(false);
    if (user) await clearEmailVerificationStart(user.uid);
    await reload();
    // Loads the account; an unfinished profile goes on to onboarding.
    await onEmailVerified();
  };

  return {
    /** Days left to verify; null when verified (or not known yet). */
    daysLeft,
    promptOpen,
    openPrompt: () => setPromptOpen(true),
    closePrompt: () => setPromptOpen(false),
    onVerified,
    reload,
  };
}

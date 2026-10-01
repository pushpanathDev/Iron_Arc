import { User, sendEmailVerification } from "firebase/auth";
import * as SecureStore from "expo-secure-store";

const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

function verificationSentKey(userId: string) {
  return `evs_sent_${userId}`;
}

export type VerificationMeta = {
  isEmailVerified?: boolean;
  verificationSentAt?: number | null;
};

export async function canResendVerificationEmail(userId: string) {
  const raw = await SecureStore.getItemAsync(verificationSentKey(userId));
  if (!raw) return { allowed: true, waitSeconds: 0 };
  const elapsed = Date.now() - Number(raw);
  if (elapsed < RESEND_COOLDOWN_MS) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
    };
  }
  return { allowed: true, waitSeconds: 0 };
}

export async function recordVerificationSent(userId: string) {
  await SecureStore.setItemAsync(verificationSentKey(userId), String(Date.now()));
}

export async function updateVerificationMeta(
  userId: string,
  meta: VerificationMeta,
) {
  if (meta.verificationSentAt) {
    await SecureStore.setItemAsync(
      verificationSentKey(userId),
      String(meta.verificationSentAt),
    );
  } else if (meta.verificationSentAt === null) {
    await SecureStore.deleteItemAsync(verificationSentKey(userId));
  }
}

export async function sendVerificationEmail(user: User) {
  await sendEmailVerification(user);
  await recordVerificationSent(user.uid);
}

export async function syncVerificationStatus(user: User) {
  try {
    await user.reload();
  } catch {
    // Non-blocking: keep last known state
  }

  if (!user.emailVerified) return false;

  try {
    await user.getIdToken(true);
  } catch {
    // Best-effort refresh so backend sees the updated emailVerified claim
  }

  // Clear the resend timestamp once verified
  try {
    await SecureStore.deleteItemAsync(verificationSentKey(user.uid));
  } catch {
    // Non-critical
  }

  return true;
}

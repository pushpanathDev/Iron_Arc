import { User, sendEmailVerification } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, firestoreDb } from "../firebase/config";

const PROFILE_DOC = (userId: string) =>
  doc(firestoreDb, "users", userId, "profile", "data");

export type VerificationMeta = {
  isEmailVerified?: boolean;
  verificationSentAt?: number | null;
};

const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

export async function getVerificationMeta(
  userId: string,
): Promise<VerificationMeta | null> {
  try {
    const snap = await getDoc(PROFILE_DOC(userId));
    if (!snap.exists()) return null;
    const data = snap.data() as VerificationMeta;
    return data;
  } catch (error) {
    console.warn("Failed to read verification meta:", error);
    return null;
  }
}

export async function updateVerificationMeta(
  userId: string,
  meta: VerificationMeta,
) {
  try {
    const ref = PROFILE_DOC(userId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        ...meta,
        updatedAt: Date.now(),
      });
    } else {
      await setDoc(ref, {
        ...meta,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  } catch (error) {
    console.warn("Failed to update verification meta:", error);
  }
}

export async function canResendVerificationEmail(userId: string) {
  const meta = await getVerificationMeta(userId);
  if (!meta?.verificationSentAt) {
    return { allowed: true, waitSeconds: 0 };
  }
  const elapsed = Date.now() - meta.verificationSentAt;
  if (elapsed < RESEND_COOLDOWN_MS) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
    };
  }
  return { allowed: true, waitSeconds: 0 };
}

export async function recordVerificationSent(userId: string) {
  await updateVerificationMeta(userId, {
    isEmailVerified: false,
    verificationSentAt: Date.now(),
  });
}

export async function sendVerificationEmail(user: User) {
  await sendEmailVerification(user);
  await recordVerificationSent(user.uid);
}

export async function syncVerificationStatus(user: User) {
  try {
    await user.reload();
  } catch (error) {
    // Non-blocking: keep last known state
  }

  if (!user.emailVerified) return false;

  await updateVerificationMeta(user.uid, {
    isEmailVerified: true,
    verificationSentAt: null,
  });

  return true;
}

export function getCurrentUser() {
  return auth.currentUser;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { User, sendEmailVerification } from "firebase/auth";
import { auth } from "../firebase/config";

/*
 * One resend cooldown per email address, stored in AsyncStorage so it
 * survives remounts and app restarts. Every send (sign-up included) is
 * recorded. Wait before the next send: 60s, then 120s, then 300s.
 */

const BACKOFF_SECONDS = [60, 120, 300];

type SendRecord = { lastSentAt: number; count: number };

const sendKey = (email: string) => `@verification_send_${email.trim().toLowerCase()}`;

/** Thrown when there is no signed-in user to send to. */
export class NoSignedInUserError extends Error {
  code = "app/no-current-user";
  constructor() {
    super("No signed-in user to send a verification email to.");
  }
}

export function logVerificationError(step: string, error: unknown) {
  if (__DEV__) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[Verification] ${step} failed: ${code}`, error);
  }
}

async function readRecord(email: string): Promise<SendRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(sendKey(email));
    return raw ? (JSON.parse(raw) as SendRecord) : null;
  } catch {
    return null;
  }
}

async function writeRecord(email: string, record: SendRecord) {
  await AsyncStorage.setItem(sendKey(email), JSON.stringify(record)).catch(() => {});
}

function waitAfter(count: number) {
  return BACKOFF_SECONDS[Math.min(Math.max(count, 1), BACKOFF_SECONDS.length) - 1];
}

/** Epoch ms when the next send is allowed (0 if allowed now). */
export async function getResendAvailableAt(email: string): Promise<number> {
  const record = await readRecord(email);
  if (!record) return 0;
  const at = record.lastSentAt + waitAfter(record.count) * 1000;
  return at > Date.now() ? at : 0;
}

/** Call at the moment of any send to this address. */
export async function recordVerificationSend(email: string) {
  const record = await readRecord(email);
  await writeRecord(email, { lastSentAt: Date.now(), count: (record?.count ?? 0) + 1 });
}

/** Firebase rate-limited us: restart the wait at the next backoff step. */
export async function extendResendCooldown(email: string) {
  await recordVerificationSend(email);
}

export async function clearVerificationSendRecord(email: string) {
  await AsyncStorage.removeItem(sendKey(email)).catch(() => {});
}

/** Sends the verification email to the signed-in user and records the send. */
export async function sendVerificationEmail(user: User) {
  const current = auth.currentUser;
  if (!current || current.uid !== user.uid) throw new NoSignedInUserError();
  try {
    await sendEmailVerification(current);
  } catch (error) {
    logVerificationError("send", error);
    throw error;
  }
  if (current.email) await recordVerificationSend(current.email);
}

/** Removes the legacy per-user timestamp kept in SecureStore by older builds. */
export async function clearVerificationSent(userId: string) {
  await SecureStore.deleteItemAsync(`evs_sent_${userId}`).catch(() => {});
}

export async function syncVerificationStatus(user: User) {
  try {
    await user.reload();
  } catch (error) {
    logVerificationError("reload", error);
  }

  if (!user.emailVerified) return false;

  try {
    await user.getIdToken(true);
  } catch {
    // Best-effort refresh so backend sees the updated emailVerified claim
  }

  if (user.email) await clearVerificationSendRecord(user.email);
  await clearVerificationSent(user.uid);

  return true;
}

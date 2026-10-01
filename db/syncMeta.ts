import * as SecureStore from "expo-secure-store";

function sanitizeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function getKV(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(sanitizeKey(key));
}

async function setKV(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(sanitizeKey(key), value);
}

async function deleteKV(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(sanitizeKey(key));
}

function emailVerificationKey(userId: string) {
  return `evs_${userId}`;
}

export async function getEmailVerificationStart(
  userId: string,
): Promise<number | null> {
  const raw = await getKV(emailVerificationKey(userId));
  return raw ? Number(raw) : null;
}

export async function setEmailVerificationStart(
  userId: string,
  timestamp: number,
): Promise<void> {
  await setKV(emailVerificationKey(userId), String(timestamp));
}

export async function clearEmailVerificationStart(
  userId: string,
): Promise<void> {
  await deleteKV(emailVerificationKey(userId));
}

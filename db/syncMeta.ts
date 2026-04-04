import { sqliteDb } from "./sqlite";

export async function initSyncMeta() {
  await sqliteDb.runAsync(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

export async function getLastSync(key: string): Promise<number | null> {
  const row = await sqliteDb.getFirstAsync<{ value: string }>(
    `SELECT value FROM sync_meta WHERE key = ?`,
    [key]
  );
  return row ? Number(row.value) : null;
}

export async function setLastSync(key: string, timestamp: number) {
  await sqliteDb.runAsync(
    `INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`,
    [key, String(timestamp)]
  );
}

function getEmailVerificationKey(userId: string) {
  return `email_verification_start:${userId}`;
}

export async function getEmailVerificationStart(
  userId: string,
): Promise<number | null> {
  return getLastSync(getEmailVerificationKey(userId));
}

export async function setEmailVerificationStart(
  userId: string,
  timestamp: number,
) {
  await setLastSync(getEmailVerificationKey(userId), timestamp);
}

export async function clearEmailVerificationStart(userId: string) {
  await sqliteDb.runAsync(
    `DELETE FROM sync_meta WHERE key = ?`,
    [getEmailVerificationKey(userId)],
  );
}

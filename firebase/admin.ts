import { doc, getDoc } from "firebase/firestore";
import { firestoreDb } from "./config";

const ALLOWLIST_DOC = doc(firestoreDb, "adminUsers", "allowlist");

export async function getAdminAllowlist(): Promise<string[]> {
  try {
    const snap = await getDoc(ALLOWLIST_DOC);
    if (!snap.exists()) return [];
    const data = snap.data() as { emails?: string[] };
    return Array.isArray(data.emails) ? data.emails : [];
  } catch {
    return [];
  }
}

export async function isAdminUser(
  email?: string | null,
): Promise<boolean> {
  if (!email) return false;
  const allowlist = await getAdminAllowlist();
  const normalized = email.trim().toLowerCase();
  const isAllowed = allowlist.some(
    (e) => e.trim().toLowerCase() === normalized,
  );
  console.log("[Admin] Logged in user:", normalized);
  console.log(
    "[Admin] Allowlist:",
    allowlist.map((e) => e.trim().toLowerCase()),
  );
  console.log("[Admin] isAdmin:", isAllowed);
  return isAllowed;
}

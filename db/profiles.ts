import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, firestoreDb } from "../firebase/config";
import { sqliteDb } from "./sqlite";

/* ==============================
   TYPES
   ============================== */

export type UserProfile = {
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  height: number | null;
  weeklyGoal: number; // Target workouts per WEEK (default: 1, max: 10)
  authProvider: "email" | "google" | null;
  createdAt: number;
  updatedAt: number;
};

/* ==============================
   FIREBASE PROFILE SYNC
   ============================== */

/**
 * Create or update profile in Firebase
 * Fails silently if user is not authenticated or lacks permissions
 */
export async function syncProfileToFirebase(
  profile: Partial<UserProfile> & { userId: string },
): Promise<boolean> {
  try {
    // Check if user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== profile.userId) {
      console.log(
        "Skipping Firebase sync: user not authenticated or mismatched",
      );
      return false;
    }

    const docRef = doc(firestoreDb, "users", profile.userId, "profile", "data");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Update existing profile
      await updateDoc(docRef, {
        ...profile,
        updatedAt: Date.now(),
      });
    } else {
      // Create new profile
      await setDoc(docRef, {
        ...profile,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    console.log("✅ Profile synced to Firebase");
    return true;
  } catch (error: any) {
    // Check if it's a permissions error
    if (
      error?.code === "permission-denied" ||
      error?.message?.includes("permission")
    ) {
      console.warn(
        "⚠️ Firebase profile sync: permission denied. Check Firestore rules.",
      );
      console.warn(
        "Required rule: allow read, write: if request.auth != null && request.auth.uid == userId;",
      );
    } else {
      console.warn("Failed to sync profile to Firebase:", error);
    }
    return false;
  }
}

/**
 * Get profile from Firebase
 */
export async function getFirebaseProfile(
  userId: string,
): Promise<UserProfile | null> {
  try {
    const docRef = doc(firestoreDb, "users", userId, "profile", "data");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.warn("Failed to get Firebase profile:", error);
    return null;
  }
}

/* ==============================
   CREATE OR UPDATE PROFILE (SQLite + Firebase)
   ============================== */

/**
 * Create a new user profile on first login
 * Supports both email/password and Google sign-in
 * IMPORTANT: Only creates if not exists, otherwise preserves existing data
 */
export async function createUserProfile(
  userId: string,
  email: string,
  options?: {
    displayName?: string | null;
    avatarUrl?: string | null;
    authProvider?: "email" | "google";
  },
): Promise<void> {
  const now = Date.now();
  const authProvider = options?.authProvider || "email";

  // Check if profile already exists locally
  const existingLocal = await sqliteDb.getFirstAsync<UserProfile>(
    `SELECT * FROM user_profiles WHERE userId = ?`,
    [userId],
  );

  if (existingLocal) {
    console.log("📝 Profile exists locally, preserving user data");
    // Profile exists - only update authProvider if needed, don't overwrite user data
    // This preserves displayName, height, etc. that user may have set
    return;
  }

  // Check if profile exists in Firebase (returning user on new device)
  const firebaseProfile = await getFirebaseProfile(userId);

  if (firebaseProfile) {
    console.log("☁️ Found profile in Firebase, syncing to local");
    // Use Firebase data as source of truth for returning users
    await sqliteDb.runAsync(
      `INSERT OR REPLACE INTO user_profiles 
       (userId, email, displayName, avatarUrl, authProvider, height, weeklyGoal, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        firebaseProfile.email || email,
        firebaseProfile.displayName,
        firebaseProfile.avatarUrl,
        firebaseProfile.authProvider || authProvider,
        firebaseProfile.height,
        firebaseProfile.weeklyGoal || 4,
        firebaseProfile.createdAt || now,
        firebaseProfile.updatedAt || now,
      ],
    );
    return;
  }

  // Truly new user - create fresh profile
  console.log("🆕 Creating new profile for first-time user");
  const displayName = options?.displayName || null;
  const avatarUrl = options?.avatarUrl || null;

  // SQLite: Create local profile
  await sqliteDb.runAsync(
    `INSERT INTO user_profiles 
     (userId, email, displayName, avatarUrl, authProvider, weeklyGoal, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, email, displayName, avatarUrl, authProvider, 1, now, now],
  );

  // Firebase: Sync profile (only for new users)
  await syncProfileToFirebase({
    userId,
    email,
    displayName,
    avatarUrl,
    authProvider,
    height: null,
    weeklyGoal: 1,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Get user profile (from SQLite first, then Firebase)
 * Returns null if no profile exists
 */
export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  // Try SQLite first
  const localProfile = await sqliteDb.getFirstAsync<UserProfile>(
    `SELECT * FROM user_profiles WHERE userId = ?`,
    [userId],
  );

  if (localProfile) {
    return localProfile;
  }

  // Try Firebase if no local profile
  const firebaseProfile = await getFirebaseProfile(userId);
  if (firebaseProfile) {
    // Sync to SQLite
    await sqliteDb.runAsync(
      `INSERT OR REPLACE INTO user_profiles 
       (userId, email, displayName, avatarUrl, authProvider, height, weeklyGoal, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firebaseProfile.userId,
        firebaseProfile.email,
        firebaseProfile.displayName,
        firebaseProfile.avatarUrl,
        firebaseProfile.authProvider,
        firebaseProfile.height,
        firebaseProfile.weeklyGoal || 4,
        firebaseProfile.createdAt,
        firebaseProfile.updatedAt,
      ],
    );
    return firebaseProfile;
  }

  return null;
}

/**
 * Update user profile fields
 * Updates both SQLite and Firebase
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, "userId" | "createdAt">>,
): Promise<void> {
  const now = Date.now();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.displayName !== undefined) {
    fields.push("displayName = ?");
    values.push(updates.displayName);
  }

  if (updates.avatarUrl !== undefined) {
    fields.push("avatarUrl = ?");
    values.push(updates.avatarUrl);
  }

  if (updates.height !== undefined) {
    fields.push("height = ?");
    values.push(updates.height);
  }

  if (updates.weeklyGoal !== undefined) {
    fields.push("weeklyGoal = ?");
    values.push(updates.weeklyGoal);
  }

  if (updates.email !== undefined) {
    fields.push("email = ?");
    values.push(updates.email);
  }

  // Always update the updatedAt timestamp
  fields.push("updatedAt = ?");
  values.push(now);

  if (fields.length === 1) {
    // Only updatedAt would be set, skip the query
    return;
  }

  values.push(userId);

  // Update SQLite
  const sql = `UPDATE user_profiles SET ${fields.join(", ")} WHERE userId = ?`;
  await sqliteDb.runAsync(sql, values);

  // Sync to Firebase
  await syncProfileToFirebase({
    userId,
    ...updates,
    updatedAt: now,
  });
}

/**
 * Get all user profiles (for debugging/admin)
 */
export async function getAllProfiles(): Promise<UserProfile[]> {
  const profiles = await sqliteDb.getAllAsync<UserProfile>(
    `SELECT * FROM user_profiles ORDER BY createdAt DESC`,
  );

  return profiles;
}

/**
 * Clear local profile cache on logout
 * Keeps Firebase data intact - it will be restored on next login
 */
export async function clearUserProfile(userId: string): Promise<void> {
  // Delete local cache - Firebase remains the source of truth
  // On next login, profile will be fetched from Firebase
  await sqliteDb.runAsync(`DELETE FROM user_profiles WHERE userId = ?`, [
    userId,
  ]);
  console.log("🧹 Local profile cache cleared for:", userId);
}

/**
 * Hard delete profile (use only when explicitly deleting account)
 */
export async function deleteUserProfile(userId: string): Promise<void> {
  await sqliteDb.runAsync(`DELETE FROM user_profiles WHERE userId = ?`, [
    userId,
  ]);
}

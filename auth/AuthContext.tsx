import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { clearUserProfile, createUserProfile } from "../db/profiles";
import { syncAllData } from "../db/syncQueue";
import { auth } from "../firebase/config";
import { syncWorkoutsFromFirebase } from "../firebase/sync";
import { pullWeightsFromFirebase } from "../firebase/weights";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  /** True while auto-syncing on login/logout */
  isSyncing: boolean;
  syncError: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  isSyncing: false,
  syncError: null,
});

/**
 * Detect if user signed in with Google
 */
function isGoogleUser(user: User): boolean {
  return user.providerData.some(
    (provider) => provider.providerId === "google.com",
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const previousUserRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.email ?? null);

      if (firebaseUser) {
        // Determine auth provider and extract profile info
        const isGoogle = isGoogleUser(firebaseUser);
        const authProvider = isGoogle ? "google" : "email";

        // For Google users, extract display name and photo from provider data
        let displayName: string | null = null;
        let avatarUrl: string | null = null;

        if (isGoogle) {
          // Get Google provider data
          const googleProvider = firebaseUser.providerData.find(
            (p) => p.providerId === "google.com",
          );
          displayName = googleProvider?.displayName || firebaseUser.displayName;
          avatarUrl = googleProvider?.photoURL || firebaseUser.photoURL;
        }

        // Create/update profile with user data
        try {
          await createUserProfile(firebaseUser.uid, firebaseUser.email || "", {
            displayName,
            avatarUrl,
            authProvider,
          });
          console.log("✅ Profile created for user:", firebaseUser.uid, {
            isGoogle,
            displayName,
            hasAvatar: !!avatarUrl,
          });
        } catch (error) {
          console.warn("⚠️ Failed to create profile:", error);
        }

        // 🔄 AUTO-PULL on LOGIN (only if this is a NEW login, not app restart with same user)
        const isNewLogin = previousUserRef.current !== firebaseUser.uid;
        if (isNewLogin) {
          console.log(
            "🔄 New login detected, auto-pulling data from Firebase...",
          );
          setIsSyncing(true);
          setSyncError(null);

          try {
            // Pull all data from Firebase to local SQLite
            await syncWorkoutsFromFirebase(firebaseUser.uid);
            await pullWeightsFromFirebase(firebaseUser.uid);
            console.log("✅ Auto-pull complete for new login");
          } catch (error) {
            console.error("❌ Auto-pull failed:", error);
            setSyncError(
              "Failed to sync data from cloud. Pull to refresh to try again.",
            );
          } finally {
            setIsSyncing(false);
          }
        }

        previousUserRef.current = firebaseUser.uid;
      } else {
        previousUserRef.current = null;
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return unsub;
  }, []);

  const logout = async () => {
    if (user) {
      // 🔄 AUTO-SYNC before logout - CRITICAL to prevent data loss!
      console.log("🔄 Auto-syncing before logout...");
      setIsSyncing(true);
      setSyncError(null);

      try {
        // Push ALL pending local data to Firebase before logout
        const result = await syncAllData(user.uid);
        console.log("✅ Pre-logout sync complete:", result);

        if (result.workouts.failed > 0 || result.weights.failed > 0) {
          // Some data failed to sync - warn user but still allow logout
          console.warn("⚠️ Some data failed to sync:", {
            workoutsFailed: result.workouts.failed,
            weightsFailed: result.weights.failed,
          });
        }
      } catch (error) {
        console.error("❌ Pre-logout sync failed:", error);
        // Still allow logout but data may be lost
        // In a production app, you might want to show a confirmation dialog here
      } finally {
        setIsSyncing(false);
      }

      // Clear profile data after syncing
      try {
        await clearUserProfile(user.uid);
        console.log("✅ Profile cleared for user:", user.uid);
      } catch (error) {
        console.warn("⚠️ Failed to clear profile:", error);
      }
    }

    // Sign out from Firebase
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, isSyncing, syncError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { AppState } from "react-native";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  clearUserProfile,
  createUserProfile,
  getUserProfile,
  updateUserProfile,
} from "../db/profiles";
import { syncAllData } from "../db/syncQueue";
import {
  clearEmailVerificationStart,
  getEmailVerificationStart,
  setEmailVerificationStart,
} from "../db/syncMeta";
import { syncVerificationStatus } from "../utils/verificationService";
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
  /** True when user just signed up and needs to verify email */
  awaitingEmailVerification: boolean;
  /** Called when account is created to mark that verification is pending */
  setAwaitingEmailVerification: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  isSyncing: false,
  syncError: null,
  awaitingEmailVerification: false,
  setAwaitingEmailVerification: () => {},
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
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);
  const previousUserRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.email ?? null);

      if (firebaseUser) {
        // Ensure emailVerified is fresh (especially for users who verified outside the app)
        try {
          await firebaseUser.reload();
        } catch (reloadError) {
          console.warn("⚠️ Failed to refresh auth user:", reloadError);
        }

        // Sync Auth verification state to Firestore (only sets true when verified)
        try {
          await syncVerificationStatus(firebaseUser);
        } catch (verificationSyncError) {
          console.warn("⚠️ Failed to sync verification status:", verificationSyncError);
        }
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
          
          // 📥 Load profile from Firebase to SQLite immediately after login
          // This ensures weight, age, and other profile data are available app-wide
          // (not just when user visits the profile page)
          try {
            const userProfile = await getUserProfile(firebaseUser.uid);
            // Sync email changes from Auth to profile store
            if (
              firebaseUser.email &&
              userProfile?.email &&
              userProfile.email !== firebaseUser.email
            ) {
              await updateUserProfile(firebaseUser.uid, {
                email: firebaseUser.email,
              });
            }
            if (userProfile?.weight || userProfile?.age) {
              console.log("✅ Profile data loaded from Firebase:", {
                weight: userProfile.weight,
                age: userProfile.age,
              });
            }
          } catch (profileError) {
            console.warn("Note: Profile data not yet available on Firebase");
          }
        } catch (error) {
          console.warn("⚠️ Failed to create profile:", error);
        }

        // ✅ Track email verification grace period for existing users
        try {
          if (firebaseUser.emailVerified) {
            await clearEmailVerificationStart(firebaseUser.uid);
          } else {
            const existingStart = await getEmailVerificationStart(
              firebaseUser.uid,
            );
            if (!existingStart) {
              await setEmailVerificationStart(firebaseUser.uid, Date.now());
            }
          }
        } catch (verificationError) {
          console.warn("⚠️ Failed to update verification grace period:", verificationError);
        }

        // 🔄 AUTO-PULL on LOGIN (only if this is a NEW login, not app restart with same user)
        const isNewLogin = previousUserRef.current !== firebaseUser.uid;
        
        // Check if this is a newly created account (account created < 10 seconds ago)
        const creationTime = firebaseUser.metadata?.creationTime;
        const accountCreationTime = creationTime instanceof Date ? creationTime.getTime() : 0;
        const accountAgeMs = Date.now() - accountCreationTime;
        const isNewlyCreatedAccount = accountAgeMs < 10000; // Less than 10 seconds
        
        // Don't sync while awaiting email verification (will sync after verification)
        const shouldSkipSync = awaitingEmailVerification || isNewlyCreatedAccount;
        
        if (isNewLogin && !shouldSkipSync) {
          // Only auto-pull for returning users, not newly created accounts
          // or users awaiting email verification
          console.log(
            "🔄 Returning user detected, auto-pulling data from Firebase...",
          );
          setIsSyncing(true);
          setSyncError(null);

          try {
            // Pull all data from Firebase to local SQLite
            await syncWorkoutsFromFirebase(firebaseUser.uid);
            await pullWeightsFromFirebase(firebaseUser.uid);
            console.log("✅ Auto-pull complete for returning user");
          } catch (error) {
            console.error("❌ Auto-pull failed:", error);
            setSyncError(
              "Failed to sync data from cloud. Pull to refresh to try again.",
            );
          } finally {
            setIsSyncing(false);
          }
        } else if (shouldSkipSync) {
          if (awaitingEmailVerification) {
            console.log("✅ Email verification pending, skipping auto-sync (will sync after verification)");
          } else {
            console.log("✅ New account created, skipping auto-sync (no data to pull yet)");
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

  // Refresh verification state when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !auth.currentUser) return;
      try {
        await syncVerificationStatus(auth.currentUser);
      } catch (verificationSyncError) {
        console.warn("⚠️ Failed to sync verification status on foreground:", verificationSyncError);
      }
    });

    return () => subscription.remove();
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
      value={{ 
        user, 
        loading, 
        logout, 
        isSyncing, 
        syncError,
        awaitingEmailVerification,
        setAwaitingEmailVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

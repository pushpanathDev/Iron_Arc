import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { AppState } from "react-native";
import { createContext, useContext, useEffect, useState } from "react";
import {
  clearEmailVerificationStart,
  getEmailVerificationStart,
  setEmailVerificationStart,
} from "../db/syncMeta";
import { syncVerificationStatus } from "../utils/verificationService";
import { auth } from "../firebase/config";

const VERIFICATION_PENDING_KEY = "@awaiting_email_verification_uid";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  /** Always false — kept for backwards compatibility while screens migrate */
  isSyncing: boolean;
  syncError: string | null;
  /** True when user just signed up and needs to verify email */
  awaitingEmailVerification: boolean;
  /** Called when account is created to mark that verification is pending */
  setAwaitingEmailVerification: (value: boolean, uid?: string) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  isSyncing: false,
  syncError: null,
  awaitingEmailVerification: false,
  setAwaitingEmailVerification: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [awaitingEmailVerification, setAwaitingEmailVerificationState] = useState(false);

  // Persisted setter — keeps AsyncStorage in sync
  const setAwaitingEmailVerification = async (value: boolean, uid?: string) => {
    setAwaitingEmailVerificationState(value);
    try {
      if (value && uid) {
        await AsyncStorage.setItem(VERIFICATION_PENDING_KEY, uid);
      } else {
        await AsyncStorage.removeItem(VERIFICATION_PENDING_KEY);
      }
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await firebaseUser.reload();
        } catch {
          // Best-effort reload
        }

        // Sync email verification status to Firestore
        try {
          await syncVerificationStatus(firebaseUser);
        } catch {
          // Non-critical
        }

        // Track email verification grace period
        try {
          if (firebaseUser.emailVerified) {
            await clearEmailVerificationStart(firebaseUser.uid);
            // Clear persisted verification flag since they are now verified
            await setAwaitingEmailVerification(false);
          } else {
            const existingStart = await getEmailVerificationStart(firebaseUser.uid);
            if (!existingStart) {
              await setEmailVerificationStart(firebaseUser.uid, Date.now());
            }
            // Restore persisted verification pending state on app restart
            try {
              const pendingUid = await AsyncStorage.getItem(VERIFICATION_PENDING_KEY);
              if (pendingUid === firebaseUser.uid) {
                setAwaitingEmailVerificationState(true);
              }
            } catch {
              // Non-critical
            }
          }
        } catch {
          // Non-critical
        }
      } else {
        // User signed out — clear persisted verification state
        await AsyncStorage.removeItem(VERIFICATION_PENDING_KEY).catch(() => {});
        setAwaitingEmailVerificationState(false);
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return unsub;
  }, []);

  // Re-check email verification when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !auth.currentUser) return;
      try {
        await syncVerificationStatus(auth.currentUser);
      } catch {
        // Non-critical
      }
    });

    return () => subscription.remove();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        isSyncing: false,
        syncError: null,
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearEmailVerificationStart,
  getEmailVerificationStart,
  setEmailVerificationStart,
} from "../db/syncMeta";
import { syncVerificationStatus } from "../utils/verificationService";
import { auth } from "../firebase/config";
import {
  isNetworkApiError,
  User as ApiUser,
  userApi,
} from "../services/api";
import { cancelAllScheduledNotifications } from "../notifications/notificationService";

const VERIFICATION_PENDING_KEY = "@awaiting_email_verification_uid";

export type AuthStatus =
  | "loading"
  | "signedOut"
  | "unverified"
  | "bootstrapping"
  | "needsOnboarding"
  | "ready"
  | "bootstrapError"
  | "backendUnreachable";

type AuthContextType = {
  user: FirebaseUser | null;
  profile: ApiUser | null;
  loading: boolean;
  status: AuthStatus;
  bootstrapError: string | null;
  retryBootstrap: () => Promise<void>;
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
  profile: null,
  loading: true,
  status: "loading",
  bootstrapError: null,
  retryBootstrap: async () => {},
  logout: async () => {},
  isSyncing: false,
  syncError: null,
  awaitingEmailVerification: false,
  setAwaitingEmailVerification: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<ApiUser | null>(
    () => queryClient.getQueryData<ApiUser>(["profile"]) ?? null,
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
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

  const bootstrapUser = useCallback(async (firebaseUser: FirebaseUser) => {
    setStatus("bootstrapping");
    setBootstrapError(null);

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await userApi.sync();
        const nextProfile = await userApi.getProfile();
        queryClient.setQueryData(["profile"], nextProfile);
        setProfile(nextProfile);
        setStatus(nextProfile.displayName && nextProfile.fitnessGoal ? "ready" : "needsOnboarding");
        return;
      } catch (error) {
        lastError = error;
        if (!isNetworkApiError(error) || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }

    if (auth.currentUser?.uid !== firebaseUser.uid) return;
    const message = isNetworkApiError(lastError)
      ? "Can't reach the server. Check your connection and try again."
      : lastError instanceof Error
        ? lastError.message
        : "Could not load your account.";
    setBootstrapError(message);
    setStatus(isNetworkApiError(lastError) ? "backendUnreachable" : "bootstrapError");
    setProfile(queryClient.getQueryData<ApiUser>(["profile"]) ?? null);
  }, [queryClient]);

  const retryBootstrap = useCallback(async () => {
    if (auth.currentUser?.emailVerified) {
      await bootstrapUser(auth.currentUser);
    }
  }, [bootstrapUser]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
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
            await bootstrapUser(firebaseUser);
          } else {
            setStatus("unverified");
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
        setUser(null);
        setProfile(null);
        setStatus("signedOut");
      }

    });

    return unsub;
  }, [bootstrapUser]);

  // Re-check email verification when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !auth.currentUser) return;
      try {
        const currentUser = auth.currentUser;
        const verified = await syncVerificationStatus(currentUser);
        if (verified && status === "backendUnreachable") {
          await bootstrapUser(currentUser);
        }
      } catch {
        // Non-critical
      }
    });

    return () => subscription.remove();
  }, [bootstrapUser, status]);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && auth.currentUser?.emailVerified && status === "backendUnreachable") {
        void bootstrapUser(auth.currentUser);
      }
    });
  }, [bootstrapUser, status]);

  const logout = async () => {
    await cancelAllScheduledNotifications();
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        status,
        bootstrapError,
        retryBootstrap,
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

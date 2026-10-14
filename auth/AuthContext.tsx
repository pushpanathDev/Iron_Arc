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
  ApiError,
  checkHealth,
  isNetworkApiError,
  User as ApiUser,
  userApi,
} from "../services/api";
import { cancelAllScheduledNotifications } from "../notifications/notificationService";
import { getGoogleSignin } from "../utils/googleSignin";

const VERIFICATION_PENDING_KEY = "@awaiting_email_verification_uid";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new ApiError(`${label} timed out after ${ms}ms`, 0, undefined, undefined, "timeout")),
        ms,
      ),
    ),
  ]);
}

const LAST_UID_KEY = "@iron_arc_last_uid";
const QUERY_CACHE_KEY = "IRON_ARC_QUERY_CACHE";
const AUTH_STEP_TIMEOUT = 8_000;
const HEALTH_CHECK_TIMEOUT = 60_000;
const BOOTSTRAP_STEP_TIMEOUT = 15_000;
const BOOTSTRAP_CAP_MS = 75_000;

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

    try {
      console.log("[Auth] bootstrap: health check (wake-up)…");
      await withTimeout(checkHealth(), HEALTH_CHECK_TIMEOUT, "health");
      console.log("[Auth] bootstrap: server awake");
    } catch (e) {
      console.warn("[Auth] bootstrap: health check failed:", e);
    }

    try {
      console.log("[Auth] bootstrap: userApi.sync…");
      await withTimeout(userApi.sync(), BOOTSTRAP_STEP_TIMEOUT, "userApi.sync");
      console.log("[Auth] bootstrap: sync done");

      console.log("[Auth] bootstrap: userApi.getProfile…");
      const nextProfile = await withTimeout(userApi.getProfile(), BOOTSTRAP_STEP_TIMEOUT, "userApi.getProfile");
      console.log("[Auth] bootstrap: getProfile done");

      if (auth.currentUser?.uid !== firebaseUser.uid) return;
      queryClient.setQueryData(["profile"], nextProfile);
      setProfile(nextProfile);
      await AsyncStorage.setItem(LAST_UID_KEY, firebaseUser.uid).catch(() => {});
      setStatus(nextProfile.displayName && nextProfile.fitnessGoal ? "ready" : "needsOnboarding");
    } catch (error) {
      if (auth.currentUser?.uid !== firebaseUser.uid) return;
      const message = isNetworkApiError(error)
        ? "Can't reach the server. Check your connection and try again."
        : error instanceof Error
          ? error.message
          : "Could not load your account.";
      setBootstrapError(message);
      setStatus(isNetworkApiError(error) ? "backendUnreachable" : "bootstrapError");
      setProfile(queryClient.getQueryData<ApiUser>(["profile"]) ?? null);
    }
  }, [queryClient]);

  const retryBootstrap = useCallback(async () => {
    if (auth.currentUser?.emailVerified) {
      try {
        await withTimeout(bootstrapUser(auth.currentUser), BOOTSTRAP_CAP_MS, "bootstrap retry");
      } catch (e) {
        console.warn(`[Auth] retry cap reached: ${e}`);
        if (auth.currentUser) {
          setBootstrapError("Can't reach the server. Check your connection and try again.");
          setStatus("backendUnreachable");
        }
      }
    }
  }, [bootstrapUser]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const t0 = Date.now();
      const ms = () => `${Date.now() - t0}ms`;

      // ── No user → straight to login ──
      if (!firebaseUser) {
        console.log(`[Auth] onAuthStateChanged: no user (${ms()})`);
        queryClient.clear();
        await AsyncStorage.removeItem(QUERY_CACHE_KEY).catch(() => {});
        await AsyncStorage.removeItem(VERIFICATION_PENDING_KEY).catch(() => {});
        await AsyncStorage.removeItem(LAST_UID_KEY).catch(() => {});
        setAwaitingEmailVerificationState(false);
        setUser(null);
        setProfile(null);
        setLoading(false);
        setStatus("signedOut");
        return;
      }

      console.log(`[Auth] onAuthStateChanged: uid=${firebaseUser.uid} verified=${firebaseUser.emailVerified} (${ms()})`);
      setUser(firebaseUser);
      setLoading(false);

      // ── Unverified user — no blocking network needed ──
      if (!firebaseUser.emailVerified) {
        console.log(`[Auth] user not verified, setting unverified (${ms()})`);
        setStatus("unverified");
        try {
          const existingStart = await getEmailVerificationStart(firebaseUser.uid);
          if (!existingStart) {
            await setEmailVerificationStart(firebaseUser.uid, Date.now());
          }
        } catch { /* non-critical */ }
        try {
          const pendingUid = await AsyncStorage.getItem(VERIFICATION_PENDING_KEY);
          if (pendingUid === firebaseUser.uid) {
            setAwaitingEmailVerificationState(true);
          }
        } catch { /* non-critical */ }
        return;
      }

      // Verified — clear verification bookkeeping
      await clearEmailVerificationStart(firebaseUser.uid).catch(() => {});
      await setAwaitingEmailVerification(false);

      // Verify cached profile belongs to this user
      const lastUid = await AsyncStorage.getItem(LAST_UID_KEY).catch(() => null);
      if (lastUid !== null && lastUid !== firebaseUser.uid) {
        console.log(`[Auth] UID changed (${lastUid} → ${firebaseUser.uid}), clearing cache (${ms()})`);
        queryClient.clear();
        await AsyncStorage.removeItem(QUERY_CACHE_KEY).catch(() => {});
        await AsyncStorage.removeItem(LAST_UID_KEY).catch(() => {});
      }

      const cached = queryClient.getQueryData<ApiUser>(["profile"]);
      const onboardingDone = !!(cached?.displayName && cached?.fitnessGoal);

      if (cached && onboardingDone) {
        // ── Instant ready: show the app now, sync in the background ──
        console.log(`[Auth] cached profile found (onboarding complete), instant ready (${ms()})`);
        setProfile(cached);
        setStatus("ready");

        void (async () => {
          try {
            console.log(`[Auth] bg: reload (${ms()})`);
            await withTimeout(firebaseUser.reload(), AUTH_STEP_TIMEOUT, "reload");
            console.log(`[Auth] bg: reload done (${ms()})`);
          } catch (e) { console.warn("[Auth] bg reload failed:", e); }

          try {
            console.log(`[Auth] bg: syncVerification (${ms()})`);
            await withTimeout(syncVerificationStatus(firebaseUser), AUTH_STEP_TIMEOUT, "syncVerification");
            console.log(`[Auth] bg: syncVerification done (${ms()})`);
          } catch (e) { console.warn("[Auth] bg syncVerification failed:", e); }

          try {
            console.log(`[Auth] bg: userApi.sync (${ms()})`);
            await withTimeout(userApi.sync(), AUTH_STEP_TIMEOUT, "userApi.sync");
            console.log(`[Auth] bg: userApi.sync done (${ms()})`);
          } catch (e) { console.warn("[Auth] bg sync failed:", e); }

          try {
            console.log(`[Auth] bg: userApi.getProfile (${ms()})`);
            const fresh = await withTimeout(userApi.getProfile(), AUTH_STEP_TIMEOUT, "userApi.getProfile");
            console.log(`[Auth] bg: getProfile done (${ms()})`);
            if (auth.currentUser?.uid === firebaseUser.uid) {
              queryClient.setQueryData(["profile"], fresh);
              setProfile(fresh);
              await AsyncStorage.setItem(LAST_UID_KEY, firebaseUser.uid).catch(() => {});
              if (!fresh.displayName || !fresh.fitnessGoal) {
                setStatus("needsOnboarding");
              }
            }
          } catch (e) {
            console.warn("[Auth] bg getProfile failed:", e);
            if (auth.currentUser?.uid === firebaseUser.uid) {
              setStatus("backendUnreachable");
            }
          }
        })();
        return;
      }

      // ── No cached profile: full-screen loader, capped at 75 s ──
      console.log(`[Auth] no cached profile, bootstrapping with ${BOOTSTRAP_CAP_MS}ms cap (${ms()})`);
      try {
        await withTimeout(bootstrapUser(firebaseUser), BOOTSTRAP_CAP_MS, "bootstrap");
      } catch (e) {
        console.warn(`[Auth] bootstrap cap reached: ${e}`);
        if (auth.currentUser?.uid === firebaseUser.uid) {
          setBootstrapError("Can't reach the server. Check your connection and try again.");
          setStatus("backendUnreachable");
        }
      }
    });

    return unsub;
  }, [bootstrapUser, queryClient]);

  // Re-check email verification when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !auth.currentUser) return;
      try {
        const currentUser = auth.currentUser;
        console.log("[Auth] app foregrounded, syncing verification…");
        const verified = await withTimeout(
          syncVerificationStatus(currentUser),
          AUTH_STEP_TIMEOUT,
          "foreground syncVerification",
        );
        console.log(`[Auth] foreground sync done, verified=${verified}`);
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
    await AsyncStorage.removeItem(LAST_UID_KEY).catch(() => {});
    try { await getGoogleSignin()?.GoogleSignin.signOut(); } catch {}
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

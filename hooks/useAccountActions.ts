import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useRef, useState } from "react";
import { useAuth } from "../providers/AuthContext";
import { useToast } from "../providers/ToastContext";
import { userApi } from "../services/api";
import { clearVerificationSent } from "../services/emailVerification";
import { auth } from "../services/firebase";
import { getGoogleSignin } from "../services/googleSignin";
import { clearEmailVerificationStart } from "../services/verificationStore";
import { createPageLogger } from "../utils/logger";

const log = createPageLogger("Profile");

/**
 * Log out, and delete the account. Firebase may ask for a recent sign-in
 * before deleting: Google accounts sign in again in place; email accounts
 * confirm their password (`reauth`).
 */
export function useAccountActions() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [deleting, setDeleting] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);

  const logOut = async () => {
    try {
      // No stale data or background refetches after sign-out.
      queryClient.cancelQueries();
      queryClient.clear();
      await logout();
      router.replace("/login");
    } catch (e) {
      log.error(`Logout failed: ${e}`);
      showToast({ type: "error", message: "Couldn't log out", subtitle: "Please try again." });
    }
  };

  const clearLocalAccountData = async () => {
    const uid = user?.uid;
    queryClient.cancelQueries();
    queryClient.clear();
    try {
      try {
        await getGoogleSignin()?.GoogleSignin.signOut();
      } catch {}
      await logout();
    } finally {
      await AsyncStorage.clear();
      if (uid) await Promise.allSettled([clearEmailVerificationStart(uid), clearVerificationSent(uid)]);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setReauthError(null);
    try {
      await userApi.deleteAccount();
      await clearLocalAccountData();
      router.replace("/login");
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code !== "REAUTHENTICATION_REQUIRED") {
        log.error(`Account deletion failed: ${e}`);
        showToast({ type: "error", message: "Couldn't delete account", subtitle: err?.message || "Please try again." });
        return;
      }
      const providerId = user?.providerData[0]?.providerId;
      const google = getGoogleSignin();
      if (providerId === "google.com" && !google) {
        showToast({ type: "error", message: "Sign in again to delete", subtitle: "Google sign-in isn't available in this preview. Use the full app." });
      } else if (providerId === "google.com" && google) {
        try {
          const response = await google.GoogleSignin.signIn();
          const idToken = google.isSuccessResponse(response) ? response.data.idToken : null;
          if (idToken && auth.currentUser) {
            await reauthenticateWithCredential(auth.currentUser, GoogleAuthProvider.credential(idToken));
            await deleteAccountRef.current();
            return;
          }
        } catch (reAuthErr: unknown) {
          showToast({ type: "error", message: "Google sign-in failed", subtitle: (reAuthErr as Error)?.message });
        }
      } else {
        setReauthOpen(true);
      }
    } finally {
      setDeleting(false);
    }
  };
  const deleteAccountRef = useRef(deleteAccount);
  deleteAccountRef.current = deleteAccount;

  const confirmPassword = async () => {
    if (!auth.currentUser?.email || !password) {
      setReauthError("Enter your password to continue.");
      return;
    }
    setDeleting(true);
    setReauthError(null);
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password));
      setReauthOpen(false);
      setPassword("");
      await deleteAccount();
    } catch (e: unknown) {
      setReauthError((e as Error)?.message || "That password didn't work.");
      setDeleting(false);
    }
  };

  const cancelReauth = () => {
    setReauthOpen(false);
    setPassword("");
    setReauthError(null);
  };

  return {
    logOut,
    deleteAccount,
    deleting,
    reauth: { open: reauthOpen, password, setPassword, error: reauthError, confirm: confirmPassword, cancel: cancelReauth },
  };
}

export type ReauthState = ReturnType<typeof useAccountActions>["reauth"];

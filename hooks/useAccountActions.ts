import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useState } from "react";
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
 * Log out, and delete the account. Deleting always confirms it's really you
 * first: email accounts enter their password (`reauth`), Google accounts
 * sign in with Google again.
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

  /** Sends the delete, once the user has confirmed it's really them. */
  const deleteNow = async () => {
    setDeleting(true);
    try {
      await userApi.deleteAccount();
      await clearLocalAccountData();
      router.replace("/login");
    } catch (e: unknown) {
      log.error(`Account deletion failed: ${e}`);
      showToast({ type: "error", message: "Couldn't delete account", subtitle: (e as Error)?.message || "Please try again." });
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Deleting always confirms it's really you first: your password for email
   * accounts, Google sign-in for Google ones.
   */
  const deleteAccount = async () => {
    if (user?.providerData[0]?.providerId !== "google.com") {
      setPassword("");
      setReauthError(null);
      setReauthOpen(true);
      return;
    }
    const google = getGoogleSignin();
    if (!google) {
      showToast({ type: "error", message: "Sign in again to delete", subtitle: "Google sign-in isn't available in this preview. Use the full app." });
      return;
    }
    try {
      const response = await google.GoogleSignin.signIn();
      const idToken = google.isSuccessResponse(response) ? response.data.idToken : null;
      if (!idToken || !auth.currentUser) return; // cancelled
      await reauthenticateWithCredential(auth.currentUser, GoogleAuthProvider.credential(idToken));
      await deleteNow();
    } catch (e: unknown) {
      showToast({ type: "error", message: "Google sign-in failed", subtitle: (e as Error)?.message });
    }
  };

  const confirmPassword = async () => {
    if (!auth.currentUser?.email || !password) {
      setReauthError("Enter your password to continue.");
      return;
    }
    setDeleting(true);
    setReauthError(null);
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password));
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      setReauthError(code === "auth/wrong-password" || code === "auth/invalid-credential" ? "That password isn't right." : (e as Error)?.message || "That password didn't work.");
      setDeleting(false);
      return;
    }
    setReauthOpen(false);
    setPassword("");
    await deleteNow();
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

import * as Haptics from "expo-haptics";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, type User } from "firebase/auth";
import { useRef, useState } from "react";
import { Keyboard } from "react-native";
import { useAuth } from "../providers/AuthContext";
import { userApi } from "../services/api";
import { getResendAvailableAt, sendVerificationEmail } from "../services/emailVerification";
import { auth } from "../services/firebase";
import { getGoogleSignin } from "../services/googleSignin";
import { signInErrorMessage, signUpErrorMessage } from "../utils/authErrors";
import { getEmailValidationMessage, sanitizeEmail, validateEmail, validatePasswordStrength } from "../utils/emailPasswordValidation";
import type { useLoginForm } from "./useLoginForm";

type LoginForm = ReturnType<typeof useLoginForm>;
type Action = "email" | "google";

const warn = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
const fail = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
const succeed = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/**
 * Signing in and creating an account (email and Google), for the login screen.
 * New accounts confirm their address first (typo check), then get the
 * verification prompt, which can't be skipped. One request at a time.
 * `onAccountExists` switches the screen back to sign in.
 */
export function useEmailAuth(form: LoginForm, isSignup: boolean, onAccountExists: () => void) {
  const { setAwaitingEmailVerification, onEmailVerified, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Which button started the current request, so only that one shows a spinner.
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const submitting = useRef(false);

  // Sign-up typo check ("Is this your email?") before the account is created.
  const [pendingSignup, setPendingSignup] = useState<{ email: string; password: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Verification prompt after sign-up, or after signing in to an unverified account.
  const [verifyUser, setVerifyUser] = useState<User | null>(null);
  const showVerification = (user: User, message: string | null) => {
    setVerifyUser(user);
    setError(message);
  };

  /** Ignores taps that land before the loading state re-renders. */
  const runOnce = async (action: Action, task: () => Promise<void>) => {
    if (submitting.current) return;
    submitting.current = true;
    setPendingAction(action);
    Keyboard.dismiss();
    try {
      await task();
    } finally {
      submitting.current = false;
      setPendingAction(null);
    }
  };

  const submitEmail = async () => {
    const { email, password } = form;
    if (!email.trim()) {
      setError("Email address is required");
      warn();
      return;
    }
    if (!password) {
      setError("Password is required");
      warn();
      return;
    }
    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      const message = getEmailValidationMessage(email);
      setError(message);
      form.setEmailError(message);
      fail();
      return;
    }

    if (isSignup) {
      // A warning (likely typo, throwaway domain) doesn't block sign-up.
      if (emailCheck.warnings.length > 0) form.setEmailWarning(emailCheck.warnings[0]);
      const strength = validatePasswordStrength(password);
      if (!strength.isValid) {
        setError(`Password is too weak: ${strength.errors.join(", ")}`);
        fail();
        return;
      }
      setPendingSignup({ email: sanitizeEmail(email), password });
      setConfirmOpen(true);
      return;
    }

    // Sign in (existing account)
    try {
      setLoading(true);
      setError(null);
      form.setEmailWarning(null);
      await signInWithEmailAndPassword(auth, sanitizeEmail(email), password);
      const current = auth.currentUser;
      if (current && !current.emailVerified) {
        await current.reload();
        if (auth.currentUser && !auth.currentUser.emailVerified) {
          setAwaitingEmailVerification(true, auth.currentUser.uid);
          showVerification(auth.currentUser, "Please verify your email before continuing. Check your inbox for the verification link.");
          setLoading(false);
          return;
        }
      }
      await userApi.sync();
      succeed();
    } catch (err: unknown) {
      fail();
      const e = err as { code?: string; message?: string };
      // Expected (wrong password, etc.): the form shows a friendly message.
      if (__DEV__) console.log("[Login] auth failed:", e?.code ?? err);
      setError(signInErrorMessage(e?.code, e?.message));
      setLoading(false);
    }
  };

  const confirmSignup = async () => {
    if (!pendingSignup) return;
    const { email, password } = pendingSignup;
    try {
      setLoading(true);
      setConfirmOpen(false);
      setError(null);
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      // Persisted so an app restart can't skip verification.
      await setAwaitingEmailVerification(true, user.uid);
      try {
        await sendVerificationEmail(user);
        showVerification(user, null);
        succeed();
      } catch (sendError) {
        console.warn("Verification email send failed:", sendError);
        // The prompt still opens; it has a Resend button.
        showVerification(user, "Verification email may not have been sent. Click Resend.");
      }
    } catch (err: unknown) {
      fail();
      const e = err as { code?: string; message?: string };
      if (e?.code === "auth/email-already-in-use") {
        await signInToExistingAccount(email, password);
        return;
      }
      console.error("Signup error:", err);
      setError(signUpErrorMessage(e?.code, e?.message));
      setConfirmOpen(true);
      setAwaitingEmailVerification(false);
    } finally {
      setLoading(false);
    }
  };

  /** Sign-up with an address that already has an account: sign in if the password matches. */
  const signInToExistingAccount = async (email: string, password: string) => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      await user.reload();
      if (!user.emailVerified) {
        await setAwaitingEmailVerification(true, user.uid);
        // Re-send only if this address is out of its cooldown; otherwise the
        // earlier email is still valid and the prompt shows the wait.
        if (!(await getResendAvailableAt(email))) await sendVerificationEmail(user).catch(() => {});
        showVerification(user, "This account already exists and still needs email verification.");
        return;
      }
      setAwaitingEmailVerification(false);
      setError("This account already existed, so you have been signed in.");
    } catch (existingError: unknown) {
      setError(
        (existingError as { code?: string })?.code === "auth/wrong-password"
          ? "This email is already registered. Sign in with the correct password."
          : "This email is already registered. Try logging in instead.",
      );
      onAccountExists();
      setConfirmOpen(false);
      setAwaitingEmailVerification(false);
    }
  };

  const signInWithGoogle = async () => {
    const google = getGoogleSignin();
    if (!google) {
      setError("Google sign-in isn't available in this preview.");
      return;
    }
    const { GoogleSignin, isSuccessResponse, statusCodes } = google;
    try {
      setLoading(true);
      setError(null);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      const idToken = response.data.idToken;
      if (!idToken) {
        setError("Google Sign-In failed — no token received. Please try again.");
        return;
      }
      const result = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      // Keep the server in step with Google: a link to Google's copy of the photo (no image is
      // stored), refreshed on every Google sign-in so a changed photo carries over.
      const photo = result.user.photoURL ?? response.data.user.photo ?? null;
      void userApi
        .updateProfile({ authProvider: "google", ...(photo ? { avatarUrl: photo } : {}) })
        .catch((e) => console.warn("[login] Couldn't save the Google photo link:", e));
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) return;
      fail();
      if (e?.code === "auth/account-exists-with-different-credential") {
        setError("An account already exists with the same email but different sign-in credentials.");
      } else {
        console.error("Google Sign-In error:", err);
        setError("Google Sign-In failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const closeVerification = () => {
    setVerifyUser(null);
  };

  return {
    error,
    clearError: () => setError(null),
    loading,
    pendingAction,
    busy: loading || pendingAction !== null,
    submitEmail: () => runOnce("email", submitEmail),
    signInWithGoogle: () => runOnce("google", signInWithGoogle),
    confirmation: {
      open: confirmOpen,
      email: pendingSignup?.email ?? "",
      confirm: confirmSignup,
      edit: () => setConfirmOpen(false),
      cancel: () => {
        setConfirmOpen(false);
        setPendingSignup(null);
        setError(null);
      },
    },
    verification: {
      open: !!verifyUser,
      user: verifyUser,
      // New accounts must verify before continuing.
      skip: () => setError("Please verify your email to continue."),
      // Signing in to an unverified account used to skip this load, so onboarding never showed.
      verified: async () => {
        closeVerification();
        await onEmailVerified();
      },
      resent: () => setError(null),
      useDifferentAccount: async () => {
        closeVerification();
        setError(null);
        await logout();
        setAwaitingEmailVerification(false);
      },
    },
  };
}

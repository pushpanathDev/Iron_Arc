import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "../auth/AuthContext";
import { auth } from "../firebase/config";
import { useTheme } from "../theme/theme";
import { alpha, motion, radius, size, spacing, touchTarget, tracking, typography, withAlpha } from "../theme/tokens";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal";
import { EmailVerificationPrompt } from "../components/EmailVerificationPrompt";
import { EmailConfirmationModal } from "../components/EmailConfirmationModal";
import { sendVerificationEmail } from "../utils/verificationService";
import { userApi } from "../services/api";
import { getVersionLabel } from "../utils/appVersion";
import { Button, FadingMessage, GoogleLogo, PressableScale, TextField } from "../components/ui";
import { getGoogleSignin, isGoogleSignInAvailable } from "../utils/googleSignin";
import {
  validateEmail,
  validatePasswordStrength,
  sanitizeEmail,
  getEmailValidationMessage,
} from "../utils/emailPasswordValidation";

const APP_LOGO = require("../assets/images/icon.png");
const PASSWORD_RULES = "At least 8 characters, with upper and lower case letters and a number.";

export default function LoginScreen() {
  const { colors } = useTheme();
  const {
    user,
    loading: authLoading,
    retryBootstrap,
    setAwaitingEmailVerification,
    awaitingEmailVerification,
    logout,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const googleAvailable = isGoogleSignInAvailable();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [pendingSignupEmail, setPendingSignupEmail] = useState("");
  const [pendingSignupPassword, setPendingSignupPassword] = useState("");
  const [verificationUser, setVerificationUser] = useState<any>(null);
  const [verificationOrigin, setVerificationOrigin] = useState<
    "signup" | "signin" | null
  >(null);
  const [emailValidationWarning, setEmailValidationWarning] = useState<
    string | null
  >(null);
  const [emailValidationError, setEmailValidationError] = useState<
    string | null
  >(null);
  // Which button started the current request, so only that one shows a spinner.
  const [pendingAction, setPendingAction] = useState<"email" | "google" | null>(null);
  const submittingRef = useRef(false);

  /* Email input: errors clear on edit and come back on blur or submit; warnings stay live. */
  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailValidationError(null);
    setError(null);

    if (text.length > 5) {
      const validation = validateEmail(text);
      setEmailValidationWarning(validation.isValid && validation.warnings.length > 0 ? validation.warnings[0] : null);
    } else {
      setEmailValidationWarning(null);
    }
  };

  const handleEmailBlur = () => {
    if (email.length <= 5) return;
    const validation = validateEmail(email);
    if (!validation.isValid) setEmailValidationError(validation.errors[0]);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setError(null);
  };

  /* Sign in <-> Create account: fade out, swap, fade in. */
  const modeOpacity = useSharedValue(1);
  const modeStyle = useAnimatedStyle(() => ({ opacity: modeOpacity.value }));
  const applyMode = useCallback(
    (toSignup: boolean) => {
      setIsSignup(toSignup);
      setError(null);
      setEmailValidationError(null);
      modeOpacity.value = withTiming(1, { duration: motion.modeMs / 2 });
    },
    [modeOpacity],
  );
  const switchMode = useCallback(
    (toSignup: boolean) => {
      modeOpacity.value = withTiming(0, { duration: motion.modeMs / 2 }, () => {
        runOnJS(applyMode)(toSignup);
      });
    },
    [modeOpacity, applyMode],
  );

  // Sign up is a mode of this screen, so system back returns to sign in instead of exiting.
  useEffect(() => {
    if (!isSignup) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      switchMode(false);
      return true;
    });
    return () => sub.remove();
  }, [isSignup, switchMode]);

  /* One request at a time: ignores taps that land before the loading state re-renders. */
  const runOnce = async (action: "email" | "google", task: () => Promise<void>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPendingAction(action);
    Keyboard.dismiss();
    try {
      await task();
    } finally {
      submittingRef.current = false;
      setPendingAction(null);
    }
  };

  const handleUseDifferentAccount = async () => {
    setShowEmailVerification(false);
    setVerificationUser(null);
    setVerificationOrigin(null);
    setError(null);
    await logout();
    setAwaitingEmailVerification(false);
  };

  /* EMAIL / PASSWORD AUTH */
  const handleAuth = async () => {
    // Client-side validation
    if (!email.trim()) {
      setError("Email address is required");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!password) {
      setError("Password is required");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      const errorMsg = getEmailValidationMessage(email);
      setError(errorMsg);
      setEmailValidationError(errorMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.warn("Email validation failed:", emailValidation.errors);
      return;
    }

    // Check for warnings (allow signup but warn user)
    if (emailValidation.warnings.length > 0 && isSignup) {
      setEmailValidationWarning(emailValidation.warnings[0]);
      // Don't block signup, just warn
    }

    // Signup-specific validations
    if (isSignup) {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        const errors = passwordValidation.errors.join(", ");
        setError(`Password is too weak: ${errors}`);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );
        return;
      }

      // Show email confirmation modal BEFORE creating account
      const sanitizedEmail = sanitizeEmail(email);
      setPendingSignupEmail(sanitizedEmail);
      setPendingSignupPassword(password);
      setShowEmailConfirmation(true);
      return; // Don't proceed to account creation yet
    }

    // LOGIN FLOW (non-signup)
    try {
      setLoading(true);
      setError(null);
      setEmailValidationWarning(null);

      const sanitizedEmail = sanitizeEmail(email);

      // Sign in with email/password
      await signInWithEmailAndPassword(
        auth,
        sanitizedEmail,
        password
      );

      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.emailVerified) {
        await currentUser.reload();

        if (!auth.currentUser?.emailVerified) {
          console.warn(
            "⚠️ User signed in but email not yet verified:",
            sanitizedEmail
          );
          setAwaitingEmailVerification(true, auth.currentUser?.uid);
          setVerificationUser(auth.currentUser);
          setVerificationOrigin("signin");
          setShowEmailVerification(true);
          setError(
            "Please verify your email before continuing. Check your inbox for the verification link.",
          );
          setLoading(false);
          return;
        }
      }

      await userApi.sync();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Auth error:", err);

      // Translate Firebase errors to user-friendly messages
      let userMessage = "Authentication failed";

      if (err.code === "auth/email-already-in-use") {
        userMessage = "This email is already registered. Try logging in instead.";
      } else if (err.code === "auth/invalid-email") {
        userMessage = "Invalid email address. Please check and try again.";
      } else if (err.code === "auth/weak-password") {
        userMessage =
          "Password too weak. Use at least 8 characters with uppercase, lowercase, and numbers.";
      } else if (err.code === "auth/user-not-found") {
        userMessage = "No account found with this email. Create a new one instead.";
      } else if (err.code === "auth/wrong-password") {
        userMessage = "Incorrect password. Please try again.";
      } else if (err.code === "auth/invalid-credential") {
        // Firebase: Invalid credentials (wrong password or not found)
        userMessage = "Invalid email or password. Please check and try again.";
      } else if (err.code === "auth/invalid-password") {
        // Firebase: Invalid password provided (deprecated, but kept for compatibility)
        userMessage = "Incorrect password. Please try again.";
      } else if (err.code === "auth/too-many-requests") {
        userMessage = "Too many login attempts. Try again later.";
      } else if (err.code === "auth/operation-not-allowed") {
        userMessage = "Email/password authentication is not enabled.";
      } else if (err.code === "auth/account-exists-with-different-credential") {
        userMessage = "This account exists with different sign-in credentials.";
      } else {
        userMessage = err.message || "Authentication failed";
      }

      setError(userMessage);
      setLoading(false);
    }
  };

  /* Complete signup after email confirmation */
  const handleConfirmEmailAndSignup = async () => {
    try {
      setLoading(true);
      setShowEmailConfirmation(false);
      setError(null);

      // Mark that we're awaiting email verification (prevents navigation)
      setVerificationOrigin("signup");

      // Create new account with email/password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        pendingSignupEmail,
        pendingSignupPassword
      );

      // Persist verification pending state so app restart doesn't bypass it
      await setAwaitingEmailVerification(true, userCredential.user.uid);

      // Send verification email
      try {
        await sendVerificationEmail(userCredential.user);
        console.log("✅ Verification email sent to:", pendingSignupEmail);

        // Show verification prompt
        setVerificationUser(userCredential.user);
        console.log("🔐 Showing EmailVerificationPrompt for:", pendingSignupEmail);
        setVerificationOrigin("signup");
        setShowEmailVerification(true);
        setError(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (verificationError: any) {
        console.warn(
          "Verification email send failed:",
          verificationError
        );
        // Still show verification prompt even if email send fails
        // User can resend from the prompt
        setVerificationUser(userCredential.user);
        console.log("🔐 Showing EmailVerificationPrompt (resend will be available)");
        setVerificationOrigin("signup");
        setShowEmailVerification(true);
        setError("Verification email may not have been sent. Click Resend.");
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Signup error:", err);

      let userMessage = "Signup failed";

      if (err.code === "auth/email-already-in-use") {
        try {
          const existingCredential = await signInWithEmailAndPassword(
            auth,
            pendingSignupEmail,
            pendingSignupPassword,
          );
          await existingCredential.user.reload();

          if (!existingCredential.user.emailVerified) {
            await setAwaitingEmailVerification(true, existingCredential.user.uid);
            await sendVerificationEmail(existingCredential.user);
            setVerificationUser(existingCredential.user);
            setVerificationOrigin("signup");
            setShowEmailVerification(true);
            setError("This account already exists and still needs email verification.");
            return;
          }

          setAwaitingEmailVerification(false);
          setError("This account already existed, so you have been signed in.");
          return;
        } catch (existingAccountError: any) {
          userMessage = existingAccountError.code === "auth/wrong-password"
            ? "This email is already registered. Sign in with the correct password."
            : "This email is already registered. Try logging in instead.";
          setIsSignup(false);
          setShowEmailConfirmation(false);
        }
      } else if (err.code === "auth/invalid-email") {
        userMessage = "Invalid email address. Please check and try again.";
      } else if (err.code === "auth/weak-password") {
        userMessage =
          "Password too weak. Use at least 8 characters with uppercase, lowercase, and numbers.";
      } else if (err.message) {
        userMessage = err.message;
      }

      setError(userMessage);
      if (err.code !== "auth/email-already-in-use") {
        setShowEmailConfirmation(true);
      }
      setAwaitingEmailVerification(false); // Reset flag if signup failed
    } finally {
      setLoading(false);
    }
  };

  /* GOOGLE SIGN-IN */
  const handleGoogleSignIn = async () => {
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

      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (!idToken) {
          setError("Google Sign-In failed — no token received. Please try again.");
          setLoading(false);
          return;
        }
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err.code === "auth/account-exists-with-different-credential") {
        setError("An account already exists with the same email but different sign-in credentials.");
      } else {
        console.error("Google Sign-In error:", err);
        setError("Google Sign-In failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading overlay while authenticating or if user exists (about to navigate)
  // Keep LoginScreen visible while awaiting email verification
  if ((user || authLoading) && !awaitingEmailVerification) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}
        accessibilityLabel="Signing in"
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const passwordRuleError = isSignup && password ? validatePasswordStrength(password).errors[0] : undefined;
  const passwordHelper = isSignup
    ? passwordRuleError ?? (password ? "Password meets the requirements." : PASSWORD_RULES)
    : undefined;
  const subtle = withAlpha(colors.textSecondary, alpha.muted);
  const busy = loading || pendingAction !== null;
  const onSignIn = () => runOnce("email", handleAuth);
  const onGoogle = () => runOnce("google", handleGoogleSignIn);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.screen }}
          bottomOffset={size.keyboardClearance}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable
            onPress={Keyboard.dismiss}
            accessible={false}
            style={{ flex: 1, justifyContent: "center", paddingVertical: spacing.xl }}
          >
          <Animated.View style={modeStyle}>
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
              <View
                style={{
                  width: size.logoTile,
                  height: size.logoTile,
                  borderRadius: radius.xl,
                  backgroundColor: colors.raised,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={APP_LOGO}
                  style={{ width: size.logoTile, height: size.logoTile }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
              <Text
                accessibilityRole="header"
                accessibilityLabel="Iron Arc"
                style={[
                  typography.headlineLg,
                  {
                    color: colors.text,
                    textTransform: "uppercase",
                    letterSpacing: tracking.wordmark,
                    marginTop: spacing.lg,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                Iron Arc
              </Text>
              <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center", maxWidth: size.textNarrow }]}>
                {isSignup
                  ? "Begin your training log.\nCreate your account."
                  : "Welcome back.\nSign in to your training log."}
              </Text>
            </View>

            {/* Form */}
            <View style={{ gap: spacing.form }}>
              <TextField
                onBlur={handleEmailBlur}
                label="Email"
                labelHint="Required"
                value={email}
                onChangeText={handleEmailChange}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={emailValidationError}
                helperText={emailValidationWarning ?? undefined}
                reserveMessageSpace
              />

              <View style={{ gap: spacing.sm }}>
                <TextField
                  ref={passwordRef}
                  label="Password"
                  variant="password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  placeholder={isSignup ? "Create a password" : "••••••••••••"}
                  autoComplete={isSignup ? "new-password" : "password"}
                  textContentType={isSignup ? "newPassword" : "password"}
                  returnKeyType="go"
                  onSubmitEditing={onSignIn}
                  helperText={passwordHelper}
                />
                {/* Fixed-height row: the sign-in error fades in on the left without moving anything. */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
                  <FadingMessage message={error} color={colors.danger} reserveLines={2} live style={{ flex: 1 }} />
                {!isSignup && (
                  <PressableScale
                    onPress={() => setShowForgotPassword(true)}
                    hitSlop={{ top: (touchTarget - size.linkMin) / 2, bottom: (touchTarget - size.linkMin) / 2 }}
                    accessibilityRole="button"
                    accessibilityLabel="Forgot password"
                    style={{ minHeight: size.linkMin, justifyContent: "center" }}
                  >
                    {({ pressed }) => (
                      <Text style={[typography.labelMd, { color: pressed ? colors.text : colors.textSecondary }]}>
                        Forgot password?
                      </Text>
                    )}
                  </PressableScale>
                )}
                </View>
              </View>

              <View style={{ marginTop: spacing.sm }}>
                <Button
                  title={isSignup ? "Create account" : "Sign in"}
                  uppercase
                  haptic
                  onPress={onSignIn}
                  loading={loading && pendingAction !== "google"}
                  disabled={busy}
                  fullWidth
                />
              </View>

              {googleAvailable ? (
                <View style={{ gap: spacing.form }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg, marginVertical: spacing.sm }}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                  >
                    <View style={{ flex: 1, height: size.divider, backgroundColor: colors.surfaceContainerHigh }} />
                    <Text
                      style={[
                        typography.labelSm,
                        {
                          color: withAlpha(colors.textSecondary, alpha.divider),
                          textTransform: "uppercase",
                          letterSpacing: tracking.overline,
                        },
                      ]}
                    >
                      or
                    </Text>
                    <View style={{ flex: 1, height: size.divider, backgroundColor: colors.surfaceContainerHigh }} />
                  </View>
                  <Button
                    title="Continue with Google"
                    variant="tonal"
                    leading={<GoogleLogo />}
                    haptic
                    onPress={onGoogle}
                    loading={loading && pendingAction === "google"}
                    disabled={busy}
                    fullWidth
                  />
                </View>
              ) : (
                <Text style={[typography.labelSm, { color: colors.textSecondary, textAlign: "center" }]}>
                  Google sign-in isn&apos;t available in this preview.
                </Text>
              )}
            </View>

            {/* Mode switch */}
            <View
              style={{
                marginTop: spacing.xxl,
                minHeight: touchTarget,
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: spacing.inline,
              }}
            >
              <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
                {isSignup ? "Already have an account?" : "Don't have an account?"}
              </Text>
              <PressableScale
                onPress={() => switchMode(!isSignup)}
                accessibilityRole="button"
                accessibilityLabel={isSignup ? "Sign in instead" : "Create account"}
                disabled={busy}
                style={{ minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.xs }}
              >
                {({ pressed }) => (
                  <Text style={[typography.bodyMdMedium, { color: pressed ? colors.accentPressed : colors.accent }]}>
                    {isSignup ? "Sign in" : "Create account"}
                  </Text>
                )}
              </PressableScale>
            </View>
          </Animated.View>
          </Pressable>

          {/* Footer */}
          <Text
            style={[
              typography.labelSm,
              { color: subtle, textAlign: "center", paddingBottom: spacing.md },
            ]}
          >
            Designed & built by Pushpanath · {getVersionLabel()}
          </Text>
        </KeyboardAwareScrollView>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        visible={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />

      {/* Email Confirmation Modal (Typo Prevention) */}
      <EmailConfirmationModal
        visible={showEmailConfirmation}
        email={pendingSignupEmail}
        onConfirm={handleConfirmEmailAndSignup}
        onEdit={() => {
          setShowEmailConfirmation(false);
        }}
        onCancel={() => {
          setShowEmailConfirmation(false);
          setPendingSignupEmail("");
          setPendingSignupPassword("");
          setError(null);
        }}
      />

      {/* Email Verification Prompt */}
      <EmailVerificationPrompt
        visible={showEmailVerification}
        user={verificationUser}
        dismissible={false}
        onSkip={() => {
          // New users must verify before continuing
          setError("Please verify your email to continue.");
        }}
        onVerified={async () => {
          setShowEmailVerification(false);
          setVerificationUser(null);
          if (verificationOrigin === "signup") {
            setAwaitingEmailVerification(false);
            await retryBootstrap();
          } else {
            setAwaitingEmailVerification(false);
          }
          setVerificationOrigin(null);
        }}
        onResendSuccess={() => {
          setError(null);
        }}
        onSignOut={handleUseDifferentAccount}
      />
    </View>
  );
}

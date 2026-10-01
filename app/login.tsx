import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { 
  FadeInDown, 
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAuth } from "../auth/AuthContext";
import { auth } from "../firebase/config";
import { useTheme } from "../theme/theme";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal";
import { EmailVerificationPrompt } from "../components/EmailVerificationPrompt";
import { EmailConfirmationModal } from "../components/EmailConfirmationModal";
import { sendVerificationEmail } from "../utils/verificationService";
import { userApi } from "../services/api";
import {
  validateEmail,
  validatePasswordStrength,
  sanitizeEmail,
  getEmailValidationMessage,
} from "../utils/emailPasswordValidation";

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID =
  "89046456850-s6069mv6aljj1cs3knio49fmtt6b4v6e.apps.googleusercontent.com";
const WEB_CLIENT_ID =
  "89046456850-3sfgpbt5fg60uv1735p3lnedo5pvq8sd.apps.googleusercontent.com";

// For native Android builds the redirect URI must be the reverse-client-id scheme.
// In Expo Go (development) the proxy URL is used automatically by expo-auth-session.
const ANDROID_REDIRECT_URI = makeRedirectUri({
  scheme: "com.googleusercontent.apps.89046456850-s6069mv6aljj1cs3knio49fmtt6b4v6e",
  path: "oauth2redirect/google",
});

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const {
    user,
    loading: authLoading,
    setAwaitingEmailVerification,
    awaitingEmailVerification,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [pendingSignupEmail, setPendingSignupEmail] = useState("");
  const [pendingSignupPassword, setPendingSignupPassword] = useState("");
  const [verificationUser, setVerificationUser] = useState<any>(null);
  const [verificationOrigin, setVerificationOrigin] = useState<
    "signup" | "signin" | null
  >(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [emailValidationWarning, setEmailValidationWarning] = useState<
    string | null
  >(null);
  const [emailValidationError, setEmailValidationError] = useState<
    string | null
  >(null);

  // Animation for password visibility eye icon
  const eyeProgress = useSharedValue(0);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    redirectUri: ANDROID_REDIRECT_URI,
    prompt: "select_account",
  });

  // Animated style for eye icon rotation
  const eyeAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotateZ: `${interpolate(eyeProgress.value, [0, 1], [0, 15])}deg`,
      },
    ],
  }));

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
    eyeProgress.value = withSpring(showPassword ? 0 : 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  /* Handle email input - show validation feedback */
  const handleEmailChange = (text: string) => {
    setEmail(text);
    
    // Show email validation feedback if they enter something
    if (text.length > 5) {
      const validation = validateEmail(text);
      
      // Check for hard errors (block signup)
      if (!validation.isValid) {
        setEmailValidationError(validation.errors[0]);
        setEmailValidationWarning(null);
      } else {
        setEmailValidationError(null);
        // Check for warnings/suspicious patterns (allow but warn)
        if (validation.warnings.length > 0) {
          setEmailValidationWarning(validation.warnings[0]);
        } else {
          setEmailValidationWarning(null);
        }
      }
    } else {
      setEmailValidationError(null);
      setEmailValidationWarning(null);
    }
  };

  /* Handle password input - show strength feedback */
  const handlePasswordChange = (text: string) => {
    setPassword(text);
    
    // Update password strength for signup mode
    if (isSignup && text.length > 0) {
      const strength = validatePasswordStrength(text);
      setPasswordStrength(strength.score);
    } else {
      setPasswordStrength(0);
    }
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
        userMessage = "This email is already registered. Try logging in instead.";
      } else if (err.code === "auth/invalid-email") {
        userMessage = "Invalid email address. Please check and try again.";
      } else if (err.code === "auth/weak-password") {
        userMessage =
          "Password too weak. Use at least 8 characters with uppercase, lowercase, and numbers.";
      } else if (err.message) {
        userMessage = err.message;
      }

      setError(userMessage);
      setShowEmailConfirmation(true); // Show confirmation modal again
      setAwaitingEmailVerification(false); // Reset flag if signup failed
    } finally {
      setLoading(false);
    }
  };

  /* GOOGLE SIGN-IN */
  useEffect(() => {
    if (!response) return;

    if (response.type === "error") {
      const msg = response.error?.message ?? "Unknown OAuth error";
      console.error("Google OAuth error:", response.error);
      // Common cause: redirect URI not registered in Google Cloud Console
      setError(`Google Sign-In error: ${msg}`);
      return;
    }

    if (response.type === "cancel") return;

    if (response.type === "success") {
      const idToken = response.authentication?.idToken;

      if (!idToken) {
        console.warn("Google Sign-In failed: no idToken in response", response);
        setError("Google Sign-In failed — no token received. Please try again.");
        return;
      }

      setLoading(true);
      const credential = GoogleAuthProvider.credential(idToken);

      signInWithCredential(auth, credential)
        .then(async () => {
          // Check if this is a brand-new Google user (no display name on backend yet)
          try {
            const profile = await userApi.getProfile();
            if (!profile.displayName) {
              router.replace("/onboarding");
            }
            // Returning user: auth guard handles routing to (tabs)
          } catch {
            // Profile fetch failed — auth guard will handle routing
          }
        })
        .catch((err) => {
          console.error("Google Sign-In credential error:", err);
          setError("Google Sign-In failed. Please try again.");
          setLoading(false);
        });
    }
  }, [response]);

  // Show loading overlay while authenticating or if user exists (about to navigate)
  // Keep LoginScreen visible while awaiting email verification
  if ((user || authLoading) && !awaitingEmailVerification) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: colors.background,
          padding: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* MAIN CONTENT CONTAINER */}
        <View style={{ flex: 1 }}>
          {/* LOGO / BRAND */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(500)}
            style={{ alignItems: "center", marginBottom: spacing.xl }}
          >
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: radius.full,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.md,
                backgroundColor: "#000",
                overflow: "hidden",
                ...shadows.lg,
              }}
            >
              <Image
                source={require("../assets/images/icon.png")}
                style={{ width: 100, height: 100 }}
                resizeMode="contain"
              />
            </View>
            <Text style={{ ...typography.h1, color: colors.textPrimary }}>
              Iron Arc
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Forge your strength
            </Text>
          </Animated.View>

          {/* HEADER */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Text
              style={{
                ...typography.h2,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}
            >
              {isSignup ? "Create Account" : "Welcome Back"}
            </Text>

            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                marginBottom: spacing.lg,
              }}
            >
              {isSignup
                ? "Sign up to start tracking your workouts"
                : "Log in to continue your fitness journey"}
            </Text>
          </Animated.View>

          {/* FORM */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            {/* Email */}
            <View style={{ marginBottom: spacing.sm }}>
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textSecondary,
                  marginBottom: spacing.xs,
                }}
              >
                Email
              </Text>
              <TextInput
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={handleEmailChange}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: emailValidationError || emailValidationWarning ? 2 : 1,
                  borderColor:
                    emailValidationError
                      ? colors.error
                      : emailValidationWarning
                        ? colors.warning || "#FFA500"
                        : colors.cardBorder,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  fontSize: typography.body.fontSize,
                }}
              />
              {emailValidationError && (
                <View
                  style={{
                    marginTop: spacing.xs,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                  }}
                >
                  <Ionicons
                    name="alert-circle"
                    size={14}
                    color={colors.error}
                  />
                  <Text
                    style={{
                      color: colors.error,
                      fontSize: 12,
                      flex: 1,
                    }}
                  >
                    {emailValidationError}
                  </Text>
                </View>
              )}
              {emailValidationWarning && !emailValidationError && (
                <View
                  style={{
                    marginTop: spacing.xs,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                  }}
                >
                  <Ionicons
                    name="warning"
                    size={14}
                    color={colors.warning || "#FFA500"}
                  />
                  <Text
                    style={{
                      color: colors.warning || "#FFA500",
                      fontSize: 12,
                      flex: 1,
                    }}
                  >
                    {emailValidationWarning}
                  </Text>
                </View>
              )}
            </View>

            {/* Password with Visibility Toggle */}
            <View style={{ marginBottom: spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: spacing.xs,
                }}
              >
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                  }}
                >
                  Password
                </Text>
                {isSignup && password.length > 0 && (
                  <Text
                    style={{
                      ...typography.caption,
                      color:
                        passwordStrength < 50
                          ? colors.error
                          : passwordStrength < 75
                            ? colors.warning
                            : colors.success,
                      fontWeight: "600",
                    }}
                  >
                    {passwordStrength < 25
                      ? "Weak"
                      : passwordStrength < 50
                        ? "Fair"
                        : passwordStrength < 75
                          ? "Good"
                          : "Strong"}{" "}
                    ({Math.round(passwordStrength)}%)
                  </Text>
                )}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: radius.lg,
                  paddingRight: spacing.xs,
                }}
              >
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={handlePasswordChange}
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    color: colors.textPrimary,
                    fontSize: typography.body.fontSize,
                  }}
                />
                <Pressable
                  onPress={togglePasswordVisibility}
                  style={{
                    padding: spacing.sm,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Animated.View style={eyeAnimStyle}>
                    <Ionicons
                      name={showPassword ? "eye" : "eye-off"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Animated.View>
                </Pressable>
              </View>

              {/* Password Requirements (Signup Mode) */}
              {isSignup && password.length > 0 && (
                <View
                  style={{
                    marginTop: spacing.sm,
                    padding: spacing.md,
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: radius.lg,
                    borderLeftWidth: 3,
                    borderLeftColor:
                      passwordStrength < 50 ? colors.error : colors.accent,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.textSecondary,
                      marginBottom: spacing.xs,
                      fontWeight: "600",
                    }}
                  >
                    Password Requirements:
                  </Text>
                  {validatePasswordStrength(password).errors.length > 0 && (
                    <View style={{ gap: spacing.xs }}>
                      {validatePasswordStrength(password).errors.map(
                        (error, idx) => (
                          <View
                            key={idx}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.xs,
                            }}
                          >
                            <Ionicons
                              name="close-circle"
                              size={14}
                              color={colors.error}
                            />
                            <Text
                              style={{
                                color: colors.error,
                                fontSize: 11,
                                flex: 1,
                              }}
                            >
                              {error}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  )}
                  {validatePasswordStrength(password).suggestions.length > 0 && (
                    <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                      {validatePasswordStrength(password).suggestions.map(
                        (suggestion, idx) => (
                          <View
                            key={idx}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.xs,
                            }}
                          >
                            <Ionicons
                              name="bulb"
                              size={14}
                              color={colors.accent}
                            />
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 11,
                                flex: 1,
                              }}
                            >
                              {suggestion}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Forgot Password Link (only show in login mode) */}
            {!isSignup && (
              <Pressable
                onPress={() => setShowForgotPassword(true)}
                style={{ marginBottom: spacing.md, alignItems: "flex-end" }}
              >
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 13,
                    fontWeight: "500",
                  }}
                >
                  Forgot password?
                </Text>
              </Pressable>
            )}

            {/* Error */}
            {error && (
              <View
                style={{
                  backgroundColor: colors.errorLight,
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  marginBottom: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={colors.error}
                  style={{ marginRight: spacing.xs }}
                />
                <Text style={{ color: colors.error, flex: 1, fontSize: 14 }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Login / Signup Button */}
            <Pressable
              onPress={handleAuth}
              disabled={loading}
              style={{
                backgroundColor: colors.accent,
                padding: spacing.md,
                borderRadius: radius.xl,
                alignItems: "center",
                marginBottom: spacing.md,
                opacity: loading ? 0.6 : 1,
                ...shadows.md,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>
                  {isSignup ? "Sign Up" : "Login"}
                </Text>
              )}
            </Pressable>

            {/* Divider */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              <View
                style={{ flex: 1, height: 1, backgroundColor: colors.divider }}
              />
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textMuted,
                  marginHorizontal: spacing.md,
                }}
              >
                or
              </Text>
              <View
                style={{ flex: 1, height: 1, backgroundColor: colors.divider }}
              />
            </View>

            {/* Google Sign-In */}
            <Pressable
              disabled={!request || loading}
              onPress={() => promptAsync()}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                padding: spacing.md,
                borderRadius: radius.xl,
                alignItems: "center",
                marginBottom: spacing.lg,
                flexDirection: "row",
                justifyContent: "center",
                opacity: !request || loading ? 0.6 : 1,
              }}
            >
              <Ionicons
                name="logo-google"
                size={20}
                color={colors.textPrimary}
                style={{ marginRight: spacing.sm }}
              />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                Continue with Google
              </Text>
            </Pressable>

            {/* Toggle - Sign Up / Login Prompt */}
            <Pressable onPress={() => setIsSignup(!isSignup)}>
              <Text
                style={{
                  ...typography.body,
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginBottom: spacing.md,
                }}
              >
                {isSignup ? "Already have an account? " : "New here? "}
                <Text style={{ color: colors.accent, fontWeight: "600" }}>
                  {isSignup ? "Login" : "Create an account"}
                </Text>
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* SPACING FLEX - Pushes footer to bottom */}
        <View style={{ flex: 1 }} />

        {/* FOOTER SECTION */}
        <Animated.View
          entering={FadeInUp.delay(600).duration(400)}
          style={{
            alignItems: "center",
            paddingTop: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            marginTop: spacing.xl,
            marginHorizontal: -spacing.lg,
            marginBottom: -spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          }}
        >
          <Text
            style={{
              ...typography.caption,
              color: colors.textMuted,
              textAlign: "center",
              marginBottom: spacing.xs,
            }}
          >
            Designed & Built by Pushpanath
          </Text>
          <Text
            style={{
              ...typography.caption,
              color: colors.textMuted,
              opacity: 0.6,
            }}
          >
            Version {Constants.expoConfig?.version || "1.1.1"}
          </Text>
        </Animated.View>
      </ScrollView>

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
          // Focus returns to email input
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
        onVerified={() => {
          setShowEmailVerification(false);
          setVerificationUser(null);
          if (verificationOrigin === "signup") {
            userApi
              .getProfile()
              .then((profile) => {
                const hasCompletedOnboarding = Boolean(
                  profile.displayName && profile.fitnessGoal,
                );

                if (hasCompletedOnboarding) {
                  setAwaitingEmailVerification(false);
                  router.replace("/(tabs)");
                } else {
                  router.replace("/onboarding");
                }
              })
              .catch((error) => {
                console.warn(
                  "Could not inspect profile after verification:",
                  error,
                );
                router.replace("/onboarding");
              });
          } else {
            setAwaitingEmailVerification(false);
          }
          setVerificationOrigin(null);
        }}
        onResendSuccess={() => {
          // Email resent successfully
          setError(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}









import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ForgotPasswordLink, ModeSwitch, OrDivider } from "../components/auth/AuthLinks";
import { EmailConfirmationModal } from "../components/auth/EmailConfirmationModal";
import { EmailVerificationPrompt } from "../components/auth/EmailVerificationPrompt";
import { ForgotPasswordModal } from "../components/auth/ForgotPasswordModal";
import { LoginHeader } from "../components/auth/LoginHeader";
import { Button, FadingMessage, GoogleLogo, TextField } from "../components/ui";
import { Reveal } from "../components/ui/Reveal";
import { useEmailAuth } from "../hooks/useEmailAuth";
import { useLoginForm } from "../hooks/useLoginForm";
import { useAuth } from "../providers/AuthContext";
import { isGoogleSignInAvailable } from "../services/googleSignin";
import { useTheme } from "../theme/theme";
import { alpha, motion, size, spacing, typography, withAlpha } from "../theme/tokens";
import { getVersionLabel } from "../utils/appVersion";

/** Sign in, or create an account (a mode of this screen). */
export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, awaitingEmailVerification } = useAuth();
  const googleAvailable = isGoogleSignInAvailable();
  const passwordRef = useRef<TextInput>(null);
  const [isSignup, setIsSignup] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Typing clears the sign-in error, which lives in useEmailAuth (created after the form it reads).
  const clearErrorRef = useRef(() => {});
  const form = useLoginForm(isSignup, () => clearErrorRef.current());
  const authFlow = useEmailAuth(form, isSignup, () => setIsSignup(false));
  clearErrorRef.current = authFlow.clearError;

  // Sign in <-> Create account: fade out, swap, fade in.
  const modeOpacity = useSharedValue(1);
  const modeStyle = useAnimatedStyle(() => ({ opacity: modeOpacity.value }));
  const { clearError } = authFlow;
  const { setEmailError } = form;
  const applyMode = useCallback(
    (toSignup: boolean) => {
      setIsSignup(toSignup);
      clearError();
      setEmailError(null);
      modeOpacity.value = withTiming(1, { duration: motion.modeMs / 2 });
    },
    [modeOpacity, clearError, setEmailError],
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

  // Signed in (about to navigate): a spinner, unless the email still needs verifying.
  if ((user || authLoading) && !awaitingEmailVerification) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }} accessibilityLabel="Signing in">
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const { busy, loading, pendingAction } = authFlow;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.screen }}
        bottomOffset={size.keyboardClearance}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ flex: 1, justifyContent: "center", paddingVertical: spacing.xl }}>
          <Animated.View style={modeStyle}>
            <Reveal index={0}>
              <LoginHeader isSignup={isSignup} />
            </Reveal>

            <Reveal index={1}>
              <View style={{ gap: spacing.form }}>
                <TextField
                  onBlur={form.blurEmail}
                  label="Email"
                  labelHint="Required"
                  value={form.email}
                  onChangeText={form.changeEmail}
                  placeholder="you@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  error={form.emailError}
                  helperText={form.emailWarning ?? undefined}
                  reserveMessageSpace
                />

                <View style={{ gap: spacing.sm }}>
                  <TextField
                    ref={passwordRef}
                    label="Password"
                    variant="password"
                    value={form.password}
                    onChangeText={form.changePassword}
                    placeholder={isSignup ? "Create a password" : "••••••••••••"}
                    autoComplete={isSignup ? "new-password" : "password"}
                    textContentType={isSignup ? "newPassword" : "password"}
                    returnKeyType="go"
                    onSubmitEditing={authFlow.submitEmail}
                  />
                  {/* One fixed two-line row in both modes, so switching never moves the form: an error,
                      else (creating an account) the password rules, with "Forgot password?" when signing in. */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
                    <FadingMessage
                      message={authFlow.error ?? form.passwordHelper ?? null}
                      color={authFlow.error ? colors.danger : colors.textSecondary}
                      reserveLines={2}
                      live
                      style={{ flex: 1 }}
                    />
                    {!isSignup && <ForgotPasswordLink onPress={() => setForgotOpen(true)} />}
                  </View>
                </View>

                <View style={{ marginTop: spacing.sm }}>
                  <Button
                    title={isSignup ? "Create account" : "Sign in"}
                    uppercase
                    haptic
                    onPress={authFlow.submitEmail}
                    loading={loading && pendingAction !== "google"}
                    disabled={busy}
                    fullWidth
                  />
                </View>

                {googleAvailable ? (
                  <View style={{ gap: spacing.form }}>
                    <OrDivider />
                    <Button
                      title="Continue with Google"
                      variant="tonal"
                      leading={<GoogleLogo />}
                      haptic
                      onPress={authFlow.signInWithGoogle}
                      loading={loading && pendingAction === "google"}
                      disabled={busy}
                      fullWidth
                    />
                  </View>
                ) : (
                  <Text style={[typography.labelSm, { color: colors.textSecondary, textAlign: "center" }]}>Google sign-in isn&apos;t available in this preview.</Text>
                )}
              </View>
            </Reveal>

            <Reveal index={2}>
              <ModeSwitch isSignup={isSignup} disabled={busy} onSwitch={() => switchMode(!isSignup)} />
            </Reveal>
          </Animated.View>
        </Pressable>

        <Text style={[typography.labelSm, { color: withAlpha(colors.textSecondary, alpha.muted), textAlign: "center", paddingBottom: spacing.md }]}>
          Designed & built by Pushpanath · {getVersionLabel()}
        </Text>
      </KeyboardAwareScrollView>

      <ForgotPasswordModal visible={forgotOpen} onClose={() => setForgotOpen(false)} initialEmail={form.email} />

      {/* "Is this your email?" before an account is created (typo check). */}
      <EmailConfirmationModal
        visible={authFlow.confirmation.open}
        email={authFlow.confirmation.email}
        onConfirm={authFlow.confirmation.confirm}
        onEdit={authFlow.confirmation.edit}
        onCancel={authFlow.confirmation.cancel}
      />

      <EmailVerificationPrompt
        visible={authFlow.verification.open}
        user={authFlow.verification.user}
        dismissible={false}
        onSkip={authFlow.verification.skip}
        onVerified={authFlow.verification.verified}
        onResendSuccess={authFlow.verification.resent}
        onSignOut={authFlow.verification.useDifferentAccount}
      />
    </View>
  );
}

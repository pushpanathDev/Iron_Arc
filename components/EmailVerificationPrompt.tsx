/**
 * Full-screen email verification: resend (with cooldown), change email,
 * "I've verified", and an optional sign-out.
 */

import { Ionicons } from "@expo/vector-icons";
import { User, verifyBeforeUpdateEmail } from "firebase/auth";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";
import { radius, spacing, touchTarget, typography, semibold } from "../theme/tokens";
import { Button, Card, TextField } from "./ui";
import * as Haptics from "expo-haptics";
import { verificationMessages } from "../constants/verificationMessages";
import {
  canResendVerificationEmail,
  sendVerificationEmail,
  syncVerificationStatus,
  updateVerificationMeta,
} from "../utils/verificationService";

interface EmailVerificationPromptProps {
  visible: boolean;
  user: User | null;
  onSkip: () => void;
  onResendSuccess?: () => void;
  onVerified?: () => void;
  dismissible?: boolean;
  /** Shows a "Use a different account" action that signs out. */
  onSignOut?: () => void | Promise<void>;
}

export function EmailVerificationPrompt({
  visible,
  user,
  onSkip,
  onResendSuccess,
  onVerified,
  dismissible = true,
  onSignOut,
}: EmailVerificationPromptProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [cooldownTotal, setCooldownTotal] = useState(60);
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const [lastResendTime, setLastResendTime] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const verificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const verificationDelayIndexRef = useRef(0);

  // Remember the starting length of each cooldown so the progress bar can scale.
  const previousCooldown = useRef(0);
  useEffect(() => {
    if (resendCooldown > previousCooldown.current) setCooldownTotal(resendCooldown);
    previousCooldown.current = resendCooldown;
  }, [resendCooldown]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setTimeout(() => {
      setResendCooldown(resendCooldown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-check verification status while prompt is visible
  useEffect(() => {
    const delays = [5000, 10000, 20000, 30000];

    if (!visible || !user) {
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
        verificationTimeoutRef.current = null;
      }
      verificationDelayIndexRef.current = 0;
      return;
    }

    verificationDelayIndexRef.current = 0;

    const clearVerificationTimer = () => {
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
        verificationTimeoutRef.current = null;
      }
    };

    const scheduleNextCheck = () => {
      clearVerificationTimer();

      verificationTimeoutRef.current = setTimeout(async () => {
        try {
          const synced = await syncVerificationStatus(user);
          if (synced || user.emailVerified) {
            clearVerificationTimer();
            onVerified?.();
            return;
          }
        } catch {
          // Silent - network hiccup or transient auth error
        }

        verificationDelayIndexRef.current = Math.min(
          verificationDelayIndexRef.current + 1,
          delays.length - 1,
        );
        scheduleNextCheck();
      }, delays[verificationDelayIndexRef.current]);
    };

    scheduleNextCheck();

    return () => {
      clearVerificationTimer();
    };
  }, [visible, user, onVerified]);

  const handleResendEmail = async () => {
    if (!user) return;

    const now = Date.now();
    const timeSinceLastResend = now - lastResendTime;

    // Client-side cooldown (60s)
    if (timeSinceLastResend < 60 * 1000) {
      const secondsRemaining = Math.ceil(
        (60 * 1000 - timeSinceLastResend) / 1000,
      );
      setResendCooldown(secondsRemaining);
      setError(verificationMessages.resendCooldown);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Firestore-side cooldown (2 minutes)
    const resendCheck = await canResendVerificationEmail(user.uid);
    if (!resendCheck.allowed) {
      setResendCooldown(resendCheck.waitSeconds);
      setError(verificationMessages.resendRecent);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResent(false);

      await sendVerificationEmail(user);

      setLastResendTime(now);
      setResendCooldown(60);
      setResent(true);
      console.log("✅ Verification email resent to:", user.email);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onResendSuccess?.();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Resend verification error:", err);
      let message = verificationMessages.resendFailed;

      if (err.code === "auth/too-many-requests") {
        message = verificationMessages.resendRecent;
        setResendCooldown(120);
        setLastResendTime(now);
      } else if (err.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!user) {
      setError("User not authenticated");
      return;
    }

    if (!newEmail.trim()) {
      setError("Please enter a new email address");
      return;
    }

    if (newEmail.trim() === user.email) {
      setError("New email must be different from current email");
      return;
    }

    try {
      setChangeEmailLoading(true);
      setError(null);

      // Send verification link to the new email before updating
      await verifyBeforeUpdateEmail(user, newEmail.trim());
      await updateVerificationMeta(user.uid, {
        isEmailVerified: false,
        verificationSentAt: Date.now(),
      });

      setLastResendTime(Date.now());
      setResendCooldown(60);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Email Updated",
        verificationMessages.changeEmailSuccess,
        [
          {
            text: "OK",
            onPress: () => {
              setShowChangeEmail(false);
              setNewEmail(user?.email || "");
            },
          },
        ]
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Failed to change email:", err);

      let userMessage = "Failed to change email. Please try again.";
      if (err.code === "auth/email-already-in-use") {
        userMessage = verificationMessages.changeEmailInUse;
      } else if (err.code === "auth/invalid-email") {
        userMessage = verificationMessages.changeEmailInvalid;
      } else if (err.code === "auth/operation-not-allowed") {
        userMessage = verificationMessages.verifyExpired;
      } else if (err.code === "auth/requires-recent-login") {
        userMessage = verificationMessages.changeEmailRequiresRecentLogin;
      } else if (err.message) {
        userMessage = err.message;
      }

      setError(userMessage);
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const handleIHaveVerified = async () => {
    if (!user) return;
    try {
      setCheckingVerification(true);
      setError(null);
      const synced = await syncVerificationStatus(user);
      if (synced || user.emailVerified) {
        onVerified?.();
      } else {
        setError(verificationMessages.verifyExpired);
      }
        } catch {
      setError(verificationMessages.verifyCheckFailed);
    } finally {
      setCheckingVerification(false);
    }
  };

  if (!user) return null;

  const coolingDown = resendCooldown > 0;
  const mm = String(Math.floor(resendCooldown / 60)).padStart(2, "0");
  const ss = String(resendCooldown % 60).padStart(2, "0");

  const handleSignOut = async () => {
    if (!onSignOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismissible ? onSkip : () => {}}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.lg,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {dismissible ? (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ alignSelf: "flex-end", width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={{ height: spacing.xl }} />
          )}

          {/* Header */}
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.xl,
                backgroundColor: colors.raised,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons name="mail-unread-outline" size={30} color={colors.accent} />
            </View>
            <Text accessibilityRole="header" style={[typography.headlineLg, { color: colors.text, textAlign: "center" }]}>
              Check your inbox
            </Text>
            <Text style={[typography.bodyLg, { color: colors.textSecondary, textAlign: "center", maxWidth: 340 }]}>
              We sent a verification link to{" "}
              <Text style={{ color: colors.text, ...semibold }}>{user.email}</Text>. Tap the link in the email to
              verify your account.
            </Text>
          </View>

          {resent && (
            <View
              accessibilityLiveRegion="polite"
              style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.accentSubtle }}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              <Text style={[typography.bodyMd, { color: colors.text, flex: 1 }]}>
                Verification email sent. Check your inbox.
              </Text>
            </View>
          )}

          {error && (
            <View
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.dangerSubtle,
                borderWidth: 1,
                borderColor: colors.danger,
              }}
            >
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={[typography.bodyMd, { color: colors.text, flex: 1 }]}>{error}</Text>
            </View>
          )}

          {/* Resend */}
          <Card style={{ gap: spacing.md }}>
            {coolingDown && (
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons name="timer-outline" size={18} color={colors.textSecondary} />
                  <Text style={[typography.bodyMd, { color: colors.textSecondary, flex: 1 }]}>
                    You can resend soon
                  </Text>
                  <Text
                    style={[typography.bodyLg, { color: colors.accent, ...semibold, fontVariant: ["tabular-nums"] }]}
                    accessibilityLabel={`${resendCooldown} seconds`}
                  >
                    {mm}:{ss}
                  </Text>
                </View>
                <View
                  style={{ height: 4, borderRadius: radius.full, backgroundColor: colors.border, overflow: "hidden" }}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View
                    style={{
                      height: 4,
                      width: `${Math.min(100, (resendCooldown / Math.max(cooldownTotal, 1)) * 100)}%`,
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
              </View>
            )}
            <Button
              title={loading ? "Sending…" : coolingDown ? `Resend email in ${resendCooldown}s` : "Resend email"}
              icon="refresh"
              variant="secondary"
              onPress={handleResendEmail}
              loading={loading}
              disabled={loading || coolingDown}
              fullWidth
            />
          </Card>

          <Button
            title="I've verified"
            icon="checkmark-circle-outline"
            onPress={handleIHaveVerified}
            loading={checkingVerification}
            disabled={loading || checkingVerification}
            fullWidth
          />

          <Button
            title={showChangeEmail ? "Cancel email change" : "Use a different email address"}
            variant="secondary"
            onPress={() => {
              setShowChangeEmail(!showChangeEmail);
              setError(null);
            }}
            disabled={loading}
            fullWidth
          />

          {showChangeEmail && (
            <Card style={{ gap: spacing.md }}>
              <TextField
                label="New email address"
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={handleChangeEmail}
                editable={!changeEmailLoading}
                helperText="We'll send a new verification link to this address."
              />
              <Button
                title={changeEmailLoading ? "Updating…" : "Send link to new email"}
                icon="send-outline"
                onPress={handleChangeEmail}
                loading={changeEmailLoading}
                disabled={changeEmailLoading}
                fullWidth
              />
            </Card>
          )}

          {onSignOut && (
            <Button
              title="Use a different account"
              variant="ghost"
              icon="log-out-outline"
              onPress={handleSignOut}
              loading={signingOut}
              disabled={signingOut}
              style={{ alignSelf: "center" }}
            />
          )}

          {/* Help */}
          <Card style={{ flexDirection: "row", gap: spacing.md }}>
            <Ionicons name="help-circle-outline" size={22} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMd, { color: colors.text, ...semibold }]}>
                Didn&apos;t get the email?
              </Text>
              <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
                Check your spam or junk folder, or resend it above.
              </Text>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Email Verification Prompt Component (V1.2.0)
 * =============================================
 * Post-signup email verification with change email support.
 * Features:
 * - Rate-limited resend (5-minute cooldown)
 * - Change email functionality (for typos)
 * - Beautiful UI with animations
 * - Comprehensive error handling
 */

import { Ionicons } from "@expo/vector-icons";
import { User, verifyBeforeUpdateEmail } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useTheme } from "../theme/theme";
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
}

export function EmailVerificationPrompt({
  visible,
  user,
  onSkip,
  onResendSuccess,
  onVerified,
  dismissible = true,
}: EmailVerificationPromptProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const [lastResendTime, setLastResendTime] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [checkingVerification, setCheckingVerification] = useState(false);

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
    if (!visible || !user) return;

    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const synced = await syncVerificationStatus(user);
        if (mounted && (synced || user.emailVerified)) {
          onVerified?.();
        }
      } catch (reloadError) {
        // Silent - network hiccup or transient auth error
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
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
    } catch (reloadError: any) {
      setError(verificationMessages.verifyCheckFailed);
    } finally {
      setCheckingVerification(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissible ? onSkip : undefined}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "flex-end",
        }}
      >
        {dismissible && (
          <Pressable
            style={{ flex: 1 }}
            onPress={onSkip}
            hitSlop={10}
          />
        )}

        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            padding: spacing.lg,
            paddingBottom: spacing.lg,
          }}
        >
          {/* ICON */}
          <View
            style={{
              alignItems: "center",
              marginBottom: spacing.lg,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.full,
                backgroundColor: colors.accentLight,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              <Ionicons
                name="mail-outline"
                size={32}
                color={colors.accent}
              />
            </View>
          </View>

          {/* TITLE */}
          <Text
            style={{
              ...typography.h2,
              color: colors.textPrimary,
              marginBottom: spacing.xs,
              textAlign: "center",
            }}
          >
            Verify Your Email
          </Text>

          {/* DESCRIPTION */}
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              marginBottom: spacing.lg,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            We've sent a verification link to{"\n"}
            <Text style={{ fontWeight: "600", color: colors.accent }}>
              {user.email}
            </Text>
          </Text>

          {/* RESENT MESSAGE */}
          {resent && (
            <View
              style={{
                backgroundColor: colors.success + "20",
                borderLeftWidth: 3,
                borderLeftColor: colors.success,
                padding: spacing.md,
                borderRadius: radius.lg,
                marginBottom: spacing.lg,
              }}
            >
              <Text
                style={{
                  color: colors.success,
                  fontWeight: "500",
                  fontSize: 13,
                }}
              >
                ✓ Verification email sent! Check your inbox.
              </Text>
            </View>
          )}

          {/* ERROR MESSAGE */}
          {error && (
            <View
              style={{
                backgroundColor: colors.error + "15",
                borderLeftWidth: 3,
                borderLeftColor: colors.error,
                padding: spacing.md,
                borderRadius: radius.lg,
                marginBottom: spacing.lg,
              }}
            >
              <Text
                style={{
                  color: colors.error,
                  fontWeight: "500",
                  fontSize: 13,
                }}
              >
                {error}
              </Text>
            </View>
          )}

          {/* NEXT STEPS */}
          <View
            style={{
              backgroundColor: colors.surfaceElevated,
              padding: spacing.md,
              borderRadius: radius.lg,
              marginBottom: spacing.lg,
              borderLeftWidth: 3,
              borderLeftColor: colors.accentLight,
            }}
          >
            <Text
              style={{
                ...typography.caption,
                color: colors.textMuted,
                marginBottom: spacing.xs,
                fontWeight: "600",
              }}
            >
              NEXT STEPS
            </Text>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                1. Check your email inbox
              </Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                2. Click the verification link
              </Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                3. Come back to the app
              </Text>
            </View>
          </View>

          {/* SPINE */}
          <Text
            style={{
              ...typography.caption,
              color: colors.textMuted,
              marginBottom: spacing.lg,
              textAlign: "center",
            }}
          >
            Didn't receive the email? Check your spam folder.
          </Text>

          {/* BUTTONS */}
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <Pressable
              onPress={handleResendEmail}
              disabled={loading || resendCooldown > 0}
              style={{
                backgroundColor:
                  resendCooldown > 0 ? colors.surfaceElevated : colors.accent,
                padding: spacing.md,
                borderRadius: radius.lg,
                alignItems: "center",
                opacity: loading || resendCooldown > 0 ? 0.6 : 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: spacing.xs,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name="refresh"
                  size={18}
                  color={resendCooldown > 0 ? colors.textSecondary : "#fff"}
                />
              )}
              <Text
                style={{
                  color: resendCooldown > 0 ? colors.textSecondary : "#fff",
                  fontWeight: "600",
                }}
              >
                {loading
                  ? "Sending..."
                  : resendCooldown > 0
                  ? `Wait ${resendCooldown}s`
                  : "Resend Verification Email"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowChangeEmail(!showChangeEmail);
                setError(null);
              }}
              disabled={loading}
              style={{
                padding: spacing.md,
                borderRadius: radius.lg,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.accent,
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 14 }}>
                {showChangeEmail ? "Cancel" : "Wrong Email? Change It"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleIHaveVerified}
              disabled={loading || checkingVerification}
              style={{
                padding: spacing.md,
                borderRadius: radius.lg,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.cardBorder,
                opacity: loading || checkingVerification ? 0.6 : 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: spacing.xs,
              }}
            >
              {checkingVerification && (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              )}
              <Text style={{ color: colors.textPrimary, fontWeight: "500" }}>
                I've Verified My Email
              </Text>
            </Pressable>
          </View>

          {/* CHANGE EMAIL FORM */}
          {showChangeEmail && (
            <Animated.View
              entering={FadeInDown.delay(200)}
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textMuted,
                  marginBottom: spacing.sm,
                  fontWeight: "600",
                }}
              >
                NEW EMAIL ADDRESS
              </Text>
              <TextInput
                placeholder="your.new.email@example.com"
                placeholderTextColor={colors.textMuted}
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!changeEmailLoading}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 14,
                  marginBottom: spacing.md,
                }}
              />
              <Pressable
                onPress={handleChangeEmail}
                disabled={changeEmailLoading}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                  opacity: changeEmailLoading ? 0.7 : 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: spacing.xs,
                }}
              >
                {changeEmailLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {changeEmailLoading ? "Updating..." : "Update Email"}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* INFO */}
          <Text
            style={{
              ...typography.caption,
              color: colors.textMuted,
              marginTop: spacing.lg,
              textAlign: "center",
            }}
          >
            Email verification helps protect your account
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

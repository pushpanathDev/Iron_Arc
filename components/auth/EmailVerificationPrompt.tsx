/**
 * Full-screen email verification: resend (one persisted cooldown per email),
 * change email, "I've verified", and an optional sign-out.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { User, verifyBeforeUpdateEmail } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { verificationMessages } from "../../data/verificationMessages";
import { auth } from "../../services/firebase";
import { useTheme } from "../../theme/theme";
import { radius, semibold, size, spacing, touchTarget, typography } from "../../theme/tokens";
import {
  extendResendCooldown,
  getResendAvailableAt,
  logVerificationError,
  NoSignedInUserError,
  recordVerificationSend,
  sendVerificationEmail,
  syncVerificationStatus,
} from "../../services/emailVerification";
import { Button, Card, TextField } from "../ui";

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

type Notice = { tone: "info" | "success" | "error"; text: string } | null;

const formatWait = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

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
  const [signingOut, setSigningOut] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  // Epoch ms when Resend unlocks; derived from storage so it survives remounts and restarts.
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const verificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verificationDelayIndexRef = useRef(0);

  const email = user?.email ?? "";

  const refreshCooldown = useCallback(async () => {
    if (!email) return;
    setResendAvailableAt(await getResendAvailableAt(email));
    setNow(Date.now());
  }, [email]);

  // Load the persisted cooldown whenever the screen opens; never show an error on entry.
  useEffect(() => {
    if (!visible) return;
    setNotice(null);
    void refreshCooldown();
  }, [visible, refreshCooldown]);

  const remaining = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

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

        verificationDelayIndexRef.current = Math.min(verificationDelayIndexRef.current + 1, delays.length - 1);
        scheduleNextCheck();
      }, delays[verificationDelayIndexRef.current]);
    };

    scheduleNextCheck();

    return () => {
      clearVerificationTimer();
    };
  }, [visible, user, onVerified]);

  const handleResendEmail = async () => {
    if (!user || sending || remaining > 0) return;

    if (!auth.currentUser) {
      setNotice({ tone: "error", text: "You've been signed out. Sign in again to resend the email." });
      return;
    }

    try {
      setSending(true);
      setNotice(null);
      await sendVerificationEmail(user);
      setNotice({ tone: "success", text: `Sent again to ${email}. Check spam too.` });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onResendSuccess?.();
    } catch (err: any) {
      if (err instanceof NoSignedInUserError) {
        setNotice({ tone: "error", text: "You've been signed out. Sign in again to resend the email." });
      } else if (err?.code === "auth/too-many-requests") {
        await extendResendCooldown(email);
        setNotice({ tone: "info", text: "Too many requests. Try again in a few minutes." });
      } else {
        setNotice({ tone: "error", text: verificationMessages.resendFailed });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      await refreshCooldown();
      setSending(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!user) {
      setNotice({ tone: "error", text: "You've been signed out. Sign in again to change your email." });
      return;
    }

    if (!newEmail.trim()) {
      setNotice({ tone: "error", text: "Please enter a new email address" });
      return;
    }

    if (newEmail.trim() === user.email) {
      setNotice({ tone: "error", text: "New email must be different from current email" });
      return;
    }

    try {
      setChangeEmailLoading(true);
      setNotice(null);

      // Send verification link to the new email before updating
      await verifyBeforeUpdateEmail(user, newEmail.trim());
      await recordVerificationSend(newEmail.trim());

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Email Updated", verificationMessages.changeEmailSuccess, [
        {
          text: "OK",
          onPress: () => {
            setShowChangeEmail(false);
            setNewEmail(user?.email || "");
          },
        },
      ]);
    } catch (err: any) {
      logVerificationError("change email", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let userMessage = "Failed to change email. Please try again.";
      if (err.code === "auth/email-already-in-use") {
        userMessage = verificationMessages.changeEmailInUse;
      } else if (err.code === "auth/invalid-email") {
        userMessage = verificationMessages.changeEmailInvalid;
      } else if (err.code === "auth/operation-not-allowed") {
        userMessage = verificationMessages.verifyExpired;
      } else if (err.code === "auth/requires-recent-login") {
        userMessage = verificationMessages.changeEmailRequiresRecentLogin;
      } else if (err.code === "auth/too-many-requests") {
        userMessage = "Too many requests. Try again in a few minutes.";
      }

      setNotice({ tone: "error", text: userMessage });
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const handleIHaveVerified = async () => {
    if (!user) return;
    try {
      setCheckingVerification(true);
      setNotice(null);
      await user.reload();
      if (user.emailVerified) {
        await syncVerificationStatus(user);
        onVerified?.();
      } else {
        setNotice({ tone: "info", text: "Not verified yet. Open the link in the email first." });
      }
    } catch (err) {
      logVerificationError("verify check", err);
      setNotice({ tone: "error", text: verificationMessages.verifyCheckFailed });
    } finally {
      setCheckingVerification(false);
    }
  };

  if (!user) return null;

  const handleSignOut = async () => {
    if (!onSignOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const noticeColor =
    notice?.tone === "error" ? colors.danger : notice?.tone === "success" ? colors.accent : colors.textSecondary;
  const noticeIcon =
    notice?.tone === "error" ? "alert-circle-outline" : notice?.tone === "success" ? "checkmark-circle-outline" : "time-outline";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismissible ? onSkip : () => {}}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <KeyboardAwareScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.screen,
            paddingVertical: spacing.xl,
            gap: spacing.lg,
          }}
          bottomOffset={size.keyboardClearance}
          keyboardShouldPersistTaps="handled"
        >
          {dismissible && (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ alignSelf: "flex-end", width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={size.icon} color={colors.textSecondary} />
            </Pressable>
          )}

          {/* Header */}
          <View style={{ alignItems: "center", gap: spacing.md, marginBottom: spacing.lg }}>
            <View
              style={{
                width: size.logoTile,
                height: size.logoTile,
                borderRadius: radius.xl,
                backgroundColor: colors.raised,
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons name="mail-unread-outline" size={size.logoMark} color={colors.accent} />
            </View>
            <Text accessibilityRole="header" style={[typography.headlineLg, { color: colors.text, textAlign: "center" }]}>
              Check your inbox
            </Text>
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center", maxWidth: size.textNarrow }]}>
              We sent a verification link to{"\n"}
              <Text style={{ color: colors.text, ...semibold }}>{email}</Text>
              {"\n"}Tap the link in the email to verify your account.
            </Text>
          </View>

          <Button
            title="I've verified"
            uppercase
            haptic
            onPress={handleIHaveVerified}
            loading={checkingVerification}
            disabled={sending || checkingVerification}
            fullWidth
          />

          <View style={{ gap: spacing.sm }}>
            <Button
              title={remaining > 0 ? `Resend in ${formatWait(remaining)}` : "Resend email"}
              icon="refresh"
              variant="tonal"
              onPress={handleResendEmail}
              loading={sending}
              disabled={sending || remaining > 0}
              accessibilityLabel={remaining > 0 ? `Resend available in ${remaining} seconds` : "Resend email"}
              fullWidth
            />
            {notice && (
              <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <Ionicons name={noticeIcon} size={16} color={noticeColor} style={{ marginTop: 2 }} />
                <Text style={[typography.bodyMd, { color: notice.tone === "error" ? colors.danger : colors.textSecondary, flex: 1 }]}>
                  {notice.text}
                </Text>
              </View>
            )}
          </View>

          <Button
            title={showChangeEmail ? "Cancel email change" : "Use a different email address"}
            variant="tonal"
            onPress={() => {
              setShowChangeEmail(!showChangeEmail);
              setNotice(null);
            }}
            disabled={sending}
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
                title="Send link to new email"
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
            <Ionicons name="help-circle-outline" size={size.icon} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMdMedium, { color: colors.text }]}>Didn&apos;t get the email?</Text>
              <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
                Check your spam or junk folder, or resend it above.
              </Text>
            </View>
          </Card>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useTheme } from "../theme/theme";
import { auth } from "../firebase/config";
import * as Haptics from "expo-haptics";

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({
  visible,
  onClose,
}: ForgotPasswordModalProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSendReset = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await sendPasswordResetEmail(auth, email.trim());

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      console.log("✅ Password reset email sent to:", email);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Password reset error:", err);

      // Translate Firebase errors to user-friendly messages
      let userMessage = "Failed to send reset email";
      if (err.code === "auth/user-not-found") {
        userMessage = "No account found with this email";
      } else if (err.code === "auth/invalid-email") {
        userMessage = "Invalid email address";
      } else if (err.code === "auth/too-many-requests") {
        userMessage = "Too many requests. Try again later";
      } else {
        userMessage = err.message || "Failed to send reset email";
      }

      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={handleClose}
            hitSlop={10}
          />

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
            {/* HEADER */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.lg,
              }}
            >
              <Text style={{ ...typography.h2, color: colors.textPrimary }}>
                {success ? "Check Your Email" : "Reset Password"}
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.lg,
                  backgroundColor: colors.surfaceElevated,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            {success ? (
              <View>
                {/* SUCCESS STATE */}
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
                      backgroundColor: colors.success + "20",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: spacing.md,
                    }}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={40}
                      color={colors.success}
                    />
                  </View>
                </View>

                <Text
                  style={{
                    ...typography.body,
                    color: colors.textPrimary,
                    marginBottom: spacing.md,
                    textAlign: "center",
                  }}
                >
                  We've sent a password reset link to:
                </Text>

                <View
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    marginBottom: spacing.lg,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                  }}
                >
                  <Text
                    style={{
                      color: colors.accent,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    {email}
                  </Text>
                </View>

                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                    marginBottom: spacing.lg,
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  Click the link in the email to create a new password. If you
                  don't see it, check your spam folder.
                </Text>

                <Pressable
                  onPress={handleClose}
                  style={{
                    backgroundColor: colors.accent,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.onAccent,
                      fontWeight: "600",
                      fontSize: typography.body.fontSize,
                    }}
                  >
                    Got It
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {/* FORM STATE */}
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textSecondary,
                    marginBottom: spacing.lg,
                  }}
                >
                  Enter your email address and we'll send you a link to reset
                  your password.
                </Text>

                {/* EMAIL INPUT */}
                <View style={{ marginBottom: spacing.md }}>
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
                    onChangeText={(text) => {
                      setEmail(text);
                      setError(null);
                    }}
                    editable={!loading}
                    style={{
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 1,
                      borderColor:
                        error && !email ? colors.error : colors.cardBorder,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      color: colors.textPrimary,
                      fontSize: typography.body.fontSize,
                    }}
                  />
                </View>

                {/* ERROR MESSAGE */}
                {error && (
                  <View
                    style={{
                      backgroundColor: colors.error + "15",
                      borderLeftWidth: 3,
                      borderLeftColor: colors.error,
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      marginBottom: spacing.md,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.error,
                        fontSize: 12,
                        fontWeight: "500",
                      }}
                    >
                      {error}
                    </Text>
                  </View>
                )}

                {/* BUTTONS */}
                <View style={{ gap: spacing.md }}>
                  <Pressable
                    onPress={handleSendReset}
                    disabled={loading || !email.trim()}
                    style={{
                      backgroundColor: colors.accent,
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      alignItems: "center",
                      opacity: loading || !email.trim() ? 0.6 : 1,
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: spacing.xs,
                    }}
                  >
                    {loading && (
                      <ActivityIndicator color={colors.onAccent} size="small" />
                    )}
                    <Text
                      style={{
                        color: colors.onAccent,
                        fontWeight: "600",
                        fontSize: typography.body.fontSize,
                      }}
                    >
                      {loading ? "Sending..." : "Send Reset Link"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleClose}
                    disabled={loading}
                    style={{
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: "500" }}>
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

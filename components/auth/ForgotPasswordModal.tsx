import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { sendPasswordResetEmail } from "firebase/auth";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { auth } from "../../services/firebase";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { isValidEmailFormat } from "../../utils/emailPasswordValidation";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/TextField";

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  /** The email already typed on the sign-in form. */
  initialEmail?: string;
}

/** Friendly words for Firebase reset errors (never reveals whether an account exists). */
function resetErrorMessage(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Couldn't connect. Check your internet and try again.";
    default:
      return "Couldn't send the reset email. Please try again.";
  }
}

/** Password reset: email → link sent. Same sheet, field and buttons as the rest of the app. */
export function ForgotPasswordModal({ visible, onClose, initialEmail = "" }: ForgotPasswordModalProps) {
  const { colors } = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Fresh each time it opens, starting from the sign-in form's email.
  useEffect(() => {
    if (!visible) return;
    setEmail(initialEmail.trim());
    setError(null);
    setSentTo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const send = async () => {
    const value = email.trim();
    if (!isValidEmailFormat(value)) {
      setError("Enter the email you signed up with.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, value);
      setSentTo(value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // An unknown account still reads as "sent": the reset form never tells anyone which emails have accounts.
      if (code === "auth/user-not-found") {
        setSentTo(value);
      } else {
        setError(resetErrorMessage(code));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={loading ? undefined : onClose}
      title={sentTo ? "Check your email" : "Reset password"}
      subtitle={sentTo ? undefined : "Enter your email and we'll send you a link to set a new password."}
    >
      {sentTo ? (
        <>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View style={{ width: size.iconBadge, height: size.iconBadge, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSubtle }}>
              <MaterialIcons name="mark-email-read" size={size.iconLg + spacing.sm} color={colors.accent} />
            </View>
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>If an account exists for</Text>
            <View style={{ alignSelf: "stretch", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
              <Text style={[typography.bodyMdMedium, { color: colors.accent, textAlign: "center" }]} numberOfLines={1}>
                {sentTo}
              </Text>
            </View>
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>
              a reset link is on its way. Open it to choose a new password. Not there in a few minutes? Check your spam folder.
            </Text>
          </View>
          <Button title="Got it" onPress={onClose} fullWidth />
        </>
      ) : (
        <>
          <TextField
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError(null);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={() => void send()}
            editable={!loading}
            error={error}
            autoFocus={!initialEmail}
          />
          <View style={{ gap: spacing.sm }}>
            <Button title={loading ? "Sending…" : "Send reset link"} icon="mail-outline" onPress={() => void send()} loading={loading} disabled={loading || !email.trim()} fullWidth />
            <Button title="Cancel" variant="neutral" onPress={onClose} disabled={loading} fullWidth />
          </View>
        </>
      )}
    </Sheet>
  );
}

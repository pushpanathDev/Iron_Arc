/**
 * Confirms the address before sign-up so a typo (e.g. gmial.com) doesn't
 * create an account nobody can verify.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { Button } from "../ui";

interface EmailConfirmationModalProps {
  visible: boolean;
  email: string;
  onConfirm: () => void; // Proceed with signup
  onEdit: () => void; // Go back to edit email
  onCancel: () => void; // Cancel signup
}

const EMAIL_MIN_SCALE = 0.75;

export function EmailConfirmationModal({ visible, email, onConfirm, onEdit, onCancel }: EmailConfirmationModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.scrim,
          justifyContent: "center",
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.screen,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: size.dialogMax,
            alignSelf: "center",
            backgroundColor: colors.card,
            borderRadius: radius.xl,
            padding: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <View style={{ alignItems: "center", gap: spacing.md }}>
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
              <Ionicons name="mail-outline" size={size.logoMark} color={colors.accent} />
            </View>
            <Text accessibilityRole="header" style={[typography.headlineLg, { color: colors.text, textAlign: "center" }]}>
              Confirm your email
            </Text>
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center" }]}>
              Make sure this is correct. We&apos;ll send a verification link to it.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.raised,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              gap: spacing.xs,
            }}
          >
            <Text style={[typography.labelMd, { color: colors.textSecondary }]}>Email address</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={EMAIL_MIN_SCALE}
              style={[typography.bodyLg, { color: colors.text, fontFamily: typography.bodyMdMedium.fontFamily }]}
            >
              {email}
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <Button
              title="Correct – continue"
              icon="checkmark"
              uppercase
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onConfirm();
              }}
              fullWidth
            />
            <Button title="Edit email" variant="tonal" haptic onPress={onEdit} fullWidth />
            <Button title="Cancel" variant="ghost" onPress={onCancel} style={{ alignSelf: "center" }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

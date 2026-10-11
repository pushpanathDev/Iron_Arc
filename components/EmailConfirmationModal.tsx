/**
 * Email Confirmation Modal (V1.2.0)
 * ================================
 * Typo Prevention Layer - Shows email confirmation BEFORE signup
 * 
 * Prevents users from creating accounts with typos like:
 * - test@gmial.com (missing 'a')
 * - test@gmil.com (missing second 'a')
 * - test@gmai.com (missing 'l')
 * 
 * Provides [Correct] and [Edit] buttons to verify or correct.
 */

import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useTheme } from "../theme/theme";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface EmailConfirmationModalProps {
  visible: boolean;
  email: string;
  onConfirm: () => void; // Proceed with signup
  onEdit: () => void; // Go back to edit email
  onCancel: () => void; // Cancel signup
}

export function EmailConfirmationModal({
  visible,
  email,
  onConfirm,
  onEdit,
  onCancel,
}: EmailConfirmationModalProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background + "CC",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.lg,
            maxWidth: "90%",
            ...shadows.lg,
          }}
        >
          {/* Icon */}
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={{
              alignItems: "center",
              marginBottom: spacing.lg,
            }}
          >
            <View
              style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                backgroundColor: colors.accentLight || colors.accent + "20",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              <Ionicons
                name="mail-outline"
                size={36}
                color={colors.accent}
              />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInUp.delay(200)}>
            <Text
              style={[
                typography.h2,
                {
                  color: colors.textPrimary,
                  marginBottom: spacing.sm,
                  textAlign: "center",
                },
              ]}
            >
              Confirm Your Email
            </Text>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInUp.delay(300)}>
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  marginBottom: spacing.lg,
                  textAlign: "center",
                  lineHeight: 22,
                },
              ]}
            >
              Make sure this email is correct. We'll send a verification link to this address.
            </Text>
          </Animated.View>

          {/* Email Display */}
          <Animated.View
            entering={FadeInUp.delay(400)}
            style={{
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.lg,
              borderWidth: 2,
              borderColor: colors.accent,
              padding: spacing.md,
              marginBottom: spacing.lg,
              alignItems: "center",
            }}
          >
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textMuted,
                  marginBottom: spacing.xs,
                },
              ]}
            >
              Email Address
            </Text>
            <Text
              style={[
                typography.body,
                {
                  color: colors.accent,
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "600",
                },
              ]}
            >
              {email}
            </Text>
          </Animated.View>

          {/* Buttons */}
          <Animated.View
            entering={FadeInUp.delay(500)}
            style={{
              gap: spacing.md,
            }}
          >
            {/* Confirm Button */}
            <Pressable
              onPress={handleConfirm}
              style={{
                backgroundColor: colors.accent,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
              }}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                Correct - Continue
              </Text>
            </Pressable>

            {/* Edit Button */}
            <Pressable
              onPress={handleEdit}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: colors.accent,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                Edit Email
              </Text>
            </Pressable>

            {/* Cancel Button */}
            <Pressable
              onPress={handleCancel}
              style={{
                paddingVertical: spacing.md,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: "500",
                  fontSize: 14,
                }}
              >
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

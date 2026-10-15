import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { Button } from "./Button";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Destructive (red) confirm button and icon. */
  destructive?: boolean;
  icon?: ComponentProps<typeof MaterialIcons>["name"];
  busy?: boolean;
};

/**
 * Centred confirmation dialog (Delete_Workout_Toast mockup): icon, title,
 * plain-language consequence, confirm and Cancel stacked for one-handed use.
 * Tapping outside or Back cancels. Native fade only (no Reanimated entering),
 * so both buttons take taps across their whole area.
 */
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, destructive, icon = "delete-forever", busy }: ConfirmDialogProps) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={busy ? () => {} : onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: spacing.xl }}
        onPress={busy ? undefined : onCancel}
        accessibilityLabel="Cancel"
      >
        {/* Inner Pressable swallows taps so the card itself doesn't cancel. */}
        <Pressable
          onPress={() => {}}
          accessibilityViewIsModal
          style={{ alignSelf: "center", width: "100%", maxWidth: size.dialogMax, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.card, gap: spacing.lg }}
        >
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                width: size.rowIcon,
                height: size.rowIcon,
                borderRadius: radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: destructive ? colors.dangerSubtle : colors.surfaceContainerHigh,
              }}
            >
              <MaterialIcons name={icon} size={size.iconLg} color={destructive ? colors.danger : colors.accent} />
            </View>
            <Text style={[typography.headlineMd, { color: colors.text }]} accessibilityRole="header">
              {title}
            </Text>
            <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{message}</Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Button
              title={confirmLabel}
              icon={destructive ? "trash-outline" : undefined}
              variant={destructive ? "dangerTonal" : "primary"}
              onPress={onConfirm}
              loading={busy}
              disabled={busy}
              fullWidth
              haptic
            />
            <Button title="Cancel" variant="neutral" onPress={onCancel} disabled={busy} fullWidth />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";
import { motion, radius, spacing, typography } from "../../theme/tokens";

/** How far the panel rises as it opens. */
const RISE = 48;

export type SheetProps = {
  visible: boolean;
  /** Back button / scrim tap. Omit to make the sheet require a choice. */
  onClose?: () => void;
  /** Omit for a custom header (e.g. the badge sheet). */
  title?: string;
  subtitle?: string;
  children?: ReactNode;
};

/**
 * Bottom sheet for confirmations, forms and summaries; sits above the gesture
 * bar and rises with the keyboard. Taps reach buttons while the keyboard is
 * open (one tap on Save, not one to dismiss and one to press).
 *
 * Uses the Modal's native fade instead of Reanimated entering animations: on
 * Android (new architecture) views animated in that way could take touches
 * only on part of a button. Every button here is tappable across its box.
 */
export function Sheet({ visible, onClose, title, subtitle, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // The panel rises a little as the scrim fades in. A plain transform (not a
  // Reanimated entering animation), so every button keeps its full tap area.
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(reduceMotion ? 0 : RISE);
  useEffect(() => {
    if (!visible) {
      rise.value = reduceMotion ? 0 : RISE;
      return;
    }
    rise.value = withTiming(0, { duration: motion.revealMs, easing: Easing.out(Easing.cubic) });
  }, [visible, reduceMotion, rise]);
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose ?? (() => {})}>
      <View style={{ flex: 1, backgroundColor: colors.scrim }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" disabled={!onClose} />
          <Animated.View
            accessibilityViewIsModal
            style={[{ backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "90%" }, panel]}
          >
            {/* Grab handle */}
            <View style={{ alignSelf: "center", width: spacing.xxl, height: spacing.xs, marginTop: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHighest }} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.lg }}
            >
              {title ? (
                <View style={{ gap: spacing.xs }}>
                  <Text style={[typography.headlineMd, { color: colors.text }]} accessibilityRole="header">
                    {title}
                  </Text>
                  {subtitle ? <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
                </View>
              ) : null}
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default Sheet;

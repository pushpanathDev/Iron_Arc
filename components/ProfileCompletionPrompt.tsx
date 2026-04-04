/**
 * ProfileCompletionPrompt - Encourage completing profile data
 * ===========================================================
 * Appears when user has missing profile data (weight, age).
 * Shows a prompt with sliders and pickers to collect this info.
 * 
 * Features:
 * - Weight slider (kg)
 * - Age picker (number input)
 * - Dismiss button
 * - "Save & Continue" action
 * - Auto-hide when data is saved
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTheme } from "../theme/theme";

interface ProfileCompletionPromptProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (weight: number | null, age: number | null) => void;
  currentWeight?: number | null;
  currentAge?: number | null;
  isLoading?: boolean;
  allowWeightEdit?: boolean;
}

export function ProfileCompletionPrompt({
  visible,
  onDismiss,
  onSave,
  currentWeight,
  currentAge,
  isLoading = false,
  allowWeightEdit = true,
}: ProfileCompletionPromptProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const [weight, setWeight] = useState(currentWeight?.toString() || "");
  const [age, setAge] = useState(currentAge?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);

    try {
      const weightNum = allowWeightEdit && weight ? parseFloat(weight) : null;
      const ageNum = age ? parseInt(age, 10) : null;

      // Validate ranges
      if (allowWeightEdit && weightNum !== null && (weightNum < 30 || weightNum > 300)) {
        alert("Please enter a weight between 30 and 300 kg");
        return;
      }

      if (ageNum !== null && (ageNum < 13 || ageNum > 120)) {
        alert("Please enter an age between 13 and 120");
        return;
      }

      await onSave(weightNum, ageNum);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error saving profile:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = allowWeightEdit ? weight || age : !!age;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: "rgba(0,0,0,0.5)" },
        ]}
      >
        <Animated.View entering={FadeIn.duration(300)} style={styles.centerContainer}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                ...shadows.lg,
              },
            ]}
          >
            {/* Close Button */}
            <Pressable
              onPress={onDismiss}
              style={styles.closeButton}
            >
              <Ionicons
                name="close"
                size={24}
                color={colors.textMuted}
              />
            </Pressable>

            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
              <View
                style={[
                  styles.icon,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={32}
                  color={colors.accent}
                />
              </View>
              <Text
                style={[
                  styles.title,
                  { color: colors.textPrimary },
                ]}
              >
                Complete Your Profile
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Add weight & age for better recommendations
              </Text>
            </View>

            <ScrollView
              style={styles.content}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            >
              {allowWeightEdit && (
                <View style={styles.section}>
                  <Text
                    style={[
                      styles.label,
                      { color: colors.textMuted },
                    ]}
                  >
                    CURRENT WEIGHT (KG)
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <TextInput
                      placeholder="e.g., 75"
                      placeholderTextColor={colors.textMuted}
                      value={weight}
                      onChangeText={setWeight}
                      keyboardType="decimal-pad"
                      maxLength={5}
                      editable={!isLoading && !isSaving}
                      style={[
                        styles.input,
                        { color: colors.textPrimary },
                      ]}
                    />
                    {weight && (
                      <Text
                        style={[
                          styles.suffix,
                          { color: colors.textSecondary },
                        ]}
                      >
                        kg
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.helperText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Used for progress tracking and insights
                  </Text>
                </View>
              )}

              {/* Age Section */}
              <View style={styles.section}>
                <Text
                  style={[
                    styles.label,
                    { color: colors.textMuted },
                  ]}
                >
                  YOUR AGE
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <TextInput
                    placeholder="e.g., 28"
                    placeholderTextColor={colors.textMuted}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={!isLoading && !isSaving}
                    style={[
                      styles.input,
                      { color: colors.textPrimary },
                    ]}
                  />
                  {age && (
                    <Text
                      style={[
                        styles.suffix,
                        { color: colors.textSecondary },
                      ]}
                    >
                      yrs
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.helperText,
                    { color: colors.textMuted },
                  ]}
                >
                  Range: 13 - 120 years
                </Text>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <Pressable
                onPress={onDismiss}
                disabled={isSaving}
                style={[
                  styles.button,
                  styles.dismissButton,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Later
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={!isFormValid || isSaving}
                style={[
                  styles.button,
                  {
                    backgroundColor: isFormValid
                      ? colors.accent
                      : colors.accentDim,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: isFormValid ? "#fff" : colors.textMuted,
                    },
                  ]}
                >
                  {isSaving ? "Saving..." : "Save & Continue"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContainer: {
    width: "85%",
    maxWidth: 400,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 10,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  content: {
    marginVertical: 16,
    maxHeight: 280,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  suffix: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

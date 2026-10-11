/**
 * PlanProfileForm
 * ===============
 * Bottom sheet shown by the AI plan screen when the profile is missing a field
 * that plan generation needs (fitness goal, age, weight). Asks only for the
 * missing fields, pre-fills from cached data where available, and calls
 * onComplete once the profile has been saved.
 */

import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUpdateProfile } from "../hooks/useProfile";
import { useUnitPreference } from "../hooks/useUnitPreference";
import type { BodyWeight, User } from "../services/api";
import { useTheme } from "../theme/theme";
import { displayWeight, toKg, weightLabel } from "../utils/unitConversion";

const FITNESS_GOALS = [
  { id: "strength", label: "Strength", emoji: "🏋️" },
  { id: "muscle", label: "Muscle Gain", emoji: "💪" },
  { id: "endurance", label: "Endurance", emoji: "🏃" },
  { id: "weight-loss", label: "Weight Loss", emoji: "⚖️" },
  { id: "general", label: "General Fitness", emoji: "🎯" },
] as const;

export function getMissingPlanFields(profile: User | null | undefined) {
  return {
    fitnessGoal: !profile?.fitnessGoal,
    age: !profile?.age,
    weight: !profile?.weight,
  };
}

export function isPlanProfileComplete(profile: User | null | undefined) {
  const missing = getMissingPlanFields(profile);
  return !missing.fitnessGoal && !missing.age && !missing.weight;
}

interface PlanProfileFormProps {
  visible: boolean;
  profile: User | null | undefined;
  onClose: () => void;
  onComplete: () => void;
}

export function PlanProfileForm({ visible, profile, onClose, onComplete }: PlanProfileFormProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { unit } = useUnitPreference();
  const updateProfile = useUpdateProfile();

  // Snapshot of what was missing when the sheet opened, so fields don't
  // disappear while the user fills them in.
  const [missing, setMissing] = useState(() => getMissingPlanFields(profile));
  const [fitnessGoal, setFitnessGoal] = useState<string | null>(null);
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMissing(getMissingPlanFields(profile));
    setFitnessGoal(profile?.fitnessGoal ?? null);
    setAge(profile?.age ? String(profile.age) : "");

    const cachedKg =
      profile?.weight ??
      queryClient.getQueryData<BodyWeight>(["weights", "latest"])?.weight ??
      null;
    setWeight(cachedKg ? String(displayWeight(cachedKg, unit)) : "");
    setError(null);
    // Re-seed only when the sheet opens or the profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, profile, unit]);

  const requiredFilled =
    (!missing.fitnessGoal || Boolean(fitnessGoal)) &&
    (!missing.age || Boolean(age.trim())) &&
    (!missing.weight || Boolean(weight.trim()));

  const handleSave = async () => {
    setError(null);
    const updates: { fitnessGoal?: string; age?: number; weight?: number } = {};

    if (missing.fitnessGoal) {
      if (!fitnessGoal) return setError("Please choose a fitness goal.");
      updates.fitnessGoal = fitnessGoal;
    }

    if (missing.age) {
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
        return setError("Please enter an age between 13 and 120.");
      }
      updates.age = ageNum;
    }

    if (missing.weight) {
      const value = parseFloat(weight.replace(",", "."));
      const kg = isNaN(value) ? NaN : toKg(value, unit);
      if (isNaN(kg) || kg < 30 || kg > 300) {
        const [min, max] = unit === "lbs" ? [66, 661] : [30, 300];
        return setError(`Please enter a weight between ${min} and ${max} ${weightLabel(unit)}.`);
      }
      updates.weight = kg;
    }

    try {
      const saved = await updateProfile.mutateAsync(updates);
      if (!isPlanProfileComplete(saved)) {
        setError("Your profile was saved but is still incomplete. Please check your details.");
        return;
      }
      onComplete();
    } catch {
      setError("Couldn't save your profile. Please try again.");
    }
  };

  const inputStyle = {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.textPrimary,
    fontSize: 16,
  } as const;

  const labelStyle = {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />

        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: "90%",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.lg,
              paddingBottom: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.h3, color: colors.textPrimary }}>
                A few details first
              </Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>
                Your plan is tailored to these. You only need to add what&apos;s missing.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={{ padding: spacing.xs }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}
          >
            {missing.fitnessGoal && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={labelStyle}>FITNESS GOAL</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {FITNESS_GOALS.map((goal) => {
                    const selected = fitnessGoal === goal.id;
                    return (
                      <Pressable
                        key={goal.id}
                        onPress={() => setFitnessGoal(goal.id)}
                        style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.full,
                          borderWidth: 1,
                          borderColor: selected ? colors.accent : colors.border,
                          backgroundColor: selected ? colors.accentDim : colors.surfaceElevated,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? colors.accent : colors.textSecondary,
                            fontWeight: selected ? "700" : "500",
                          }}
                        >
                          {goal.emoji} {goal.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {missing.age && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={labelStyle}>AGE</Text>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  placeholder="e.g. 28"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={3}
                  style={inputStyle}
                />
              </View>
            )}

            {missing.weight && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={labelStyle}>CURRENT WEIGHT ({weightLabel(unit).toUpperCase()})</Text>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  placeholder={unit === "lbs" ? "e.g. 165" : "e.g. 75"}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  maxLength={6}
                  style={inputStyle}
                />
              </View>
            )}

            {error && (
              <Text style={{ ...typography.caption, color: colors.error }}>{error}</Text>
            )}
          </ScrollView>

          {/* Sticky footer */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              borderTopWidth: 1,
              borderTopColor: colors.divider,
              backgroundColor: colors.surface,
            }}
          >
            <Pressable
              onPress={handleSave}
              disabled={!requiredFilled || updateProfile.isPending}
              style={{
                backgroundColor: requiredFilled ? colors.accent : colors.accentDim,
                borderRadius: radius.xl,
                paddingVertical: spacing.md,
                alignItems: "center",
                opacity: updateProfile.isPending ? 0.7 : 1,
              }}
            >
              <Text
                style={{
                  color: requiredFilled ? colors.textOnAccent : colors.textMuted,
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                {updateProfile.isPending ? "Saving…" : "Save & Continue"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

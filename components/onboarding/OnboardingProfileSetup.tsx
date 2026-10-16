/**
 * Profile setup, in two short steps (about a minute, mostly taps):
 *   1. About you: name, age, height, weight (optional)
 *   2. Your training: goal, experience, training days, session length,
 *      equipment, and optional fine-tuning (target weight, areas to avoid)
 * Every answer feeds the AI plan or something the app shows; nothing else is
 * asked. Saves through the onComplete callback.
 */

import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef, useState, type ElementRef } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { STEP_FIELDS, useProfileSetupForm, type ProfileSetupResult, type SetupField } from "../../hooks/useProfileSetupForm";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import type { User } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { size, spacing, touchTarget, tracking, typography } from "../../theme/tokens";
import { Button } from "../ui/Button";
import { PressableScale } from "../ui/PressableScale";
import { AboutYouStep } from "./AboutYouStep";
import { StepDots } from "./SetupParts";
import { TrainingStep } from "./TrainingStep";

const STEPS = {
  1: { header: "About you", title: "Set your baseline", intro: "These numbers tune your plans, targets and stats.", back: "Back to intro", action: "Continue" },
  2: { header: "Your training", title: "How you train", intro: "Your AI plan is built from these. Change them anytime in Profile.", back: "Back to about you", action: "Finish setup" },
} as const;

type Props = {
  initialName?: string;
  /** What's already saved, when someone comes back to finish setup. */
  saved?: User | null;
  /** Resolves true when saved; false keeps the user on this screen. */
  onComplete: (result: ProfileSetupResult) => Promise<boolean>;
  onBack: () => void;
};

export function OnboardingProfileSetup({ initialName = "", saved, onComplete, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { unit } = useUnitPreference();
  const form = useProfileSetupForm(initialName, unit, saved);
  const [step, setStep] = useState<1 | 2>(1);
  const [fineTune, setFineTune] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Where each field's card sits, to scroll to the first one with an error.
  const scrollRef = useRef<ElementRef<typeof KeyboardAwareScrollView>>(null);
  const offsets = useRef<Partial<Record<SetupField, number>>>({});
  const track = (field: SetupField, also?: SetupField) => (e: LayoutChangeEvent) => {
    offsets.current[field] = e.nativeEvent.layout.y;
    if (also) offsets.current[also] = e.nativeEvent.layout.y;
  };
  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });

  /** Shows this step's errors and scrolls to the first; true when there were any. */
  const hasErrors = (which: 1 | 2) => {
    const found = form.validate(which);
    form.setErrors(found);
    const first = STEP_FIELDS[which].find((f) => found[f]);
    if (!first) return false;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (first === "target") setFineTune(true);
    scrollRef.current?.scrollTo({ y: Math.max(0, (offsets.current[first] ?? 0) - spacing.lg), animated: true });
    return true;
  };

  const next = () => {
    if (hasErrors(1)) return;
    setStep(2);
    scrollTop();
  };

  const back = () => {
    if (step === 1) return onBack();
    form.setErrors({});
    setStep(1);
    scrollTop();
  };

  const finish = async () => {
    if (savingRef.current || hasErrors(2)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const ok = await onComplete(form.result());
      if (!ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const copy = STEPS[step];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ height: size.appBar, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PressableScale onPress={back} accessibilityRole="button" accessibilityLabel={copy.back} style={{ width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }}>
          {({ pressed }) => <MaterialIcons name="arrow-back" size={size.iconLg} color={pressed ? colors.text : colors.textSecondary} />}
        </PressableScale>
        <Text accessibilityRole="header" style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>
          {copy.header}
        </Text>
        <View style={{ width: touchTarget }} />
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={size.keyboardClearance}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.lg }}
      >
        <View style={{ paddingTop: spacing.sm, gap: spacing.xs }}>
          <StepDots step={step} />
          <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>{copy.title}</Text>
          <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{copy.intro}</Text>
        </View>

        {step === 1 ? <AboutYouStep form={form} track={track} /> : <TrainingStep form={form} track={track} fineTune={fineTune} onToggleFineTune={() => setFineTune((v) => !v)} />}

        {/* Finish: at the natural end of the scroll, never overlapping fields */}
        <View style={{ paddingTop: spacing.sm, gap: spacing.md }}>
          <Button
            title={copy.action}
            trailingIcon="arrow-forward"
            uppercase
            haptic
            onPress={step === 1 ? next : () => void finish()}
            loading={saving}
            disabled={saving}
            fullWidth
            style={{ minHeight: size.ctaTall }}
          />
          <Text style={[typography.labelSm, { color: colors.borderStrong, textAlign: "center" }]}>You can change all of this later in Profile.</Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

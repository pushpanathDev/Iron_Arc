/**
 * Onboarding Flow
 * ===============
 * Multi-step onboarding for new users:
 * 1. Intro - Welcome screen with animated gym illustration
 * 2. Info - Feature highlights
 * 3. Height - Collect user height for personalization
 *
 * Premium UI with consistent theming throughout.
 */

import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { HeightPickerScreen } from "../components/HeightPickerScreen";
import { OnboardingInfo } from "../components/OnboardingInfo";
import { OnboardingIntro } from "../components/OnboardingIntro";
import { updateUserProfile } from "../db/profiles";

type OnboardingStep = "intro" | "info" | "height";

export default function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("intro");

  const handleIntroStart = useCallback(() => {
    setStep("info");
  }, []);

  const handleInfoNext = useCallback(() => {
    setStep("height");
  }, []);

  const handleHeightComplete = useCallback(
    async (heightCm: number) => {
      if (!user) return;

      try {
        // Save height to profile
        await updateUserProfile(user.uid, { height: heightCm });
        console.log("✅ Height saved:", heightCm, "cm");

        // Navigate to main app
        router.replace("/(tabs)");
      } catch (error) {
        console.error("Failed to save height:", error);
        // Still navigate even if save fails
        router.replace("/(tabs)");
      }
    },
    [user, router],
  );

  // Render current step
  switch (step) {
    case "intro":
      return <OnboardingIntro onStart={handleIntroStart} />;
    case "info":
      return <OnboardingInfo onNext={handleInfoNext} />;
    case "height":
      return (
        <HeightPickerScreen
          onComplete={handleHeightComplete}
          showBackButton
          onBack={() => setStep("info")}
        />
      );
    default:
      return <OnboardingIntro onStart={handleIntroStart} />;
  }
}

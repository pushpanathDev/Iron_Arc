/**
 * Onboarding Flow
 * ===============
 * Multi-step onboarding for new users:
 * 1. Intro - Welcome screen with animated gym illustration
 * 2. Info - Feature highlights
 * 3. Profile - Collect name (required), height & goal (optional) for personalization
 *
 * Fast & friction-free onboarding. Users can always complete profile later.
 */

import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { OnboardingProfileSetup } from "../components/OnboardingProfileSetup";
import { OnboardingInfo } from "../components/OnboardingInfo";
import { OnboardingIntro } from "../components/OnboardingIntro";
import { updateUserProfile } from "../db/profiles";

type OnboardingStep = "intro" | "info" | "profile";

export default function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("intro");

  const handleIntroStart = useCallback(() => {
    setStep("info");
  }, []);

  const handleInfoNext = useCallback(() => {
    setStep("profile");
  }, []);

  const handleProfileComplete = useCallback(
    async (
      name: string,
      age: number | null,
      fitnessGoal: "strength" | "muscle" | "endurance" | "weight-loss" | "general",
      heightCm: number | null,
      weightKg: number | null
    ) => {
      if (!user) return;

      try {
        // Save profile data
        const profileData: any = {
          displayName: name,
          age: age,
          fitnessGoal: fitnessGoal,
        };

        if (heightCm !== null) {
          profileData.height = heightCm;
        }

        if (weightKg !== null) {
          profileData.weight = weightKg;
        }

        await updateUserProfile(user.uid, profileData);
        console.log("✅ Profile setup complete:", profileData);

        // Navigate to main app
        router.replace("/(tabs)");
      } catch (error) {
        console.error("Failed to save profile:", error);
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
    case "profile":
      return (
        <OnboardingProfileSetup
          onComplete={handleProfileComplete}
          showBackButton
          onBack={() => setStep("info")}
        />
      );
    default:
      return <OnboardingIntro onStart={handleIntroStart} />;
  }
}

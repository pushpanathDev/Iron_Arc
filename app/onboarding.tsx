/**
 * Onboarding: intro slides (once per account) then profile setup.
 * Shown while the profile has no name or goal (AuthContext "needsOnboarding").
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, View } from "react-native";
import { useAuth } from "../providers/AuthContext";
import { IntroSlides } from "../components/onboarding/IntroSlides";
import { OnboardingProfileSetup, type ProfileSetupResult } from "../components/onboarding/OnboardingProfileSetup";
import { useToast } from "../providers/ToastContext";
import { userApi, weightApi } from "../services/api";
import { useTheme } from "../theme/theme";
import { formatDate, getWeekStart } from "../utils/weekUtils";

type Step = "loading" | "intro" | "profile";

const introSeenKey = (uid: string) => `@onboarding_intro_seen_${uid}`;

export default function OnboardingScreen() {
  const { user, retryBootstrap, setAwaitingEmailVerification } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("loading");

  // Returning users who already saw the intro go straight to profile setup.
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(introSeenKey(user.uid))
      .then((seen) => setStep(seen ? "profile" : "intro"))
      .catch(() => setStep("intro"));
  }, [user]);

  const finishIntro = useCallback(() => {
    if (user) AsyncStorage.setItem(introSeenKey(user.uid), "1").catch(() => {});
    setStep("profile");
  }, [user]);

  // Android back from profile setup returns to the intro.
  useEffect(() => {
    if (step !== "profile") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep("intro");
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const handleProfileComplete = useCallback(
    async ({
      name,
      age,
      fitnessGoal,
      heightCm,
      weightKg,
      weeklyGoal,
      experienceLevel,
      equipment,
      sessionMinutes,
      trainingDays,
      avoidAreas,
      targetWeightKg,
    }: ProfileSetupResult) => {
      if (!user) return false;

      try {
        const profileData: Parameters<typeof userApi.updateProfile>[0] = {
          displayName: name,
          age,
          fitnessGoal,
          height: heightCm,
          weeklyGoal,
          // Training profile: asked once here, used by AI plans, Home and reminders.
          experienceLevel,
          equipment,
          sessionMinutes,
          trainingDays,
          avoidAreas,
        };
        if (targetWeightKg !== null) profileData.targetWeight = targetWeightKg;
        if (weightKg !== null) profileData.weight = weightKg;

        const updatedProfile = await userApi.updateProfile(profileData);
        queryClient.setQueryData(["profile"], updatedProfile);

        // The onboarding weight becomes the first entry in the weight log.
        if (weightKg !== null) {
          const today = new Date();
          try {
            await weightApi.log({ date: formatDate(today), weight: weightKg, weekStart: formatDate(getWeekStart(today)) });
          } catch (error) {
            console.warn("Couldn't log the onboarding weight:", error);
          }
        }

        await queryClient.invalidateQueries({ queryKey: ["profile"] });
        await queryClient.invalidateQueries({ queryKey: ["weights"] });

        setAwaitingEmailVerification(false);
        await retryBootstrap();
        router.replace("/");
        return true;
      } catch (error) {
        console.error("Failed to save profile:", error);
        showToast({
          message: "Couldn't save your profile. Check your connection and try again.",
          type: "warning",
          duration: 5000,
        });
        return false;
      }
    },
    [user, queryClient, retryBootstrap, router, setAwaitingEmailVerification, showToast],
  );

  if (step === "loading") return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  if (step === "intro") return <IntroSlides onDone={finishIntro} />;

  return (
    <OnboardingProfileSetup
      initialName={user?.displayName ?? ""}
      onComplete={handleProfileComplete}
      onBack={() => setStep("intro")}
    />
  );
}

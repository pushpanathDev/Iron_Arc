import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../../auth/AuthContext";
import { auth } from "../../firebase/config";
import { SyncBadge } from "../../components/SyncBadge";
import { ProfileCompletionPrompt } from "../../components/ProfileCompletionPrompt";
import { EmailVerificationPrompt } from "../../components/EmailVerificationPrompt";
import { ProfileStatus } from "../../components/ProfileStatus";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile, useUpdateProfile } from "../../hooks/useProfile";
import { userApi } from "../../services/api";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useLatestWeight } from "../../hooks/useWeights";
import {
  clearEmailVerificationStart,
  getEmailVerificationStart,
  setEmailVerificationStart,
} from "../../db/syncMeta";
import { useTheme } from "../../theme/theme";
import {
  useThemeContext,
  type ThemePreference,
} from "../../context/ThemeContext";
import { formatAccountDate, getAvatarUrl } from "../../utils/avatar";
import { exportToCSV, exportToPDF } from "../../utils/exportData";
import { createPageLogger } from "../../utils/logger";
import { verificationMessages } from "../../constants/verificationMessages";
import { clearVerificationSent } from "../../utils/verificationService";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const log = createPageLogger("Profile");

export default function ProfileScreen() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { preference: themePreference, setPreference: setThemePreference } = useThemeContext();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();
  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch: refetchProfile,
  } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: latestWeightEntry } = useLatestWeight();
  const { unit: weightUnit, setUnit: setWeightUnit } = useUnitPreference();
  const latestWeight = latestWeightEntry?.weight ?? null;
  const isAdmin = profile?.isAdmin ?? false;

  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [fitnessGoal, setFitnessGoal] = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState("1");
  const [hasChanges, setHasChanges] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [profilePromptMode, setProfilePromptMode] = useState<"missing" | "age">("missing");
  const [verificationDaysLeft, setVerificationDaysLeft] = useState<number | null>(null);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [dismissVerificationBanner, setDismissVerificationBanner] = useState(false);
  const [showDeleteReauthentication, setShowDeleteReauthentication] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const verificationGraceDays = 7;

  const clearLocalAccountData = async () => {
    const uid = user?.uid;

    queryClient.cancelQueries();
    queryClient.clear();

    try {
      try { await GoogleSignin.signOut(); } catch {}
      await logout();
    } finally {
      await AsyncStorage.clear();
      if (uid) {
        await Promise.allSettled([
          SecureStore.deleteItemAsync(`evs_${uid}`),
          clearVerificationSent(uid),
        ]);
      }
    }
  };

  const deleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      await userApi.deleteAccount();
      await clearLocalAccountData();
      router.replace("/login");
    } catch (error: any) {
      if (error?.code === "REAUTHENTICATION_REQUIRED") {
        const providerId = user?.providerData[0]?.providerId;
        if (providerId === "google.com") {
          try {
            const response = await GoogleSignin.signIn();
            if (isSuccessResponse(response)) {
              const idToken = response.data.idToken;
              if (idToken && auth.currentUser) {
                await reauthenticateWithCredential(
                  auth.currentUser,
                  GoogleAuthProvider.credential(idToken),
                );
                await deleteAccountRef.current();
                return;
              }
            }
          } catch (reAuthErr: any) {
            setDeleteError(reAuthErr?.message || "Google reauthentication failed.");
          }
        } else {
          setShowDeleteReauthentication(true);
        }
      } else {
        log.error(`Account deletion failed: ${error}`);
        Alert.alert("Could not delete account", error?.message || "Please try again.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const deleteAccountRef = useRef(deleteAccount);
  deleteAccountRef.current = deleteAccount;

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your profile, workouts, plans, weights, and achievements.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: deleteAccount },
      ],
    );
  };

  const handleEmailReauthentication = async () => {
    if (!auth.currentUser?.email || !deletePassword) {
      setDeleteError("Enter your password to continue.");
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        deletePassword,
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      setShowDeleteReauthentication(false);
      setDeletePassword("");
      await deleteAccount();
    } catch (error: any) {
      setDeleteError(error?.message || "Reauthentication failed.");
      setIsDeletingAccount(false);
    }
  };

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setHeight(profile.height ? String(profile.height) : "");
      setAge(profile.age ? String(profile.age) : "");
      setFitnessGoal(profile.fitnessGoal || null);
      setWeeklyGoal(profile.weeklyGoal ? String(profile.weeklyGoal) : "1");
    }
  }, [profile?.id]);

  const loadVerificationStatus = useCallback(async () => {
    if (!user) return;
    try { await user.reload(); } catch {}

    if (user.emailVerified) {
      setVerificationDaysLeft(null);
      setDismissVerificationBanner(false);
      await clearEmailVerificationStart(user.uid);
      return;
    }

    let start = await getEmailVerificationStart(user.uid);
    if (!start) {
      start = Date.now();
      await setEmailVerificationStart(user.uid, start);
    }
    const elapsedDays = Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000));
    setVerificationDaysLeft(Math.max(0, verificationGraceDays - elapsedDays));
  }, [user]);

  useEffect(() => {
    if (!user || user.emailVerified) return;
    if (verificationDaysLeft === 0 && !showVerificationPrompt) {
      setShowVerificationPrompt(true);
    }
  }, [user, verificationDaysLeft, showVerificationPrompt]);

  useFocusEffect(
    useCallback(() => {
      loadVerificationStatus();
    }, [loadVerificationStatus]),
  );

  // Show profile completion if data is missing
  useEffect(() => {
    if (profile && !isLoading) {
      const needsCompletion = !profile.weight && !latestWeight && !profile.age;
      setShowProfileCompletion(needsCompletion);
    }
  }, [profile, latestWeight, isLoading]);

  /* =========================
     PULL-TO-REFRESH
     ========================= */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), loadVerificationStatus()]);
      log.success("Profile refreshed");
    } catch (error) {
      log.error(`Failed to refresh profile: ${error}`);
    } finally {
      setRefreshing(false);
    }
  };

  /* =========================
     DETECT CHANGES
     ========================= */
  useEffect(() => {
    if (!profile) return;
    const nameChanged = displayName !== (profile.displayName || "");
    const heightChanged = height !== (profile.height ? String(profile.height) : "");
    const ageChanged = age !== (profile.age ? String(profile.age) : "");
    const goalChanged = weeklyGoal !== (profile.weeklyGoal ? String(profile.weeklyGoal) : "1");
    const fitnessGoalChanged = fitnessGoal !== (profile.fitnessGoal || null);
    setHasChanges(nameChanged || heightChanged || ageChanged || goalChanged || fitnessGoalChanged);
  }, [displayName, height, age, fitnessGoal, weeklyGoal, profile]);

  /* =========================
     SAVE PROFILE
     ========================= */
  const handleSaveProfile = async () => {
    if (!profile) return;

    setIsSaving(true);
    try {
      const updates: any = {};

      if (displayName !== (profile.displayName || "")) {
        updates.displayName = displayName || null;
      }
      if (height && height !== String(profile.height || "")) {
        updates.height = parseFloat(height) || null;
      } else if (!height && profile.height) {
        updates.height = null;
      }
      const parsedAge = parseInt(age) || null;
      if (parsedAge !== (profile.age || null)) {
        updates.age = parsedAge && parsedAge > 0 && parsedAge < 120 ? parsedAge : null;
      }
      if (fitnessGoal !== (profile.fitnessGoal || null)) {
        updates.fitnessGoal = fitnessGoal;
      }
      const goalNum = parseInt(weeklyGoal) || 1;
      if (goalNum !== (profile.weeklyGoal || 1)) {
        updates.weeklyGoal = Math.max(1, Math.min(7, goalNum));
      }

      log.debug("Saving profile update", {
        userId: user?.uid,
        updates,
      });

      await updateProfile.mutateAsync(updates);
      setHasChanges(false);
      log.success("Profile saved");
      Alert.alert("Success", "Profile updated");
    } catch (error) {
      if (error && typeof error === "object" && "status" in error) {
        const apiError = error as {
          status?: number;
          message?: string;
          errors?: { field: string; message: string }[];
        };
        log.error(
          "Failed to save profile",
          `status=${apiError.status ?? "unknown"}`,
          {
            message: apiError.message,
            errors: apiError.errors,
          }
        );
      } else {
        log.error(`Failed to save profile: ${error}`);
      }
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  /* =========================
     PROFILE COMPLETION
     ========================= */
  const handleProfileCompletion = async (
    weight: number | null,
    age: number | null
  ) => {
    try {
      const updates: any = {};
      if (weight !== null && weight !== profile?.weight) updates.weight = weight;
      if (age !== null && age !== profile?.age) updates.age = age;

      if (Object.keys(updates).length > 0) {
        await updateProfile.mutateAsync(updates);
      }
      setShowProfileCompletion(false);
      log.success("Profile completion saved");
    } catch (error) {
      log.error(`Failed to save profile completion: ${error}`);
      throw error;
    }
  };

  /* =========================
     LOGOUT
     ========================= */
  const handleLogout = async () => {
    Alert.alert(
      "Log Out?",
      "Your data is safely stored in the cloud. You can log back in at any time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear React Query cache so no stale data or background refetches
              // fire unauthenticated requests after sign-out
              queryClient.cancelQueries();
              queryClient.clear();

              await logout();
              log.info("User logged out");

              // Explicitly navigate to login instead of relying only on the auth guard
              router.replace("/login");
            } catch (error) {
              log.error(`Logout failed: ${error}`);
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          },
        },
      ],
    );
  };

  /* =========================
     EXPORT DATA
     ========================= */
  const handleExport = (format: "csv" | "pdf") => {
    Alert.alert(
      `Export as ${format.toUpperCase()}`,
      `This will export all your workouts and body weight records as a ${format.toUpperCase()} file.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export",
          onPress: async () => {
            setIsExporting(true);
            try {
              log.info(`Starting ${format.toUpperCase()} export...`);
              if (format === "csv") {
                await exportToCSV();
              } else {
                await exportToPDF();
              }
              log.success(`${format.toUpperCase()} export completed`);
            } catch (error) {
              log.error(`Export failed: ${error}`);
              Alert.alert(
                "Export Failed",
                error instanceof Error ? error.message : "An unknown error occurred",
              );
            } finally {
              setIsExporting(false);
            }
          },
        },
      ],
    );
  };

  if (isLoading && !profile) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!profile && isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.md, paddingTop: insets.top + spacing.md }}>
        <ProfileStatus
          title="Profile unavailable"
          message={error instanceof Error ? error.message : "Can't load your profile right now."}
          onRetry={() => void refetchProfile()}
        />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.md, paddingTop: insets.top + spacing.md }}>
        <ProfileStatus
          title="Profile not available"
          message="Your account profile has not been created yet."
          onRetry={() => void refetchProfile()}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 12}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
      {isError && (
        <ProfileStatus
          compact
          title="Showing cached profile"
          message="The server is unavailable. Changes may not sync until you reconnect."
          onRetry={() => void refetchProfile()}
        />
      )}
      {/* HEADER */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginRight: spacing.sm }}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.textPrimary}
              />
            </Pressable>
            <Text style={{ ...typography.h1, color: colors.textPrimary }}>
              Profile
            </Text>
          </View>
          {/* Data is always in sync with the backend */}
          <SyncBadge state="synced" pendingCount={0} compact />
        </View>
        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            marginBottom: spacing.lg,
          }}
        >
          Manage your account
        </Text>
      </Animated.View>

      {/* Email Verification Banner */}
      {user &&
        !user.emailVerified &&
        verificationDaysLeft !== null &&
        !dismissVerificationBanner && (
        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          style={{ marginBottom: spacing.lg }}
        >
          <View
            style={{
              backgroundColor:
                verificationDaysLeft > 0 ? colors.warning + "15" : colors.error + "15",
              borderRadius: radius.lg,
              padding: spacing.md,
              borderLeftWidth: 4,
              borderLeftColor:
                verificationDaysLeft > 0 ? colors.warning : colors.error,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: verificationDaysLeft > 0 ? colors.warning : colors.error,
                    marginBottom: spacing.xs,
                    fontWeight: "600",
                  }}
                >
                  {verificationDaysLeft > 0
                    ? verificationMessages.bannerTitleSoft(verificationDaysLeft)
                    : verificationMessages.bannerTitleHard}
                </Text>
                <Text style={{ ...typography.body, color: colors.textPrimary }}>
                  {verificationMessages.bannerBody}
                </Text>
                <Pressable
                  onPress={() => setShowVerificationPrompt(true)}
                  style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
                >
                  <Text style={{ color: colors.accent, fontWeight: "600" }}>
                    {verificationMessages.bannerAction}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => setDismissVerificationBanner(true)}
                style={{ paddingLeft: spacing.sm }}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      {/* AVATAR & NAME HERO */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        style={{
          alignItems: "center",
          marginBottom: spacing.xl,
        }}
      >
        {/* Avatar - Generated or from Google */}
        <View
          style={{
            borderRadius: radius.full,
            marginBottom: spacing.md,
            ...shadows.lg,
          }}
        >
          <Image
            source={{
              uri: getAvatarUrl({
                avatarUrl: profile?.avatarUrl,
                displayName: displayName || profile?.displayName,
                email: profile?.email || user?.email,
                userId: user?.uid || "default",
              }),
            }}
            style={{
              width: 100,
              height: 100,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceElevated,
            }}
          />
          {/* Auth provider badge */}
          {profile?.authProvider === "google" && (
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                backgroundColor: colors.surface,
                borderRadius: radius.full,
                padding: 4,
                ...shadows.sm,
              }}
            >
              <Ionicons name="logo-google" size={18} color="#4285F4" />
            </View>
          )}
        </View>

        <Text
          style={{
            ...typography.h2,
            color: colors.textPrimary,
            marginBottom: spacing.xxs,
          }}
        >
          {displayName || "Set your name"}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            {profile?.email || user?.email || "No email"}
          </Text>
          {user?.emailVerified ? (
            <View
              style={{
                marginLeft: spacing.xs,
                backgroundColor: colors.success + "20",
                borderRadius: radius.full,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xxs,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={12}
                color={colors.success}
              />
              <Text style={{ ...typography.label, color: colors.success }}>
                {verificationMessages.badgeVerified}
              </Text>
            </View>
          ) : (
            <View
              style={{
                marginLeft: spacing.xs,
                backgroundColor: colors.warning + "20",
                borderRadius: radius.full,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xxs,
              }}
            >
              <Ionicons name="alert-circle" size={12} color={colors.warning} />
              <Text style={{ ...typography.label, color: colors.warning }}>
                {verificationMessages.badgeUnverified}
              </Text>
            </View>
          )}
          {profile?.authProvider === "google" && (
            <View
              style={{
                marginLeft: spacing.xs,
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
              }}
            >
              <Text style={{ ...typography.label, color: colors.textMuted }}>
                Google
              </Text>
            </View>
          )}
        </View>

        {/* Account created date */}
        <Text
          style={{
            ...typography.caption,
            color: colors.textMuted,
            marginTop: spacing.xs,
          }}
        >
          Member since {profile?.createdAt ? formatAccountDate(new Date(profile.createdAt).getTime()) : "—"}
        </Text>
      </Animated.View>

      {/* Legacy Profile Completion (missing age/weight) */}
      {(!profile?.age || (!profile?.weight && !latestWeight)) && (
        <Animated.View
          entering={FadeInUp.delay(170).duration(400)}
          style={{ marginBottom: spacing.lg }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <Text
              style={{
                ...typography.bodyMedium,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}
            >
              Complete your profile
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Add your age and weight so your insights are accurate.
            </Text>
            <Pressable
              onPress={() => {
                setProfilePromptMode("missing");
                setShowProfileCompletion(true);
              }}
              style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
            >
              <Text style={{ color: colors.accent, fontWeight: "600" }}>
                Add missing details
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* PROFILE FIELDS */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.lg,
          }}
        >
          PERSONAL INFO
        </Text>

        {/* Display Name */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Display Name (Optional)
          </Text>
          <TextInput
            placeholder="Your name (set during onboarding)"
            placeholderTextColor={colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
            }}
          />
        </View>

        {/* Height */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Height (cm)
          </Text>
          <TextInput
            placeholder="Your height"
            placeholderTextColor={colors.textMuted}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
            }}
          />
        </View>

        {/* Weight */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Weight (kg)
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            }}
          >
            <Text style={{ ...typography.body, color: colors.textPrimary }}>
              {latestWeight ? `${latestWeight} kg` : profile?.weight ? `${profile.weight} kg` : "Not set"}
            </Text>
            <Pressable
              onPress={() => router.push("/body-weight")}
              style={{ marginLeft: "auto", paddingVertical: spacing.md }}
            >
              <Text style={{ color: colors.accent, fontWeight: "600" }}>
                Log
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Age */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Age
          </Text>
          <TextInput
            value={age}
            onChangeText={setAge}
            placeholder="e.g. 25"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={{
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: colors.textPrimary,
              ...typography.body,
            }}
          />
        </View>

        {/* Fitness Goal */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.sm,
            }}
          >
            Fitness Goal
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {[
              { id: "strength", label: "Strength", emoji: "🏋️" },
              { id: "muscle", label: "Muscle Gain", emoji: "💪" },
              { id: "endurance", label: "Endurance", emoji: "🏃" },
              { id: "weight-loss", label: "Weight Loss", emoji: "⚖️" },
              { id: "general", label: "General", emoji: "🎯" },
            ].map((goal) => {
              const selected = fitnessGoal === goal.id;
              return (
                <Pressable
                  key={goal.id}
                  onPress={() => setFitnessGoal(goal.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: selected ? colors.accent : colors.surfaceElevated,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.cardBorder,
                  }}
                >
                  <Text style={{ fontSize: 14, marginRight: 4 }}>{goal.emoji}</Text>
                  <Text
                    style={{
                      ...typography.caption,
                      color: selected ? "#fff" : colors.textPrimary,
                      fontWeight: selected ? "700" : "500",
                    }}
                  >
                    {goal.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Daily Goal */}
        <View
          style={{
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.md,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.lg,
          }}
        >
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.md,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Daily Workout Goal
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
              <Pressable
                key={num}
                onPress={() => setWeeklyGoal(String(num))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor:
                    weeklyGoal === String(num)
                      ? colors.accent
                      : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: weeklyGoal === String(num) ? 0 : 1,
                  borderColor: colors.cardBorder,
                }}
              >
                <Text
                  style={{
                    color:
                      weeklyGoal === String(num) ? "#fff" : colors.textPrimary,
                    fontWeight: weeklyGoal === String(num) ? "600" : "500",
                    fontSize: 14,
                  }}
                >
                  {num}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text
            style={{
              ...typography.caption,
              color: colors.textMuted,
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            How many workouts do you aim to complete each day?
          </Text>
        </View>
      </Animated.View>

      {/* WEIGHT UNIT PREFERENCE */}
      <Animated.View
        entering={FadeInUp.delay(480).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.md,
          }}
        >
          WEIGHT UNIT
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
          }}
        >
          {(["kg", "lbs"] as const).map((u) => (
            <Pressable
              key={u}
              onPress={() => setWeightUnit(u)}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                backgroundColor:
                  weightUnit === u ? colors.accent : colors.surfaceElevated,
                alignItems: "center",
                borderWidth: weightUnit === u ? 0 : 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Text
                style={{
                  color: weightUnit === u ? "#fff" : colors.textPrimary,
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                {u.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: weightUnit === u ? "rgba(255,255,255,0.7)" : colors.textMuted,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {u === "kg" ? "Kilograms" : "Pounds"}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* SAVE BUTTON */}
      {hasChanges && (
        <Animated.View entering={FadeInUp.duration(300)}>
          <Pressable
            onPress={handleSaveProfile}
            disabled={isSaving}
            style={{
              backgroundColor: colors.accent,
              padding: spacing.md,
              borderRadius: radius.lg,
              alignItems: "center",
              marginBottom: spacing.md,
              opacity: isSaving ? 0.6 : 1,
              ...shadows.md,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Save Changes
              </Text>
            )}
          </Pressable>
        </Animated.View>
      )}

      {/* ACCOUNT INFO - Hidden for cleaner profile
      <Animated.View
        entering={FadeInUp.delay(300).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.lg,
          }}
        >
          ACCOUNT
        </Text>

        <InfoRow
          label="User ID"
          value={user?.uid?.slice(0, 16) + "..."}
          colors={colors}
          spacing={spacing}
          typography={typography}
        />
        <View
          style={{
            height: 1,
            backgroundColor: colors.divider,
            marginVertical: spacing.md,
          }}
        />
        <InfoRow
          label="Member Since"
          value={
            profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString()
              : "N/A"
          }
          colors={colors}
          spacing={spacing}
          typography={typography}
        />
        <View
          style={{
            height: 1,
            backgroundColor: colors.divider,
            marginVertical: spacing.md,
          }}
        />
        <InfoRow
          label="Last Updated"
          value={
            profile?.updatedAt
              ? new Date(profile.updatedAt).toLocaleDateString()
              : "N/A"
          }
          colors={colors}
          spacing={spacing}
          typography={typography}
        />
      </Animated.View>
      */}

      {/* DATA STATUS SECTION */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.lg,
          }}
        >
          DATA
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.successLight,
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.sm,
            }}
          >
            <Ionicons name="cloud-done-outline" size={20} color={colors.success} />
          </View>
          <View>
            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
              All data synced
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Stored securely in the cloud
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* AI WORKOUT PLAN */}
      <Animated.View
        entering={FadeInUp.delay(430).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
          marginBottom: spacing.md,
        }}
      >
        <Pressable
          onPress={() => router.push("/ai-plan")}
          style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.accentLight,
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.sm,
            }}
          >
            <Ionicons name="sparkles" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
              AI Workout Plan
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              {profile?.activePlan ? "View & manage your plan" : "Generate with Gemini AI"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </Animated.View>

      {/* ACHIEVEMENTS */}
      <Animated.View
        entering={FadeInUp.delay(435).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
          marginBottom: spacing.md,
        }}
      >
        <Pressable
          onPress={() => router.push("/achievements")}
          accessibilityRole="button"
          accessibilityLabel="Achievements"
          style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.accentLight,
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.sm,
            }}
          >
            <Ionicons name="trophy" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
              Achievements
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Badges and progress
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </Animated.View>

      {/* NOTIFICATION SETTINGS */}
      <Animated.View
        entering={FadeInUp.delay(440).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
          marginBottom: spacing.md,
        }}
      >
        <Pressable
          onPress={() => router.push("/notification-settings")}
          style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.secondaryLight,
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.sm,
            }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
              Notification Settings
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Daily workout reminder
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </Animated.View>

      {/* APPEARANCE */}
      <Animated.View
        entering={FadeInUp.delay(445).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
          marginBottom: spacing.md,
        }}
      >
        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: "#78350F20",
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Ionicons name="color-palette-outline" size={20} color="#92400E" />
            </View>
            <View>
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>Appearance</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Choose your preferred theme
              </Text>
            </View>
          </View>

          {/* Three-way toggle */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.lg,
              padding: 3,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            {(
              [
                { value: "system" as ThemePreference, label: "System", icon: "phone-portrait-outline" as const },
                { value: "light" as ThemePreference, label: "Light", icon: "sunny-outline" as const },
                { value: "dark" as ThemePreference, label: "Dark", icon: "moon-outline" as const },
              ]
            ).map((opt) => {
              const active = themePreference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setThemePreference(opt.value)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: active ? colors.surface : "transparent",
                    gap: 5,
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? colors.cardBorder : "transparent",
                  }}
                >
                  <Ionicons
                    name={opt.icon}
                    size={15}
                    color={active ? colors.accent : colors.textMuted}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: active ? "700" : "500",
                      color: active ? colors.accent : colors.textMuted,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>

      {/* EXPORT DATA SECTION */}
      <Animated.View
        entering={FadeInUp.delay(450).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
          opacity: isExporting ? 0.7 : 1,
        }}
      >
        <View style={{ padding: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: colors.accentLight,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Ionicons
                name="download-outline"
                size={20}
                color={colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ ...typography.bodyMedium, color: colors.textPrimary }}
              >
                Export Data
              </Text>
              <Text
                style={{ ...typography.caption, color: colors.textSecondary }}
              >
                Download your workout history
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={() => handleExport("csv")}
              disabled={isExporting}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceElevated,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={colors.textPrimary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text
                    style={{
                      ...typography.bodyMedium,
                      color: colors.textPrimary,
                    }}
                  >
                    CSV
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => handleExport("pdf")}
              disabled={isExporting}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceElevated,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons
                    name="document-outline"
                    size={18}
                    color={colors.textPrimary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text
                    style={{
                      ...typography.bodyMedium,
                      color: colors.textPrimary,
                    }}
                  >
                    PDF
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* ADMIN TOOLS */}
      {isAdmin && (
        <Animated.View
          entering={FadeInUp.delay(520).duration(400)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.cardBorder,
            ...shadows.sm,
            marginBottom: spacing.md,
          }}
        >
          <Pressable
            onPress={() => router.push("/admin-catalog")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: colors.accentLight,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Ionicons name="settings-outline" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.bodyMedium,
                  color: colors.textPrimary,
                }}
              >
                Admin: Exercise Catalog
              </Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Manage remote additions and removals
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      )}

      {/* DELETE ACCOUNT SECTION */}
      <Animated.View
        entering={FadeInUp.delay(520).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.error + "55",
          ...shadows.sm,
          marginBottom: spacing.md,
        }}
      >
        <Pressable
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: spacing.lg,
            opacity: isDeletingAccount ? 0.6 : 1,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.errorLight,
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.sm,
            }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyMedium, color: colors.error }}>
              Delete Account
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Permanently remove your account and data
            </Text>
          </View>
          {isDeletingAccount ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          )}
        </Pressable>
      </Animated.View>

      {/* LOGOUT SECTION */}
      <Animated.View
        entering={FadeInUp.delay(550).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Pressable
          onPress={handleLogout}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.errorLight,
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.sm,
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyMedium, color: colors.error }}>
              Log Out
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Sign out of your account
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </Animated.View>

      {/* APP INFO / CREDITS */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(400)}
        style={{
          alignItems: "center",
          marginTop: spacing.xl,
          paddingBottom: spacing.lg,
        }}
      >
        <Image
          source={require("../../assets/images/icon.png")}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            marginBottom: spacing.sm,
          }}
        />
        <Text
          style={{
            ...typography.bodyMedium,
            color: colors.textPrimary,
            marginBottom: spacing.xxs,
          }}
        >
          Iron Arc
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          Version {Constants.expoConfig?.version || "1.1.1"}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          Designed & Built by Pushpanath
        </Text>
      </Animated.View>
      </ScrollView>

      {/* Profile Completion Prompt */}
      <ProfileCompletionPrompt
        visible={showProfileCompletion}
        onDismiss={() => setShowProfileCompletion(false)}
        onSave={handleProfileCompletion}
        currentWeight={profile?.weight}
        currentAge={profile?.age}
        isLoading={isSaving}
        allowWeightEdit={profilePromptMode === "missing"}
      />

      <EmailVerificationPrompt
        visible={showVerificationPrompt}
        user={user}
        dismissible={verificationDaysLeft !== 0}
        onSkip={() => setShowVerificationPrompt(false)}
        onVerified={async () => {
          setShowVerificationPrompt(false);
          if (user) {
            await clearEmailVerificationStart(user.uid);
          }
          await loadVerificationStatus();
        }}
      />

      <Modal
        visible={showDeleteReauthentication}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteReauthentication(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: spacing.lg,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
            }}
          >
            <Text style={{ ...typography.h2, color: colors.textPrimary }}>
              Confirm your password
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                marginTop: spacing.xs,
                marginBottom: spacing.md,
              }}
            >
              For your security, sign in again before deleting this account.
            </Text>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                marginBottom: spacing.xs,
              }}
            />
            {deleteError && (
              <Text style={{ ...typography.caption, color: colors.error, marginBottom: spacing.sm }}>
                {deleteError}
              </Text>
            )}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
              <Pressable
                onPress={() => {
                  setShowDeleteReauthentication(false);
                  setDeletePassword("");
                  setDeleteError(null);
                }}
                disabled={isDeletingAccount}
                style={{ padding: spacing.sm }}
              >
                <Text style={{ ...typography.bodyMedium, color: colors.textSecondary }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleEmailReauthentication}
                disabled={isDeletingAccount}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: colors.error,
                }}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ ...typography.bodyMedium, color: "#fff" }}>
                    Continue
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* =========================
   HELPER COMPONENTS
   ========================= */

function InfoRow({
  label,
  value,
  colors,
  spacing,
  typography,
}: {
  label: string;
  value: string;
  colors: any;
  spacing: any;
  typography: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
        {label}
      </Text>
      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}

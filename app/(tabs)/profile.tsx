import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { EmailVerificationPrompt } from "../../components/EmailVerificationPrompt";
import { ExportSheet } from "../../components/ExportSheet";
import { GOALS, type FitnessGoal } from "../../components/OnboardingProfileSetup";
import { DaysSheet, HeightSheet, NumberSheet, OptionsSheet } from "../../components/profile/EditSheets";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { SettingsGroup, SettingsRow } from "../../components/profile/Settings";
import { ProfileStatus } from "../../components/ProfileStatus";
import { OfflineState } from "../../components/ui";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Reveal } from "../../components/ui/Reveal";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { TextField } from "../../components/ui/TextField";
import { verificationMessages } from "../../constants/verificationMessages";
import {
  AVOID_OPTIONS,
  effectiveWeeklyGoal,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  formatDays,
  SESSION_OPTIONS,
  type AvoidArea,
  type Equipment,
  type ExperienceLevel,
  type SessionMinutes,
  type Weekday,
} from "../../constants/trainingProfile";
import { useConnection } from "../../context/ConnectionContext";
import { useToast } from "../../context/ToastContext";
import { clearEmailVerificationStart, getEmailVerificationStart, setEmailVerificationStart } from "../../db/syncMeta";
import { auth } from "../../firebase/config";
import { useAchievements } from "../../hooks/useAchievements";
import { usePlans } from "../../hooks/usePlan";
import { useProfile, useUpdateProfile } from "../../hooks/useProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useLatestWeight } from "../../hooks/useWeights";
import { groupSessions, useWorkoutSummary } from "../../hooks/useWorkoutSummary";
import { getNotificationPreferences } from "../../notifications/notificationService";
import { userApi, type User } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { getVersionLabel } from "../../utils/appVersion";
import { getInitials } from "../../utils/avatar";
import { getGoogleSignin } from "../../utils/googleSignin";
import { createPageLogger } from "../../utils/logger";
import { displayWeight, weightLabel } from "../../utils/unitConversion";
import { clearVerificationSent } from "../../utils/verificationService";

const log = createPageLogger("Profile");
const NO_WORKOUTS: never[] = [];
const VERIFICATION_GRACE_DAYS = 7;
const HEIGHT = { fallback: 170 };
const AGE = { min: 13, max: 100, fallback: 25 };

type EditKey = "days" | "experience" | "session" | "equipment" | "avoid" | "goal" | "height" | "age";
type ProfileUpdate = Parameters<typeof userApi.updateProfile>[0];

/** Every updated field came back with the value sent (lists compared in any order). */
function keptAll(updates: ProfileUpdate, saved: User | undefined) {
  if (!saved) return false;
  return Object.entries(updates).every(([k, v]) => {
    const got = (saved as unknown as Record<string, unknown>)[k];
    if (Array.isArray(v)) return Array.isArray(got) && got.length === v.length && v.every((x) => (got as unknown[]).includes(x));
    return (got ?? null) === (v ?? null);
  });
}

const labelOf = <T,>(options: { value: T; label: string }[], v: T | null | undefined) => options.find((o) => o.value === v)?.label ?? null;

/* ==============================
   PROFILE & SETTINGS
   ============================== */

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user, logout, profile: authProfile } = useAuth();
  const connection = useConnection();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: queriedProfile, isLoading, isError, error, refetch: refetchProfile } = useProfile();
  // Fall back to the profile AuthContext already has, so a slow server never leaves this spinning.
  const profile: User | undefined = queriedProfile ?? authProfile ?? undefined;
  const updateProfile = useUpdateProfile();
  const { data: latestWeightEntry } = useLatestWeight();
  const { unit, setUnit } = useUnitPreference();
  const goal = effectiveWeeklyGoal(profile);
  const { query: workoutsQuery, streak } = useWorkoutSummary(goal);
  const { data: achievements } = useAchievements();
  const { data: plans } = usePlans();

  const [editing, setEditing] = useState<EditKey | null>(null);
  const [saving, setSaving] = useState<EditKey | "name" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirm, setConfirm] = useState<"logout" | "delete" | null>(null);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  /* ---------- numbers ---------- */
  const workouts = workoutsQuery.data ?? NO_WORKOUTS;
  const sessions = useMemo(() => groupSessions(workouts).length, [workouts]);
  const unlocked = achievements ? achievements.filter((a) => a.unlockedAt).length : null;
  const activePlan = plans?.find((p) => p.isActive) ?? null;

  /* ---------- notifications: the real state (setting + system permission) ---------- */
  const loadNotifStatus = useCallback(async () => {
    try {
      const [prefs, perm] = await Promise.all([getNotificationPreferences(), Notifications.getPermissionsAsync()]);
      const anyOn = prefs.dailyReminder || prefs.streakReminders || prefs.inactivityReminders || prefs.weeklySummary || prefs.weighIn;
      setNotifStatus(perm.status !== "granted" ? "Not allowed" : anyOn ? "On" : "Off");
    } catch {
      setNotifStatus(null);
    }
  }, []);

  /* ---------- email verification (grace period) ---------- */
  const [verificationDaysLeft, setVerificationDaysLeft] = useState<number | null>(null);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const loadVerificationStatus = useCallback(async () => {
    if (!user) return;
    try {
      await user.reload();
    } catch {}
    if (user.emailVerified) {
      setVerificationDaysLeft(null);
      await clearEmailVerificationStart(user.uid);
      return;
    }
    let start = await getEmailVerificationStart(user.uid);
    if (!start) {
      start = Date.now();
      await setEmailVerificationStart(user.uid, start);
    }
    const elapsedDays = Math.floor((Date.now() - start) / 86_400_000);
    setVerificationDaysLeft(Math.max(0, VERIFICATION_GRACE_DAYS - elapsedDays));
  }, [user]);

  useEffect(() => {
    if (user && !user.emailVerified && verificationDaysLeft === 0) setShowVerificationPrompt(true);
  }, [user, verificationDaysLeft]);

  useFocusEffect(
    useCallback(() => {
      void loadVerificationStatus();
      void loadNotifStatus();
    }, [loadVerificationStatus, loadNotifStatus]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), loadVerificationStatus(), loadNotifStatus()]);
    } finally {
      setRefreshing(false);
    }
  };

  /* ---------- save one field (instant save, small toast) ---------- */
  const save = async (key: EditKey | "name", updates: ProfileUpdate, label: string) => {
    setSaving(key);
    try {
      const saved = await updateProfile.mutateAsync(updates);
      // Only say "saved" if the server really kept it (an outdated server drops fields it doesn't know).
      if (!keptAll(updates, saved)) {
        log.warn(`Server didn't keep ${Object.keys(updates).join(", ")}`);
        showToast({ type: "error", message: `${label} wasn't saved`, subtitle: "The server didn't keep this change. It may need updating; try again later." });
        return false;
      }
      showToast({ type: "success", message: `${label} saved` });
      setEditing(null);
      return true;
    } catch (e) {
      log.error(`Failed to save ${label}: ${e}`);
      showToast({ type: "error", message: `Couldn't save ${label.toLowerCase()}`, subtitle: "Check your connection and try again." });
      return false;
    } finally {
      setSaving(null);
    }
  };

  /* ---------- logout ---------- */
  const doLogout = async () => {
    try {
      // No stale data or background refetches after sign-out.
      queryClient.cancelQueries();
      queryClient.clear();
      await logout();
      router.replace("/login");
    } catch (e) {
      log.error(`Logout failed: ${e}`);
      showToast({ type: "error", message: "Couldn't log out", subtitle: "Please try again." });
    }
  };

  /* ---------- delete account (with sign-in again when Firebase asks) ---------- */
  const [deleting, setDeleting] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);

  const clearLocalAccountData = async () => {
    const uid = user?.uid;
    queryClient.cancelQueries();
    queryClient.clear();
    try {
      try {
        await getGoogleSignin()?.GoogleSignin.signOut();
      } catch {}
      await logout();
    } finally {
      await AsyncStorage.clear();
      if (uid) await Promise.allSettled([SecureStore.deleteItemAsync(`evs_${uid}`), clearVerificationSent(uid)]);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setReauthError(null);
    try {
      await userApi.deleteAccount();
      await clearLocalAccountData();
      router.replace("/login");
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code !== "REAUTHENTICATION_REQUIRED") {
        log.error(`Account deletion failed: ${e}`);
        showToast({ type: "error", message: "Couldn't delete account", subtitle: err?.message || "Please try again." });
        return;
      }
      const providerId = user?.providerData[0]?.providerId;
      const google = getGoogleSignin();
      if (providerId === "google.com" && !google) {
        showToast({ type: "error", message: "Sign in again to delete", subtitle: "Google sign-in isn't available in this preview. Use the full app." });
      } else if (providerId === "google.com" && google) {
        try {
          const response = await google.GoogleSignin.signIn();
          const idToken = google.isSuccessResponse(response) ? response.data.idToken : null;
          if (idToken && auth.currentUser) {
            await reauthenticateWithCredential(auth.currentUser, GoogleAuthProvider.credential(idToken));
            await deleteAccountRef.current();
            return;
          }
        } catch (reAuthErr: unknown) {
          showToast({ type: "error", message: "Google sign-in failed", subtitle: (reAuthErr as Error)?.message });
        }
      } else {
        setReauthOpen(true);
      }
    } finally {
      setDeleting(false);
    }
  };
  const deleteAccountRef = useRef(deleteAccount);
  deleteAccountRef.current = deleteAccount;

  const reauthWithPassword = async () => {
    if (!auth.currentUser?.email || !password) {
      setReauthError("Enter your password to continue.");
      return;
    }
    setDeleting(true);
    setReauthError(null);
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password));
      setReauthOpen(false);
      setPassword("");
      await deleteAccount();
    } catch (e: unknown) {
      setReauthError((e as Error)?.message || "That password didn't work.");
      setDeleting(false);
    }
  };

  /* ---------- states before the profile is available ---------- */
  if (!profile && connection.state !== "online") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.screen }}>
        <OfflineState
          mode={connection.state === "waking" ? "waking" : "offline"}
          onRetry={() => {
            connection.retry();
            void refetchProfile();
          }}
          retrying={connection.checking}
        />
      </View>
    );
  }
  if (isLoading && !profile) return <ProfileSkeleton />;
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.screen }}>
        <ProfileStatus
          title={isError ? "Profile unavailable" : "Profile not available"}
          message={isError && error instanceof Error ? error.message : "Your account profile has not been created yet."}
          onRetry={() => void refetchProfile()}
        />
      </View>
    );
  }

  /* ---------- values ---------- */
  const days = (profile.trainingDays ?? []) as Weekday[];
  const avoid = (profile.avoidAreas ?? []) as AvoidArea[];
  const goalTitle = GOALS.find((g) => g.id === profile.fitnessGoal)?.title ?? null;
  const latestKg = latestWeightEntry?.weight ?? profile.weight ?? null;
  const nameSource = profile.displayName || user?.displayName || profile.email || user?.email || "";
  const memberSince = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;
  const showVerifyBanner = !!user && !user.emailVerified && verificationDaysLeft !== null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.screen }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name="person" size={size.icon} color={colors.accent} />
          </View>
          <Text style={[typography.headlineMd, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
            Profile
          </Text>
        </View>
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh }}>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{getVersionLabel()}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} />}
      >
        {isError && (
          <ProfileStatus compact title="Showing saved profile" message="The server is unavailable. Changes may not save until you reconnect." onRetry={() => void refetchProfile()} />
        )}

        <Reveal index={0} style={{ gap: spacing.md }}>
          <ProfileHeader
            name={profile.displayName ?? ""}
            email={profile.email || user?.email || ""}
            photoUri={profile.avatarUrl || user?.photoURL || null}
            initials={nameSource ? getInitials(nameSource) : ""}
            verified={!!user?.emailVerified}
            google={profile.authProvider === "google"}
            memberSince={memberSince}
            workouts={sessions}
            streak={goal ? streak.current : null}
            badges={unlocked}
            savingName={saving === "name"}
            onSaveName={(name) => save("name", { displayName: name }, "Name")}
            onVerify={() => setShowVerificationPrompt(true)}
            onOpenBadges={() => router.push("/achievements")}
          />

          {showVerifyBanner && (
            <Pressable
              onPress={() => setShowVerificationPrompt(true)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: verificationDaysLeft! > 0 ? colors.warning : colors.danger,
                backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
              })}
            >
              <MaterialIcons name="mark-email-unread" size={size.iconLg} color={verificationDaysLeft! > 0 ? colors.warning : colors.danger} />
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text style={[typography.bodyMdMedium, { color: colors.text }]}>
                  {verificationDaysLeft! > 0 ? verificationMessages.bannerTitleSoft(verificationDaysLeft!) : verificationMessages.bannerTitleHard}
                </Text>
                <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{verificationMessages.bannerBody}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={size.iconSm} color={colors.textMuted} />
            </Pressable>
          )}
        </Reveal>

        {/* Training: what the AI plan, Home and reminders use */}
        <Reveal index={1}>
          <SettingsGroup title="Training" note="Used by your plan and reminders">
            <SettingsRow
              icon="calendar-today"
              label="Training days"
              detail={days.length ? `${days.length} ${days.length === 1 ? "day" : "days"} a week · your weekly goal` : undefined}
              value={days.length ? formatDays(days) : "Add"}
              missing={!days.length}
              kind="edit"
              onPress={() => setEditing("days")}
            />
            <SettingsRow icon="track-changes" label="Fitness goal" value={goalTitle ?? "Add"} missing={!goalTitle} kind="edit" onPress={() => setEditing("goal")} />
            <SettingsRow
              icon="military-tech"
              label="Experience"
              value={labelOf(EXPERIENCE_OPTIONS, profile.experienceLevel) ?? "Add"}
              missing={!profile.experienceLevel}
              kind="edit"
              onPress={() => setEditing("experience")}
            />
            <SettingsRow
              icon="timer"
              label="Session length"
              value={labelOf(SESSION_OPTIONS, profile.sessionMinutes) ?? "Add"}
              missing={!profile.sessionMinutes}
              kind="edit"
              onPress={() => setEditing("session")}
            />
            <SettingsRow icon="fitness-center" label="Equipment" value={labelOf(EQUIPMENT_OPTIONS, profile.equipment) ?? "Add"} missing={!profile.equipment} kind="edit" onPress={() => setEditing("equipment")} />
            <SettingsRow
              icon="healing"
              label="Go easy on"
              detail="Your plan avoids loading these heavily"
              value={avoid.length ? avoid.map((a) => labelOf(AVOID_OPTIONS, a)).join(", ") : "None"}
              kind="edit"
              onPress={() => setEditing("avoid")}
            />
          </SettingsGroup>
        </Reveal>

        {/* Body */}
        <Reveal index={2}>
          <SettingsGroup title="Body">
            <SettingsRow icon="height" label="Height" value={profile.height ? `${profile.height} cm` : "Add"} missing={!profile.height} kind="edit" onPress={() => setEditing("height")} />
            <SettingsRow icon="cake" label="Age" value={profile.age ? String(profile.age) : "Add"} missing={!profile.age} kind="edit" onPress={() => setEditing("age")} />
            <SettingsRow
              icon="monitor-weight"
              label="Body weight"
              detail="Log and track it on the Weight tab"
              value={latestKg ? `${Math.round(displayWeight(latestKg, unit) * 10) / 10} ${weightLabel(unit)}` : "Log"}
              missing={!latestKg}
              onPress={() => router.navigate("/(tabs)/body-weight")}
            />
            <SettingsRow icon="straighten" label="Weight unit" trailing={<UnitSwitch unit={unit} onChange={setUnit} />} />
          </SettingsGroup>
        </Reveal>

        {/* AI plan */}
        <Reveal index={3}>
          <SettingsGroup title="AI plan">
            <SettingsRow
              icon="auto-awesome"
              label={activePlan ? activePlan.name : "AI workout plan"}
              detail={activePlan ? "Your active plan" : "Built from your training answers above"}
              value={activePlan ? "Active" : "Not created"}
              missing={!activePlan}
              onPress={() => router.push("/ai-plan")}
            />
          </SettingsGroup>
        </Reveal>

        {/* Activity & alerts */}
        <Reveal index={4}>
          <SettingsGroup title="Activity & alerts">
            <SettingsRow icon="emoji-events" label="Achievements" value={unlocked != null ? `${unlocked} unlocked` : undefined} onPress={() => router.push("/achievements")} />
            <SettingsRow
              icon="notifications"
              label="Notifications"
              detail="Workout reminders and streak nudges"
              value={notifStatus ?? undefined}
              missing={notifStatus === "Not allowed"}
              onPress={() => router.push("/notification-settings")}
            />
          </SettingsGroup>
        </Reveal>

        {/* Account */}
        <Reveal index={5} style={{ gap: spacing.md }}>
          <SettingsGroup title="Account">
            <SettingsRow icon="ios-share" label="Export your data" detail="Workouts and body weight as CSV or PDF" kind="action" onPress={() => setExportOpen(true)} />
            {profile.isAdmin ? <SettingsRow icon="admin-panel-settings" label="Admin: exercise catalog" detail="Manage remote additions and removals" onPress={() => router.push("/admin-catalog")} /> : null}
            <SettingsRow icon="logout" label="Log out" value={profile.displayName || undefined} kind="action" onPress={() => setConfirm("logout")} />
          </SettingsGroup>
          <SettingsGroup>
            <SettingsRow icon="delete-forever" label="Delete account" value="Irreversible" tone="danger" busy={deleting} kind="action" onPress={() => setConfirm("delete")} />
          </SettingsGroup>
        </Reveal>

        <Text style={[typography.labelSm, { color: colors.textMuted, textAlign: "center" }]}>Iron Arc {getVersionLabel()}</Text>
      </ScrollView>

      {/* ---------- edit sheets (each saves on its own) ---------- */}
      <DaysSheet
        visible={editing === "days"}
        value={days}
        saving={saving === "days"}
        onSave={(d) => void save("days", { trainingDays: d }, "Training days")}
        onClose={() => setEditing(null)}
      />
      <OptionsSheet<FitnessGoal>
        visible={editing === "goal"}
        title="Fitness goal"
        subtitle="Shapes your AI plan's reps, sets and exercise choice."
        options={GOALS.map((g) => ({ value: g.id, label: g.title, hint: g.description }))}
        value={profile.fitnessGoal ? [profile.fitnessGoal as FitnessGoal] : []}
        saving={saving === "goal"}
        onSave={([v]) => void save("goal", { fitnessGoal: v }, "Fitness goal")}
        onClose={() => setEditing(null)}
      />
      <OptionsSheet<ExperienceLevel>
        visible={editing === "experience"}
        title="Experience"
        options={EXPERIENCE_OPTIONS}
        value={profile.experienceLevel ? [profile.experienceLevel] : []}
        saving={saving === "experience"}
        onSave={([v]) => void save("experience", { experienceLevel: v }, "Experience")}
        onClose={() => setEditing(null)}
      />
      <OptionsSheet<SessionMinutes>
        visible={editing === "session"}
        title="Session length"
        subtitle="How long a usual workout takes you."
        options={SESSION_OPTIONS}
        value={profile.sessionMinutes ? [profile.sessionMinutes] : []}
        saving={saving === "session"}
        onSave={([v]) => void save("session", { sessionMinutes: v }, "Session length")}
        onClose={() => setEditing(null)}
      />
      <OptionsSheet<Equipment>
        visible={editing === "equipment"}
        title="Equipment"
        options={EQUIPMENT_OPTIONS}
        value={profile.equipment ? [profile.equipment] : []}
        saving={saving === "equipment"}
        onSave={([v]) => void save("equipment", { equipment: v }, "Equipment")}
        onClose={() => setEditing(null)}
      />
      <OptionsSheet<AvoidArea>
        visible={editing === "avoid"}
        title="Go easy on"
        subtitle="Your plan avoids exercises that load these areas heavily. Leave all off if none."
        options={AVOID_OPTIONS}
        value={avoid}
        multiple
        saving={saving === "avoid"}
        onSave={(v) => void save("avoid", { avoidAreas: v }, "Areas")}
        onClose={() => setEditing(null)}
      />
      <HeightSheet
        visible={editing === "height"}
        value={profile.height ?? null}
        fallback={HEIGHT.fallback}
        saving={saving === "height"}
        onSave={(v) => void save("height", { height: v }, "Height")}
        onClose={() => setEditing(null)}
      />
      <NumberSheet
        visible={editing === "age"}
        title="Age"
        subtitle="Helps your AI plan pick sensible volume and recovery."
        label="Age"
        value={profile.age ?? null}
        fallback={AGE.fallback}
        min={AGE.min}
        max={AGE.max}
        saving={saving === "age"}
        onSave={(v) => void save("age", { age: v }, "Age")}
        onClose={() => setEditing(null)}
      />

      <ExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} displayName={profile.displayName ?? ""} />

      <ConfirmDialog
        visible={confirm === "logout"}
        icon="logout"
        title="Log out?"
        message="Your workouts are saved to your account. Sign back in any time to pick up where you left off."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirm(null);
          void doLogout();
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === "delete"}
        destructive
        title="Delete your account?"
        message="This permanently deletes your profile, workouts, plans, body weights and achievements. It can't be undone. Export your data first if you want a copy."
        confirmLabel="Delete account"
        onConfirm={() => {
          setConfirm(null);
          void deleteAccount();
        }}
        onCancel={() => setConfirm(null)}
      />

      {/* Firebase asks for a recent sign-in before deleting (email accounts) */}
      <Sheet
        visible={reauthOpen}
        onClose={
          deleting
            ? undefined
            : () => {
                setReauthOpen(false);
                setPassword("");
                setReauthError(null);
              }
        }
        title="Confirm your password"
        subtitle="For your security, sign in again before deleting this account."
      >
        <TextField label="Password" variant="password" value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} error={reauthError} autoFocus />
        <Button title="Delete account" icon="trash-outline" variant="dangerTonal" onPress={() => void reauthWithPassword()} loading={deleting} disabled={deleting || !password} fullWidth />
      </Sheet>

      <EmailVerificationPrompt
        visible={showVerificationPrompt}
        user={user}
        dismissible={verificationDaysLeft !== 0}
        onSkip={() => setShowVerificationPrompt(false)}
        onVerified={async () => {
          setShowVerificationPrompt(false);
          if (user) await clearEmailVerificationStart(user.uid);
          await loadVerificationStatus();
        }}
      />
    </View>
  );
}

/* ==============================
   PIECES
   ============================== */

/** kg / lb segmented switch; each half takes the tap across its box. */
function UnitSwitch({ unit, onChange }: { unit: "kg" | "lbs"; onChange: (u: "kg" | "lbs") => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Weight unit" style={{ flexDirection: "row", padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      {(["kg", "lbs"] as const).map((u) => {
        const on = unit === u;
        return (
          <Pressable
            key={u}
            onPress={() => onChange(u)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={u === "kg" ? "Kilograms" : "Pounds"}
            style={{ minWidth: size.control, minHeight: size.control - spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.accent : "transparent" }}
          >
            <Text style={[typography.labelLg, { color: on ? colors.onAccent : colors.textSecondary }]}>{u === "kg" ? "kg" : "lb"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProfileSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.screen, gap: spacing.xl }} accessibilityLabel="Loading profile">
      <SkeletonBlock height={size.appBar} radius="lg" />
      <SkeletonBlock height={size.goalCard * 1.8} radius="xl" />
      <SkeletonBlock height={size.exerciseRow * 4} radius="xl" />
      <SkeletonBlock height={size.exerciseRow * 3} radius="xl" />
    </View>
  );
}

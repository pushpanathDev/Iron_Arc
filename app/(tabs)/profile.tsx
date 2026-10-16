import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../providers/AuthContext";
import { EmailVerificationPrompt } from "../../components/auth/EmailVerificationPrompt";
import { AccentPreviewPicker } from "../../components/profile/AccentPreviewPicker";
import { ExportSheet } from "../../components/profile/ExportSheet";
import { GOALS } from "../../data/fitnessGoals";
import { ProfileEditSheets } from "../../components/profile/ProfileEditSheets";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { ReauthSheet } from "../../components/profile/ReauthSheet";
import { SettingsGroup, SettingsRow } from "../../components/profile/Settings";
import { ProfileStatus } from "../../components/profile/ProfileStatus";
import { OfflineState } from "../../components/ui";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Reveal } from "../../components/ui/Reveal";
import { verificationMessages } from "../../data/verificationMessages";
import { AVOID_OPTIONS, effectiveWeeklyGoal, EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, formatDays, SESSION_OPTIONS, type AvoidArea, type Weekday } from "../../data/trainingProfile";
import { useConnection } from "../../providers/ConnectionContext";
import { useAccountActions } from "../../hooks/useAccountActions";
import { useAchievements } from "../../hooks/useAchievements";
import { useEmailVerificationGrace } from "../../hooks/useEmailVerificationGrace";
import { useNotificationStatus } from "../../hooks/useNotificationStatus";
import { useProfileEditing } from "../../hooks/useProfileEditing";
import { usePlans } from "../../hooks/usePlan";
import { useProfile } from "../../hooks/useProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useLatestWeight } from "../../hooks/useWeights";
import { groupSessions, useWorkoutSummary } from "../../hooks/useWorkoutSummary";
import type { User } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { motion, radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { getVersionLabel } from "../../utils/appVersion";
import { getInitials } from "../../utils/avatar";
import { displayWeight, weightLabel } from "../../utils/unitConversion";
import { UnitSwitch } from "../../components/profile/UnitSwitch";
import { ProfileSkeleton } from "../../components/profile/ProfileSkeleton";
import { PERF_OPEN } from "../../components/onboarding/HeightRuler";
import { perfStart } from "../../utils/perf";

const NO_WORKOUTS: never[] = [];

const labelOf = <T,>(options: { value: T; label: string }[], v: T | null | undefined) => options.find((o) => o.value === v)?.label ?? null;

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user, profile: authProfile } = useAuth();
  const connection = useConnection();

  const { data: queriedProfile, isLoading, isError, error, refetch: refetchProfile } = useProfile();
  // Fall back to the profile AuthContext already has, so a slow server never leaves this spinning.
  const profile: User | undefined = queriedProfile ?? authProfile ?? undefined;
  const { data: latestWeightEntry } = useLatestWeight();
  const { unit, setUnit } = useUnitPreference();
  const goal = effectiveWeeklyGoal(profile);
  const { query: workoutsQuery, streak } = useWorkoutSummary(goal);
  const { data: achievements } = useAchievements();
  const { data: plans } = usePlans();

  const editing = useProfileEditing();
  const account = useAccountActions();
  const verification = useEmailVerificationGrace(user);
  const notifications = useNotificationStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirm, setConfirm] = useState<"logout" | "delete" | null>(null);

  const workouts = workoutsQuery.data ?? NO_WORKOUTS;
  const sessions = useMemo(() => groupSessions(workouts).length, [workouts]);
  const unlocked = achievements ? achievements.filter((a) => a.unlockedAt).length : null;
  const activePlan = plans?.find((p) => p.isActive) ?? null;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), verification.reload(), notifications.reload()]);
    } finally {
      setRefreshing(false);
    }
  };

  // States before the profile is available
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

  // Values
  const days = (profile.trainingDays ?? []) as Weekday[];
  const avoid = (profile.avoidAreas ?? []) as AvoidArea[];
  const goalTitle = GOALS.find((g) => g.id === profile.fitnessGoal)?.title ?? null;
  const latestKg = latestWeightEntry?.weight ?? profile.weight ?? null;
  const nameSource = profile.displayName || user?.displayName || profile.email || user?.email || "";
  const memberSince = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;
  const daysLeft = verification.daysLeft;
  const showVerifyBanner = !!user && !user.emailVerified && daysLeft !== null;

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
            savingName={editing.saving === "name"}
            onSaveName={(name) => editing.save("name", { displayName: name }, "Name")}
            onVerify={verification.openPrompt}
            onOpenBadges={() => router.push("/achievements")}
          />

          {showVerifyBanner && (
            <Pressable
              onPress={verification.openPrompt}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: daysLeft! > 0 ? colors.warning : colors.danger,
                backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
              })}
            >
              <MaterialIcons name="mark-email-unread" size={size.iconLg} color={daysLeft! > 0 ? colors.warning : colors.danger} />
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text style={[typography.bodyMdMedium, { color: colors.text }]}>
                  {daysLeft! > 0 ? verificationMessages.bannerTitleSoft(daysLeft!) : verificationMessages.bannerTitleHard}
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
              onPress={() => editing.edit("days")}
            />
            <SettingsRow icon="track-changes" label="Fitness goal" value={goalTitle ?? "Add"} missing={!goalTitle} kind="edit" onPress={() => editing.edit("goal")} />
            <SettingsRow
              icon="military-tech"
              label="Experience"
              value={labelOf(EXPERIENCE_OPTIONS, profile.experienceLevel) ?? "Add"}
              missing={!profile.experienceLevel}
              kind="edit"
              onPress={() => editing.edit("experience")}
            />
            <SettingsRow
              icon="timer"
              label="Session length"
              value={labelOf(SESSION_OPTIONS, profile.sessionMinutes) ?? "Add"}
              missing={!profile.sessionMinutes}
              kind="edit"
              onPress={() => editing.edit("session")}
            />
            <SettingsRow icon="fitness-center" label="Equipment" value={labelOf(EQUIPMENT_OPTIONS, profile.equipment) ?? "Add"} missing={!profile.equipment} kind="edit" onPress={() => editing.edit("equipment")} />
            <SettingsRow
              icon="healing"
              label="Go easy on"
              detail="Your plan avoids loading these heavily"
              value={avoid.length ? avoid.map((a) => labelOf(AVOID_OPTIONS, a)).join(", ") : "None"}
              kind="edit"
              onPress={() => editing.edit("avoid")}
            />
          </SettingsGroup>
        </Reveal>

        {/* Body */}
        <Reveal index={2}>
          <SettingsGroup title="Body">
            <SettingsRow
              icon="height"
              label="Height"
              value={profile.height ? `${profile.height} cm` : "Add"}
              missing={!profile.height}
              kind="edit"
              onPress={() => {
                perfStart(PERF_OPEN);
                editing.edit("height");
              }}
            />
            <SettingsRow icon="cake" label="Age" value={profile.age ? String(profile.age) : "Add"} missing={!profile.age} kind="edit" onPress={() => editing.edit("age")} />
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
              value={notifications.status ?? undefined}
              missing={notifications.status === "Not allowed"}
              onPress={() => router.push("/notification-settings")}
            />
          </SettingsGroup>
        </Reveal>

        {/* Account */}
        <Reveal index={5} style={{ gap: spacing.md }}>
          <SettingsGroup title="Account">
            <SettingsRow icon="ios-share" label="Export your data" detail="Workouts and body weight as CSV or PDF" kind="action" onPress={() => setExportOpen(true)} />
            <SettingsRow icon="logout" label="Log out" value={profile.displayName || undefined} kind="action" onPress={() => setConfirm("logout")} />
          </SettingsGroup>
          <SettingsGroup>
            <SettingsRow icon="delete-forever" label="Delete account" value="Irreversible" tone="danger" busy={account.deleting} kind="action" onPress={() => setConfirm("delete")} />
          </SettingsGroup>
        </Reveal>

        {/* Development builds only, for trying accent colours. */}
        {__DEV__ && <AccentPreviewPicker />}

        <Text style={[typography.labelSm, { color: colors.textMuted, textAlign: "center" }]}>Iron Arc {getVersionLabel()}</Text>
      </ScrollView>

      <ProfileEditSheets profile={profile} editing={editing} />

      <ExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} displayName={profile.displayName ?? ""} />

      <ConfirmDialog
        visible={confirm === "logout"}
        icon="logout"
        title="Log out?"
        message="Your workouts are saved to your account. Sign back in any time to pick up where you left off."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirm(null);
          void account.logOut();
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
          // After the dialog has closed: the password sheet opened mid-close can be dropped.
          setTimeout(() => void account.deleteAccount(), motion.modalSwapMs);
        }}
        onCancel={() => setConfirm(null)}
      />

      <ReauthSheet reauth={account.reauth} deleting={account.deleting} />

      <EmailVerificationPrompt
        visible={verification.promptOpen}
        user={user}
        dismissible={daysLeft !== 0}
        onSkip={verification.closePrompt}
        onVerified={verification.onVerified}
      />
    </View>
  );
}

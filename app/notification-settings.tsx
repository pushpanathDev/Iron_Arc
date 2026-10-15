import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { AppState, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsGroup, SettingsRow } from "../components/profile/Settings";
import { Button } from "../components/ui/Button";
import { Reveal } from "../components/ui/Reveal";
import { Sheet } from "../components/ui/Sheet";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { RepeatButton } from "../components/ui/Stepper";
import { Toggle } from "../components/ui/Toggle";
import { effectiveWeeklyGoal, WEEKDAYS } from "../data/trainingProfile";
import { useToast } from "../providers/ToastContext";
import { useProfile } from "../hooks/useProfile";
import { COPY, REST_MAX_SECONDS, REST_MIN_SECONDS, type NotificationType, type PlannedNotification } from "../notifications/notificationPlanner";
import {
  getNotificationPreferences,
  getPermissionState,
  getUpcomingNotifications,
  notificationsSupported,
  onScheduleChange,
  requestNotificationPermissions,
  sendTestNotification,
  setNotificationPreferences,
  type NotificationPreferences,
  type PermissionState,
} from "../notifications/notificationService";
import { useTheme } from "../theme/theme";
import { radius, size, spacing, tracking, typography } from "../theme/tokens";

type IconName = ComponentProps<typeof MaterialIcons>["name"];
type TimeKey = "dailyReminderTime" | "streakReminderTime" | "weighInTime";
type Section = "workout" | "progress" | "rest" | "weighin";

const TYPE_ICON: Record<NotificationType, IconName> = {
  daily_reminder: "fitness-center",
  goal_at_risk: "flag",
  inactivity: "replay",
  weekly_summary: "insights",
  weigh_in: "monitor-weight",
};
const REST_STEP_SECONDS = 15;
/** Default rest saves this long after the last step (holding + would otherwise save every tick). */
const REST_COMMIT_MS = 500;
const SAVED_BADGE_MS = 1500;
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

/** "09:00" → Date today at that time. */
const timeToDate = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(Number.isInteger(h) ? h : 9, Number.isInteger(m) ? m : 0, 0, 0);
  return d;
};
const showTime = (t: string) => timeToDate(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const toKey = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const whenLabel = (d: Date) => `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { data: profile } = useProfile();
  const supported = notificationsSupported();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [upcoming, setUpcoming] = useState<PlannedNotification[]>([]);
  const [preview, setPreview] = useState<Section>("workout");
  const [editingTime, setEditingTime] = useState<TimeKey | null>(null);
  const [iosTime, setIosTime] = useState<Date | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getNotificationPreferences().then(setPrefs);
    setUpcoming(getUpcomingNotifications());
    const off = onScheduleChange(() => setUpcoming(getUpcomingNotifications()));
    return () => {
      off();
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  // Re-read the permission whenever the screen shows or the app returns from phone settings.
  const refreshPermission = useCallback(() => void getPermissionState().then(setPermission), []);
  useFocusEffect(refreshPermission);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && refreshPermission());
    return () => sub.remove();
  }, [refreshPermission]);

  /** Instant save with a brief "Saved" badge; rolled back if it fails. */
  const save = async (updates: Partial<NotificationPreferences>) => {
    const previous = prefs;
    setPrefs((p) => (p ? { ...p, ...updates } : p));
    try {
      await setNotificationPreferences(updates);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), SAVED_BADGE_MS);
    } catch {
      setPrefs(previous);
      showToast({ type: "error", message: "Couldn't save that setting", subtitle: "Please try again." });
    }
  };

  const allow = async () => {
    // The system prompt may already have granted it: never send someone to settings for nothing.
    const now = await getPermissionState();
    setPermission(now);
    if (now.status === "granted") return;
    if (!now.canAskAgain) {
      showToast({ type: "info", message: "Turn on notifications for Iron Arc", subtitle: "In the page that opens: Notifications → Allow." });
      void Linking.openSettings();
      return;
    }
    await requestNotificationPermissions();
    refreshPermission();
  };

  const test = async () => {
    setTesting(true);
    try {
      const sent = await sendTestNotification();
      showToast(
        sent
          ? { type: "success", message: "Test on its way", subtitle: "Leave the app or lock the phone to see the pop-up in 5 seconds." }
          : { type: "error", message: "Couldn't send a test", subtitle: "Allow notifications first." },
      );
    } finally {
      setTesting(false);
    }
  };

  const pickTime = (key: TimeKey) => {
    if (!prefs) return;
    if (Platform.OS === "ios") setIosTime(timeToDate(prefs[key]));
    setEditingTime(key);
  };
  const onAndroidTime = (e: DateTimePickerEvent, d?: Date) => {
    const key = editingTime;
    setEditingTime(null);
    if (e.type === "set" && d && key) void save({ [key]: toKey(d) } as Partial<NotificationPreferences>);
  };

  /* ---------- derived ---------- */
  const granted = permission?.status === "granted";
  const blocked = !supported || !granted;
  const goal = effectiveWeeklyGoal(profile);
  const profileDays = profile?.trainingDays ?? [];
  const name = profile?.displayName?.trim().split(/\s+/)[0] ?? "";

  if (!prefs || !permission) {
    return (
      <Screen insets={insets} saved={false}>
        <View style={{ padding: spacing.screen, gap: spacing.xl }} accessibilityLabel="Loading notification settings">
          <SkeletonBlock height={size.goalCard} radius="xl" />
          <SkeletonBlock height={size.exerciseRow * 4} radius="xl" />
        </View>
      </Screen>
    );
  }

  const reminderDays = prefs.reminderDays ?? (profileDays.length ? profileDays : ALL_DAYS);
  const daysCaption = !prefs.reminderDays
    ? profileDays.length
      ? `Matches your ${profileDays.length} training days`
      : "Every day (no training days set in Profile)"
    : reminderDays.length === 0
      ? "No days chosen: no workout reminders"
      : profileDays.length && sameDays(reminderDays, profileDays)
        ? `Matches your ${profileDays.length} training days`
        : `${reminderDays.length} ${reminderDays.length === 1 ? "day" : "days"}${profileDays.length ? `, different from your ${profileDays.length} training days` : ""}`;
  const toggleReminderDay = (d: number) => {
    const next = reminderDays.includes(d) ? reminderDays.filter((x) => x !== d) : [...reminderDays, d].sort((a, b) => a - b);
    // Matching the profile again means "follow the profile" (so later changes there carry over).
    void save({ reminderDays: profileDays.length && sameDays(next, profileDays) ? null : next });
  };

  const progressOn = prefs.streakReminders || prefs.weeklySummary || prefs.inactivityReminders;
  const setProgress = (on: boolean) => void save({ streakReminders: on && !!goal, weeklySummary: on, inactivityReminders: on });

  const previewCopy =
    preview === "workout"
      ? COPY.daily_reminder(name)
      : preview === "progress"
        ? goal
          ? COPY.goal_at_risk(0, 1, goal)
          : COPY.weekly_summary(3, null)
        : preview === "rest"
          ? { title: "Rest over", body: "Next: Bench Press, set 3" }
          : COPY.weigh_in();

  return (
    <Screen insets={insets} saved={saved}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.lg }}>
        <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>Choose what Iron Arc reminds you about. We keep it light.</Text>

        {/* Permission: the one fix, when needed */}
        {blocked && (
          <Reveal index={0}>
            <PermissionBanner supported={supported} permission={permission} onAllow={() => void allow()} />
          </Reveal>
        )}

        {/* Live preview: exactly what arrives */}
        <Reveal index={1} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>Live preview</Text>
            <Text style={[typography.labelSm, { color: colors.textMuted }]}>{Platform.OS === "android" ? "Android notification shade" : "Notification banner"}</Text>
          </View>
          <PreviewCard title={previewCopy.title} body={previewCopy.body} />
        </Reveal>

        <View style={{ gap: spacing.lg, opacity: blocked ? 0.45 : 1 }} pointerEvents={blocked ? "none" : "auto"}>
          {/* 1. Workout reminders */}
          <Reveal index={2}>
            <SectionCard
              icon="fitness-center"
              title="Workout reminders"
              description="A nudge on the days you plan to train."
              on={prefs.dailyReminder}
              onToggle={() => void save({ dailyReminder: !prefs.dailyReminder })}
              onFocus={() => setPreview("workout")}
              focused={preview === "workout"}
            >
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <SubLabel>Training days</SubLabel>
                  {prefs.reminderDays && profileDays.length ? <LinkButton title="Use my plan days" onPress={() => void save({ reminderDays: null })} /> : null}
                </View>
                <DayChips value={reminderDays} onToggle={toggleReminderDay} />
                <Text style={[typography.labelSm, { color: colors.accent }]}>{daysCaption}</Text>
              </View>
              <ValueRow label="Reminder time">
                <TimePill time={prefs.dailyReminderTime} onPress={() => pickTime("dailyReminderTime")} label="Reminder time" />
              </ValueRow>
              <ValueRow label="Skip if I've already trained today">
                <Toggle value={prefs.skipIfTrained} onChange={() => void save({ skipIfTrained: !prefs.skipIfTrained })} accessibilityLabel="Skip if I've already trained today" />
              </ValueRow>
            </SectionCard>
          </Reveal>

          {/* 2. Progress */}
          <Reveal index={3}>
            <SectionCard
              icon="insights"
              title="Progress"
              description="Only when it matters. Never more than one nudge a day."
              on={progressOn}
              onToggle={() => setProgress(!progressOn)}
              onFocus={() => setPreview("progress")}
              focused={preview === "progress"}
            >
              <CheckRow
                label="Weekly goal check"
                detail={goal ? `On the day your ${goal}-day goal needs a workout` : "Set training days in Profile to use this"}
                checked={prefs.streakReminders && !!goal}
                disabled={!goal}
                onToggle={() => void save({ streakReminders: !prefs.streakReminders })}
                trailing={prefs.streakReminders && goal ? <TimePill time={prefs.streakReminderTime} onPress={() => pickTime("streakReminderTime")} label="Weekly goal check time" /> : null}
              />
              <CheckRow label="Sunday review" detail={`Sunday ${showTime(prefs.weeklySummaryTime)}, your week's numbers`} checked={prefs.weeklySummary} onToggle={() => void save({ weeklySummary: !prefs.weeklySummary })} />
              <CheckRow label="Comeback nudge" detail={`After 3 days without a workout, ${showTime(prefs.inactivityReminderTime)}`} checked={prefs.inactivityReminders} onToggle={() => void save({ inactivityReminders: !prefs.inactivityReminders })} />
            </SectionCard>
          </Reveal>

          {/* 3. Rest timer */}
          <Reveal index={4}>
            <SectionCard
              icon="timer"
              title="Rest timer"
              description="Alerts when rest is over, even with the app closed."
              on={prefs.restTimerAlert}
              onToggle={() => void save({ restTimerAlert: !prefs.restTimerAlert })}
              onFocus={() => setPreview("rest")}
              focused={preview === "rest"}
              alwaysOpen
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyMdMedium, { color: colors.text }]}>Default rest</Text>
                  <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
                    Range {clock(REST_MIN_SECONDS)}–{clock(REST_MAX_SECONDS)}
                  </Text>
                </View>
                <RestStepper value={prefs.restDefaultSeconds} onChange={(v) => void save({ restDefaultSeconds: v })} />
              </View>
              <ValueRow label="Vibrate">
                <Toggle value={prefs.restVibrate} onChange={() => void save({ restVibrate: !prefs.restVibrate })} accessibilityLabel="Vibrate when rest ends" />
              </ValueRow>
              <ValueRow label="Sound">
                <Toggle value={prefs.restSound} onChange={() => void save({ restSound: !prefs.restSound })} disabled={!prefs.restTimerAlert} accessibilityLabel="Sound when rest ends" />
              </ValueRow>
            </SectionCard>
          </Reveal>

          {/* 4. Weigh-in */}
          <Reveal index={5}>
            <SectionCard
              icon="monitor-weight"
              title="Weigh-in reminder"
              description="A gentle morning reminder to log your weight."
              on={prefs.weighIn}
              onToggle={() => void save({ weighIn: !prefs.weighIn })}
              onFocus={() => setPreview("weighin")}
              focused={preview === "weighin"}
            >
              <View style={{ gap: spacing.sm }}>
                <SubLabel>Weigh-in days</SubLabel>
                <DayChips
                  value={prefs.weighInDays}
                  onToggle={(d) => void save({ weighInDays: prefs.weighInDays.includes(d) ? prefs.weighInDays.filter((x) => x !== d) : [...prefs.weighInDays, d].sort((a, b) => a - b) })}
                />
                <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Skipped on days you&apos;ve already logged a weight.</Text>
              </View>
              <ValueRow label="Reminder time">
                <TimePill time={prefs.weighInTime} onPress={() => pickTime("weighInTime")} label="Weigh-in time" />
              </ValueRow>
            </SectionCard>
          </Reveal>

          {/* What's actually scheduled */}
          <Reveal index={6}>
            <SettingsGroup title="Coming up" note="Next 3 on your phone">
              {upcoming.length === 0 ? (
                <SettingsRow icon="event-available" label="Nothing scheduled" detail="New reminders appear as their days come up." />
              ) : (
                upcoming.map((n) => <SettingsRow key={n.id} icon={TYPE_ICON[n.type]} label={n.title} detail={whenLabel(n.date)} />)
              )}
            </SettingsGroup>
          </Reveal>

          {Platform.OS === "android" && (
            <Reveal index={7}>
              <SettingsGroup title="If reminders are late or silent">
                <SettingsRow icon="tune" label="Pop-up and sound" detail="Phone settings → Notifications → Workout Reminders" onPress={() => void Linking.openSettings()} />
                <SettingsRow icon="battery-saver" label="Battery optimisation" detail="Let Iron Arc run in the background" onPress={() => void Linking.openSettings()} />
              </SettingsGroup>
            </Reveal>
          )}

          <View style={{ gap: spacing.sm }}>
            <Button title="Send a test notification" icon="send" variant="tonal" onPress={() => void test()} loading={testing} disabled={testing || blocked} fullWidth />
            <Text style={[typography.labelSm, { color: colors.textMuted, textAlign: "center" }]}>You can change these anytime.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Time pickers: Android shows its own dialog; iOS a wheel in a sheet */}
      {Platform.OS === "android" && editingTime && <DateTimePicker value={timeToDate(prefs[editingTime])} mode="time" onChange={onAndroidTime} />}
      {Platform.OS === "ios" && (
        <Sheet visible={!!editingTime} onClose={() => setEditingTime(null)} title="Reminder time">
          {iosTime && <DateTimePicker value={iosTime} mode="time" display="spinner" onChange={(_, d) => d && setIosTime(d)} />}
          <Button
            title="Save"
            icon="checkmark"
            onPress={() => {
              if (editingTime && iosTime) void save({ [editingTime]: toKey(iosTime) } as Partial<NotificationPreferences>);
              setEditingTime(null);
            }}
            fullWidth
          />
        </Sheet>
      )}
    </Screen>
  );
}

// Pieces

/** Header (back, title, "Saved" badge) around the content. */
function Screen({ insets, saved, children }: { insets: { top: number }; saved: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingLeft: spacing.xs, paddingRight: spacing.screen }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({ width: size.control, height: size.control, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.text} />
        </Pressable>
        <Text style={[typography.headlineMd, { flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
          Notifications
        </Text>
        {saved && (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.accentSubtle }}>
            <MaterialIcons name="check" size={size.iconXs} color={colors.accent} />
            <Text style={[typography.labelSm, { color: colors.accent }]}>Saved</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

/** "Turn on notifications" (not asked) / "Notifications are off" (blocked) / not supported here. */
function PermissionBanner({ supported, permission, onAllow }: { supported: boolean; permission: PermissionState; onAllow: () => void }) {
  const { colors } = useTheme();
  const notAsked = permission.status === "undetermined" || permission.canAskAgain;
  const s = !supported
    ? { icon: "info-outline" as IconName, tint: colors.textSecondary, title: "Reminders need the installed app", body: "They don't run in Expo Go or on a simulator.", action: null }
    : notAsked
      ? { icon: "notifications" as IconName, tint: colors.accent, title: "Turn on notifications", body: "Get workout reminders and rest alerts.", action: "Allow" }
      : { icon: "notifications-off" as IconName, tint: colors.warning, title: "Notifications are off for Iron Arc", body: "Turn them on in your phone's settings to get reminders.", action: "Open settings" };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised, borderWidth: 1, borderColor: s.tint === colors.warning ? colors.warning : colors.accentSubtle }}>
      <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
        <MaterialIcons name={s.icon} size={size.iconLg} color={s.tint} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{s.title}</Text>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{s.body}</Text>
      </View>
      {s.action ? <Button title={s.action} onPress={onAllow} variant={notAsked ? "primary" : "tonal"} /> : null}
    </View>
  );
}

/** Mimics the Android shade: app tile, "Iron Arc · now", title and body. */
function PreviewCard({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Preview: ${title}. ${body}`}
      style={{ flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSubtle }}>
        <MaterialIcons name="fitness-center" size={size.iconSm} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Iron Arc · now</Text>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{title}</Text>
        <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

/** A reminder type: icon, title, description and switch; its settings show while it's on. */
function SectionCard({
  icon,
  title,
  description,
  on,
  onToggle,
  onFocus,
  focused,
  alwaysOpen,
  children,
}: {
  icon: IconName;
  title: string;
  description: string;
  on: boolean;
  onToggle: () => void;
  onFocus: () => void;
  focused: boolean;
  alwaysOpen?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const open = on || alwaysOpen;
  return (
    <View style={{ borderRadius: radius.xl, backgroundColor: colors.raised, borderWidth: 1, borderColor: focused ? colors.accentSubtle : "transparent", overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
        <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
          <MaterialIcons name={icon} size={size.icon} color={on ? colors.accent : colors.textSecondary} />
        </View>
        {/* Tapping the text previews this reminder */}
        <Pressable onPress={onFocus} accessibilityRole="button" accessibilityLabel={`${title}. ${description}`} accessibilityHint="Shows it in the preview" style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>{title}</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{description}</Text>
        </Pressable>
        <Toggle value={on} onChange={onToggle} accessibilityLabel={title} />
      </View>
      {open && <View style={{ gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.md, borderTopWidth: size.divider, borderTopColor: colors.surfaceContainerHigh }}>{children}</View>}
    </View>
  );
}

function SubLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>{children}</Text>;
}

function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={spacing.sm} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Text style={[typography.labelLg, { color: colors.accent }]}>{title}</Text>
    </Pressable>
  );
}

/** Label on the left, control on the right. */
function ValueRow({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ minHeight: size.control, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
      <Text style={[typography.bodyMd, { flex: 1, color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

/** Monday-first day circles; the whole circle takes the tap. */
function DayChips({ value, onToggle }: { value: number[]; onToggle: (day: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.xs }}>
      {WEEKDAYS.map((d) => {
        const on = value.includes(d.value);
        return (
          <Pressable
            key={d.value}
            onPress={() => onToggle(d.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={d.long}
            style={({ pressed }) => ({
              flex: 1,
              maxWidth: size.control,
              aspectRatio: 1,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? colors.accent : pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
            })}
          >
            <Text style={[typography.labelLg, { color: on ? colors.onAccent : colors.textSecondary }]}>{d.short.charAt(0)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TimePill({ time, onPress, label }: { time: string; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${showTime(time)}`}
      accessibilityHint="Change the time"
      hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
      })}
    >
      <MaterialIcons name="schedule" size={size.iconSm} color={colors.accent} />
      <Text style={[typography.labelLg, { color: colors.accent }]}>{showTime(time)}</Text>
    </Pressable>
  );
}

/** Checkbox row; the whole row takes the tap. */
function CheckRow({ label, detail, checked, disabled, onToggle, trailing }: { label: string; detail: string; checked: boolean; disabled?: boolean; onToggle: () => void; trailing?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, opacity: disabled ? 0.45 : 1 }}>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={`${label}. ${detail}`}
        style={{ flex: 1, minHeight: size.control, flexDirection: "row", alignItems: "center", gap: spacing.md }}
      >
        <MaterialIcons name={checked ? "check-box" : "check-box-outline-blank"} size={size.iconLg} color={checked ? colors.accent : colors.textMuted} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{label}</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{detail}</Text>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

/** − 1:30 + in 15-second steps; hold to repeat. Shows each step at once, saves once you stop. */
function RestStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const commit = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    shownRef.current = value;
    setShown(value);
  }, [value]);
  useEffect(() => () => void (commit.current && clearTimeout(commit.current)), []);

  const step = (dir: 1 | -1) => {
    const next = Math.min(REST_MAX_SECONDS, Math.max(REST_MIN_SECONDS, shownRef.current + dir * REST_STEP_SECONDS));
    shownRef.current = next;
    setShown(next);
    if (commit.current) clearTimeout(commit.current);
    commit.current = setTimeout(() => onChange(shownRef.current), REST_COMMIT_MS);
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      <RepeatButton icon="remove" onStep={() => step(-1)} label="Less rest" />
      <Text style={[typography.headlineSm, { minWidth: size.control, textAlign: "center", color: colors.text, fontVariant: ["tabular-nums"] }]} accessibilityLabel={`Default rest ${clock(shown)}`}>
        {clock(shown)}
      </Text>
      <RepeatButton icon="add" onStep={() => step(1)} label="More rest" />
    </View>
  );
}

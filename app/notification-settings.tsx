import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useCallback, useRef, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MaterialIconName } from "../components/ui/iconName";
import { DayChips, TimePill, RestStepper } from "../components/notifications/SettingInputs";
import { PermissionBanner } from "../components/notifications/PermissionBanner";
import { PreviewCard } from "../components/notifications/PreviewCard";
import { SectionCard, SubLabel, LinkButton, ValueRow, CheckRow } from "../components/notifications/SectionCard";
import { SettingsFrame } from "../components/notifications/SettingsFrame";
import { timeToDate, showTime, toKey, clock } from "../components/notifications/settingsTime";
import { SettingsGroup, SettingsRow } from "../components/profile/Settings";
import { Button } from "../components/ui/Button";
import { Reveal } from "../components/ui/Reveal";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { Toggle } from "../components/ui/Toggle";
import { effectiveWeeklyGoal } from "../data/trainingProfile";
import { useNotificationSettings } from "../hooks/useNotificationSettings";
import { useProfile } from "../hooks/useProfile";
import { COPY, REST_MAX_SECONDS, REST_MIN_SECONDS, type NotificationType } from "../notifications/notificationPlanner";
import type { NotificationPreferences } from "../notifications/notificationService";
import { useTheme } from "../theme/theme";
import { size, spacing, tracking, typography } from "../theme/tokens";
import { ThemedDateTimePicker } from "../components/ui/ThemedDateTimePicker";

type TimeKey = "dailyReminderTime" | "streakReminderTime" | "weighInTime";
type Section = "workout" | "progress" | "rest" | "weighin";

const TYPE_ICON: Record<NotificationType, MaterialIconName> = {
  daily_reminder: "fitness-center",
  goal_at_risk: "flag",
  inactivity: "replay",
  weekly_summary: "insights",
  weigh_in: "monitor-weight",
};
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

const whenLabel = (d: Date) => `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { supported, prefs, permission, upcoming, saved, testing, save, allow, test } = useNotificationSettings();
  const [preview, setPreview] = useState<Section>("workout");
  // The time dialog opens on the saved time. Its value and onChange stay the same while it is
  // open: the Android dialog reopens when either changes, which lost the time you picked.
  const [timePicker, setTimePicker] = useState<Date | null>(null);
  const timeKey = useRef<TimeKey | null>(null);

  const pickTime = (key: TimeKey) => {
    if (!prefs) return;
    timeKey.current = key;
    setTimePicker(timeToDate(prefs[key]));
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  const onTimePicked = useCallback((e: DateTimePickerEvent, d?: Date) => {
    const key = timeKey.current;
    setTimePicker(null);
    if (e.type === "set" && d && key) void saveRef.current({ [key]: toKey(d) } as Partial<NotificationPreferences>);
  }, []);

  // Derived
  const granted = permission?.status === "granted";
  const blocked = !supported || !granted;
  const goal = effectiveWeeklyGoal(profile);
  const profileDays = profile?.trainingDays ?? [];
  const name = profile?.displayName?.trim().split(/\s+/)[0] ?? "";

  if (!prefs || !permission) {
    return (
      <SettingsFrame insets={insets} saved={false}>
        <View style={{ padding: spacing.screen, gap: spacing.xl }} accessibilityLabel="Loading notification settings">
          <SkeletonBlock height={size.goalCard} radius="xl" />
          <SkeletonBlock height={size.exerciseRow * 4} radius="xl" />
        </View>
      </SettingsFrame>
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
    <SettingsFrame insets={insets} saved={saved}>
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
            <Text style={[typography.labelSm, { color: colors.textMuted }]}>Android notification shade</Text>
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

          <Reveal index={7}>
            <SettingsGroup title="If reminders are late or silent">
              <SettingsRow icon="tune" label="Pop-up and sound" detail="Phone settings → Notifications → Workout Reminders" onPress={() => void Linking.openSettings()} />
              <SettingsRow icon="battery-saver" label="Battery optimisation" detail="Let Iron Arc run in the background" onPress={() => void Linking.openSettings()} />
            </SettingsGroup>
          </Reveal>

          <View style={{ gap: spacing.sm }}>
            <Button title="Send a test notification" icon="send" variant="tonal" onPress={() => void test()} loading={testing} disabled={testing || blocked} fullWidth />
            <Text style={[typography.labelSm, { color: colors.textMuted, textAlign: "center" }]}>You can change these anytime.</Text>
          </View>
        </View>
      </ScrollView>

      {timePicker && <ThemedDateTimePicker value={timePicker} mode="time" onChange={onTimePicked} />}
    </SettingsFrame>
  );
}

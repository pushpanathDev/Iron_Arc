import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../theme/theme";
import {
  getNotificationPreferences,
  NotificationPreferences,
  requestNotificationPermissions,
  setNotificationPreferences,
} from "../notifications/notificationService";

type BooleanPreferenceKey =
  | "enabled"
  | "dailyReminder"
  | "streakReminders"
  | "inactivityReminders"
  | "weeklySummary"
  | "motivationalMessages";
type TimePreferenceKey = "dailyReminderTime" | "quietHoursStart" | "quietHoursEnd";

function SettingRow({
  icon,
  iconColor,
  iconBg,
  label,
  description,
  value,
  onToggle,
  disabled,
  colors,
  spacing,
  radius,
  typography,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: iconBg, justifyContent: "center", alignItems: "center", marginRight: spacing.md }}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{label}</Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
        thumbColor={Platform.OS === "android" ? (value ? "#fff" : colors.textMuted) : undefined}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { colors, spacing, radius, shadows, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [editingTime, setEditingTime] = useState<TimePreferenceKey | null>(null);

  useEffect(() => {
    void getNotificationPreferences().then(setPrefs);
  }, []);

  const save = async (updates: Partial<NotificationPreferences>) => {
    setSaving(true);
    try {
      await setNotificationPreferences(updates);
      setPrefs((current) => current ? { ...current, ...updates } : current);
      showToast({ message: "Settings saved", type: "success" });
    } catch {
      showToast({ message: "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: BooleanPreferenceKey) => (value: boolean) => {
    void save({ [key]: value });
  };

  const parseTime = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(Number.isInteger(hour) ? hour : 9, Number.isInteger(minute) ? minute : 0, 0, 0);
    return date;
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setEditingTime(null);
    if (!selected || !editingTime) return;
    const value = `${selected.getHours().toString().padStart(2, "0")}:${selected.getMinutes().toString().padStart(2, "0")}`;
    void save({ [editingTime]: value } as Partial<NotificationPreferences>);
  };

  const requestPermission = async () => {
    const granted = await requestNotificationPermissions();
    setPermissionGranted(granted);
    if (granted) {
      showToast({ message: "Notifications enabled", type: "success" });
    } else {
      showToast({ message: "Permission denied. You can enable it in system settings.", type: "warning" });
    }
  };

  if (!prefs) {
    return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={colors.accent} /></View>;
  }

  const timeButton = (key: TimePreferenceKey, label: string) => (
    <Pressable
      onPress={() => setEditingTime(key)}
      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm }}
    >
      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{label}</Text>
      <Text style={{ ...typography.bodyMedium, color: colors.accent }}>{prefs[key]}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View entering={FadeInDown.duration(300)} style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + spacing.sm, paddingBottom: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing.md, padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ ...typography.h3, color: colors.textPrimary, flex: 1 }}>Notification Settings</Text>
        {saving && <ActivityIndicator size="small" color={colors.accent} />}
      </Animated.View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={{ backgroundColor: colors.accentLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>Thoughtful reminders, not noise.</Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
            Iron Arc sends at most one notification per day, respects quiet hours, and schedules up to 14 days ahead. Open the app occasionally to extend the schedule.
          </Text>
        </View>

        {permissionGranted !== true && (
          <View style={{ backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
            <Text style={{ ...typography.bodyMedium, color: colors.warning }}>Allow notifications to receive reminders.</Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm }}>
              You will see the system permission prompt only after choosing Enable below.
            </Text>
            <Pressable onPress={requestPermission} style={{ alignSelf: "flex-start", backgroundColor: colors.warning, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Enable</Text>
            </Pressable>
          </View>
        )}

        <Animated.View entering={FadeInUp.delay(50).duration(350)} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm }}>
          <SettingRow icon="notifications" iconColor={colors.accent} iconBg={colors.accentLight} label="All Notifications" description="Master toggle" value={prefs.enabled} onToggle={toggle("enabled")} colors={colors} spacing={spacing} radius={radius} typography={typography} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(350)} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm }}>
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>REMINDERS</Text>
          <SettingRow icon="alarm-outline" iconColor={colors.accent} iconBg={colors.accentLight} label="Daily Workout Reminder" description={`Daily reminder at ${prefs.dailyReminderTime}`} value={prefs.dailyReminder} onToggle={toggle("dailyReminder")} disabled={!prefs.enabled} colors={colors} spacing={spacing} radius={radius} typography={typography} />
          {prefs.dailyReminder && prefs.enabled && (
            <>{timeButton("dailyReminderTime", "Reminder time")}</>
          )}
          <SettingRow icon="flame-outline" iconColor={colors.warning} iconBg={colors.warningLight} label="Streak at Risk" description="Evening nudge when today's workout is missing" value={prefs.streakReminders} onToggle={toggle("streakReminders")} disabled={!prefs.enabled} colors={colors} spacing={spacing} radius={radius} typography={typography} />
          <SettingRow icon="return-down-forward-outline" iconColor={colors.secondary} iconBg={colors.secondaryLight} label="Inactivity Nudge" description="Check-in after about three days without a workout" value={prefs.inactivityReminders} onToggle={toggle("inactivityReminders")} disabled={!prefs.enabled} colors={colors} spacing={spacing} radius={radius} typography={typography} />
          <SettingRow icon="stats-chart-outline" iconColor={colors.accent} iconBg={colors.accentLight} label="Weekly Progress Summary" description="Sunday evening progress check" value={prefs.weeklySummary} onToggle={toggle("weeklySummary")} disabled={!prefs.enabled} colors={colors} spacing={spacing} radius={radius} typography={typography} />
          <SettingRow icon="sparkles-outline" iconColor={colors.success} iconBg={colors.successLight} label="Motivational Messages" description="Two varied messages per week" value={prefs.motivationalMessages} onToggle={toggle("motivationalMessages")} disabled={!prefs.enabled} colors={colors} spacing={spacing} radius={radius} typography={typography} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150).duration(350)} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm }}>
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>QUIET HOURS</Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm }}>Scheduled notifications move to the next permitted time.</Text>
          {timeButton("quietHoursStart", "Start")}
          {timeButton("quietHoursEnd", "End")}
        </Animated.View>

        {editingTime && (
          <DateTimePicker
            value={parseTime(prefs[editingTime])}
            mode="time"
            is24Hour={false}
            display={Platform.OS === "ios" ? "spinner" : "clock"}
            onChange={handleTimeChange}
            themeVariant={isDark ? "dark" : "light"}
          />
        )}
        {Platform.OS === "ios" && editingTime && (
          <Pressable onPress={() => setEditingTime(null)} style={{ alignSelf: "flex-end", backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Done</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

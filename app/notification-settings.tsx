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

interface SettingRowProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
}

function SettingRow({
  icon,
  iconColor,
  iconBg,
  label,
  description,
  value,
  onToggle,
  disabled = false,
  colors,
  spacing,
  radius,
  typography,
}: SettingRowProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.md,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: iconBg,
          justifyContent: "center",
          alignItems: "center",
          marginRight: spacing.md,
        }}
      >
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
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Convert "HH:MM" string → Date object for DateTimePicker
  const timeStringToDate = (timeStr: string): Date => {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
    return d;
  };

  useEffect(() => {
    (async () => {
      const p = await getNotificationPreferences();
      setPrefs(p);
    })();
  }, []);

  const save = async (updates: Partial<NotificationPreferences>) => {
    setSaving(true);
    try {
      await setNotificationPreferences(updates);
      setPrefs((prev) => prev ? { ...prev, ...updates } : prev);
      showToast({ message: "Settings saved", type: "success" });
    } catch {
      showToast({ message: "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof NotificationPreferences) => (value: boolean) => {
    save({ [key]: value });
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermissions();
    setPermissionGranted(granted);
    if (granted) {
      showToast({ message: "Notifications enabled!", type: "success" });
    } else {
      showToast({ message: "Permission denied. Open Settings to enable.", type: "warning" });
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (selected) {
      const h = selected.getHours().toString().padStart(2, "0");
      const m = selected.getMinutes().toString().padStart(2, "0");
      save({ dailyReminderTime: `${h}:${m}` });
    }
  };

  if (!prefs) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.cardBorder,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing.md, padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ ...typography.h3, color: colors.textPrimary, flex: 1 }}>
          Notification Settings
        </Text>
        {saving && <ActivityIndicator size="small" color={colors.accent} />}
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
      >
        {/* Permission banner */}
        {permissionGranted === false && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={{
              backgroundColor: colors.warningLight,
              borderRadius: radius.xl,
              padding: spacing.md,
              marginBottom: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.warning + "40",
            }}
          >
            <Ionicons name="warning-outline" size={20} color={colors.warning} style={{ marginRight: spacing.sm }} />
            <Text style={{ flex: 1, ...typography.body, color: colors.warning }}>
              Notification permission not granted. Tap to enable.
            </Text>
            <Pressable
              onPress={handleRequestPermission}
              style={{
                backgroundColor: colors.warning,
                borderRadius: radius.md,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Enable</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Master toggle */}
        <Animated.View
          entering={FadeInUp.delay(50).duration(350)}
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
          <SettingRow
            icon="notifications"
            iconColor={colors.accent}
            iconBg={colors.accentLight}
            label="All Notifications"
            description="Master toggle — disables everything when off"
            value={prefs.enabled}
            onToggle={toggle("enabled")}
            colors={colors}
            spacing={spacing}
            radius={radius}
            typography={typography}
          />
        </Animated.View>

        {/* Reminders section */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(350)}
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
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>
            REMINDERS
          </Text>

          <SettingRow
            icon="alarm-outline"
            iconColor={colors.accent}
            iconBg={colors.accentLight}
            label="Daily Workout Reminder"
            description={`Reminds you to log a workout each day at ${prefs.dailyReminderTime}`}
            value={prefs.dailyReminder}
            onToggle={toggle("dailyReminder")}
            disabled={!prefs.enabled}
            colors={colors}
            spacing={spacing}
            radius={radius}
            typography={typography}
          />

          {/* Time picker */}
          {prefs.dailyReminder && prefs.enabled && (
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginTop: spacing.xs,
              }}
            >
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm }}>
                Reminder time
              </Text>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  alignSelf: "flex-start",
                  gap: spacing.sm,
                }}
              >
                <Ionicons name="time-outline" size={20} color={colors.accent} />
                <Text style={{ ...typography.h3, color: colors.textPrimary }}>
                  {prefs.dailyReminderTime}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </Pressable>

              {showTimePicker && (
                <DateTimePicker
                  value={timeStringToDate(prefs.dailyReminderTime)}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === "ios" ? "spinner" : "clock"}
                  onChange={handleTimeChange}
                  themeVariant={isDark ? "dark" : "light"}
                />
              )}

              {Platform.OS === "ios" && showTimePicker && (
                <Pressable
                  onPress={() => setShowTimePicker(false)}
                  style={{
                    marginTop: spacing.sm,
                    alignSelf: "flex-end",
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    backgroundColor: colors.accent,
                    borderRadius: radius.md,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Done</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: spacing.xs }} />

          <SettingRow
            icon="flame-outline"
            iconColor={colors.warning}
            iconBg={colors.warningLight}
            label="Streak Warnings"
            description="Alert if you haven't trained and your streak is at risk"
            value={prefs.streakReminders}
            onToggle={toggle("streakReminders")}
            disabled={!prefs.enabled}
            colors={colors}
            spacing={spacing}
            radius={radius}
            typography={typography}
          />

          <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: spacing.xs }} />

          <SettingRow
            icon="stats-chart-outline"
            iconColor={colors.secondary}
            iconBg={colors.secondaryLight}
            label="Weekly Summary"
            description="Sunday evening recap of your weekly performance"
            value={prefs.weeklySummary}
            onToggle={toggle("weeklySummary")}
            disabled={!prefs.enabled}
            colors={colors}
            spacing={spacing}
            radius={radius}
            typography={typography}
          />
        </Animated.View>

        {/* Achievements & motivation */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(350)}
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
          <Text style={{ ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }}>
            ACHIEVEMENTS & MOTIVATION
          </Text>

          <SettingRow
            icon="trophy-outline"
            iconColor={colors.warning}
            iconBg={colors.warningLight}
            label="Achievement Unlocks"
            description="Celebrate when you hit a new milestone or PR"
            value={prefs.achievements}
            onToggle={toggle("achievements")}
            disabled={!prefs.enabled}
            colors={colors}
            spacing={spacing}
            radius={radius}
            typography={typography}
          />

          <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: spacing.xs }} />

          <SettingRow
            icon="sunny-outline"
            iconColor={colors.success}
            iconBg={colors.successLight}
            label="Motivational Quotes"
            description="Morning + evening motivational messages"
            value={prefs.motivationalQuotes}
            onToggle={toggle("motivationalQuotes")}
            disabled={!prefs.enabled}
            colors={colors}
            spacing={spacing}
            radius={radius}
            typography={typography}
          />
        </Animated.View>

      </ScrollView>
    </View>
  );
}

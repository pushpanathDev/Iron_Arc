import { MaterialIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { effectiveWeeklyGoal } from "../../data/trainingProfile";
import { useCustomArms } from "../../hooks/useExercises";
import { useProfile } from "../../hooks/useProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useAllWorkouts } from "../../hooks/useWorkouts";
import { useToast } from "../../providers/ToastContext";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { formatDate } from "../../utils/dates";
import { exportReport, type ReportFormat } from "../../utils/report/exportReport";
import { monthAtAGlance, monthName, reportMonths } from "../../utils/report/reportData";
import { IconButton } from "../ui/IconButton";
import type { MaterialIconName } from "../ui/iconName";
import { Sheet } from "../ui/Sheet";

const FORMATS: { format: ReportFormat; icon: MaterialIconName; title: string; detail: string }[] = [
  { format: "pdf", icon: "picture-as-pdf", title: "Report", detail: "PDF · 3 pages" },
  { format: "xlsx", icon: "table-chart", title: "Spreadsheet", detail: "Excel · 4 sheets" },
];

/** Monthly report as a PDF or an Excel spreadsheet (History header, Profile → Account). */
export function ExportSheet({ visible, onClose, displayName }: { visible: boolean; onClose: () => void; displayName: string }) {
  const { showToast } = useToast();
  const { unit } = useUnitPreference();
  const profile = useProfile().data;
  const workouts = useAllWorkouts().data;
  const customArms = useCustomArms();
  const [exporting, setExporting] = useState<ReportFormat | null>(null);

  // Newest first: index 0 is this month, higher indexes go back in time.
  const todayKey = formatDate(new Date());
  const months = useMemo(() => reportMonths(workouts ?? [], todayKey), [workouts, todayKey]);
  const [index, setIndex] = useState(0);
  const at = Math.min(index, months.length - 1);
  const month = months[at];

  const run = async (format: ReportFormat) => {
    setExporting(format);
    try {
      await exportReport(format, {
        month,
        fullName: displayName || profile?.displayName || "",
        weeklyGoal: effectiveWeeklyGoal(profile),
        goalWeightKg: profile?.targetWeight ?? null,
        unit,
        customArms,
      });
      onClose();
    } catch (e) {
      showToast({ type: "error", message: "Export failed", subtitle: e instanceof Error ? e.message : "Try again in a moment." });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={exporting ? undefined : onClose} title="Monthly report" subtitle="Your training, body weight and badges for one month, to keep or share.">
      <View style={{ gap: spacing.md }}>
        <MonthStepper
          month={month}
          isThisMonth={month === todayKey.slice(0, 7)}
          glance={monthAtAGlance(workouts ?? [], month)}
          onOlder={at < months.length - 1 && !exporting ? () => setIndex(at + 1) : undefined}
          onNewer={at > 0 && !exporting ? () => setIndex(at - 1) : undefined}
        />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          {FORMATS.map((f) => (
            <FormatTile key={f.format} {...f} busy={exporting === f.format} disabled={!!exporting} onPress={() => void run(f.format)} />
          ))}
        </View>
      </View>
    </Sheet>
  );
}

/** ‹ October 2026 › with what the month holds underneath. Arrows step through months you trained. */
function MonthStepper({ month, isThisMonth, glance, onOlder, onNewer }: { month: string; isThisMonth: boolean; glance: { workouts: number; days: number }; onOlder?: () => void; onNewer?: () => void }) {
  const { colors } = useTheme();
  const name = monthName(month);
  const summary = glance.workouts
    ? `${glance.workouts} ${glance.workouts === 1 ? "workout" : "workouts"} · ${glance.days} ${glance.days === 1 ? "day" : "days"} trained${isThisMonth ? " so far" : ""}`
    : isThisMonth
      ? "No workouts yet this month"
      : "No workouts this month";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs, borderRadius: radius.xl, backgroundColor: colors.raised }}>
      <IconButton icon="chevron-left" label="Earlier month" strong disabled={!onOlder} onPress={() => onOlder?.()} />
      <View style={{ flex: 1, alignItems: "center", gap: spacing.xxs }} accessible accessibilityLabel={`${name}. ${summary}`} accessibilityLiveRegion="polite">
        <Text style={[typography.headlineSm, { color: colors.text }]}>{isThisMonth ? `This month · ${name.split(" ")[0]}` : name}</Text>
        <Text style={[typography.labelSm, { color: glance.workouts ? colors.textSecondary : colors.textMuted }]}>{summary}</Text>
      </View>
      <IconButton icon="chevron-right" label="Later month" strong disabled={!onNewer} onPress={() => onNewer?.()} />
    </View>
  );
}

/** One export format: icon, name and what you get. The whole area takes the tap. */
function FormatTile({ icon, title, detail, busy, disabled, onPress }: { icon: MaterialIconName; title: string; detail: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.xl,
        // No card: just the icon and its label, with a soft fill while pressed.
        backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
        opacity: disabled && !busy ? 0.5 : 1,
      })}
    >
      {/* The Settings rows' icon tile, at full control size since it's the whole visual. */}
      <View style={{ width: size.control, height: size.control, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
        {busy ? <ActivityIndicator size="small" color={colors.accent} /> : <MaterialIcons name={icon} size={size.iconLg} color={colors.accent} />}
      </View>
      <View style={{ alignItems: "center", gap: spacing.xxs }}>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{busy ? "Preparing…" : title}</Text>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

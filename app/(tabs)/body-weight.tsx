import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../providers/AuthContext";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Reveal } from "../../components/ui/Reveal";
import { changeCaption, ChangePill, RangeChangePill } from "../../components/weight/ChangePills";
import { GoalSheet } from "../../components/weight/GoalSheet";
import { HistoryRow } from "../../components/weight/HistoryRow";
import { LogWeightCard } from "../../components/weight/LogWeightCard";
import { GoalCard, StatCard } from "../../components/weight/StatCards";
import { deltaColor, signed } from "../../components/weight/weightChange";
import { entriesInRange, WeightTrendChart, type TrendRange } from "../../components/weight/WeightTrendChart";
import { RangeToggle, UnitToggle } from "../../components/weight/WeightToggles";
import { WeightSkeleton } from "../../components/weight/WeightSkeleton";
import { useToast } from "../../providers/ToastContext";
import { useProfile } from "../../hooks/useProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useAllWeights, useLogWeight } from "../../hooks/useWeights";
import { useWeightDelete } from "../../hooks/useWeightDelete";
import { useWeightEntry } from "../../hooks/useWeightEntry";
import type { BodyWeight } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { getInitials } from "../../utils/avatar";
import { changeOver, formatValue, fromDisplay, toDisplay, towardGoal } from "../../utils/bodyWeightRules";
import { createPageLogger } from "../../utils/logger";
import { weightLabel } from "../../utils/unitConversion";
import { formatDate, getWeekStart, parseLocalDate, FIRST_DAY_OF_WEEK, dayLabel, shortDate } from "../../utils/dates";

const log = createPageLogger("BodyWeight");

const EMPTY: BodyWeight[] = [];
const HISTORY_PREVIEW = 10;

export default function BodyWeightScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: raw = EMPTY, refetch, isLoading } = useAllWeights();
  const logWeight = useLogWeight();
  const { showToast } = useToast();
  const { unit, setUnit } = useUnitPreference();
  const scrollRef = useRef<ScrollView>(null);
  const todayKey = formatDate(new Date());

  // Entries waiting out their undo window are hidden right away.
  const describeDeleted = useCallback(
    (item: BodyWeight) => ({
      title: `${dayLabel(item.date.slice(0, 10), todayKey)} entry deleted`,
      subtitle: `${formatValue(toDisplay(item.weight, unit))} ${weightLabel(unit)}`,
    }),
    [todayKey, unit],
  );
  const { pendingIds, remove: deleteEntry } = useWeightDelete(describeDeleted);
  const history = useMemo(() => raw.filter((w) => !pendingIds.has(w.id)).sort((a, b) => b.date.localeCompare(a.date)), [raw, pendingIds]);

  const entry = useWeightEntry(history, profile?.weight, unit);
  const { setSelectedDate } = entry;
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // Stable: the Android dialog reopens (and loses the tapped day) when onChange changes.
  const onDatePicked = useCallback(
    (event: DateTimePickerEvent, d?: Date) => {
      setDatePickerOpen(false);
      if (event.type === "set" && d) setSelectedDate(d);
    },
    [setSelectedDate],
  );
  const [range, setRange] = useState<TrendRange>("30D");
  const [goalOpen, setGoalOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const save = async () => {
    const { value, error, logDate, existing, selectedDate } = entry;
    if (error || value == null || logWeight.isPending) return;
    try {
      await logWeight.mutateAsync({ date: logDate, weight: fromDisplay(value, unit), weekStart: formatDate(getWeekStart(selectedDate)) });
      entry.stopTyping();
      showToast({
        type: "success",
        message: existing ? "Entry updated" : "Weight saved",
        subtitle: `${formatValue(value)} ${weightLabel(unit)} · ${dayLabel(logDate, todayKey)}`,
      });
      log.success("Weight saved", `${value}${weightLabel(unit)} on ${logDate}`);
    } catch (e) {
      // useLogWeight shows the error toast and rolls back.
      log.error("Save failed", e instanceof Error ? e.message : String(e));
    }
  };

  const editDay = useCallback(
    (item: BodyWeight) => {
      setSelectedDate(parseLocalDate(item.date.slice(0, 10)));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    [setSelectedDate],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // Derived
  const latest = history[0] ?? null;
  const first = history[history.length - 1] ?? null;
  const goalKg = profile?.targetWeight ?? null;
  const fitnessGoal = profile?.fitnessGoal;
  const change = changeOver(history);
  const inRange = useMemo(() => entriesInRange(history, range, todayKey), [history, range, todayKey]);
  const shown = showAll ? history : history.slice(0, HISTORY_PREVIEW);
  const nameSource = profile?.displayName || user?.displayName || profile?.email || user?.email || "";
  const avatarPhoto = profile?.avatarUrl || user?.photoURL || null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: spacing.screen, paddingRight: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name="monitor-weight" size={size.icon} color={colors.accent} />
          </View>
          <Text style={[typography.headlineMd, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
            Weight
          </Text>
        </View>
        <Avatar key={avatarPhoto ?? "initials"} photoUri={avatarPhoto} initials={nameSource ? getInitials(nameSource) : ""} onPress={() => router.navigate("/(tabs)/profile")} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} />}
      >
        {isLoading && raw.length === 0 ? (
          <WeightSkeleton />
        ) : (
          <>
            {/* Current weight + unit */}
            <Reveal index={0}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>Current body weight</Text>
                {latest ? (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }} accessible accessibilityLabel={`Current body weight ${formatValue(toDisplay(latest.weight, unit))} ${weightLabel(unit)}`}>
                    <Text style={[typography.displayMd, { color: colors.text }]}>{formatValue(toDisplay(latest.weight, unit))}</Text>
                    <Text style={[typography.headlineSm, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
                  </View>
                ) : (
                  <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>No weigh-ins yet. Log your first one below.</Text>
                )}
                {change && latest && (
                  <ChangePill
                    deltaKg={change.deltaKg}
                    days={change.days}
                    sinceDate={change.sinceDate}
                    unit={unit}
                    color={deltaColor(latest.weight - change.deltaKg, latest.weight, goalKg, fitnessGoal, colors)}
                  />
                )}
              </View>
              <UnitToggle unit={unit} onChange={setUnit} />
            </View>
            </Reveal>

            {/* Log card */}
            <Reveal index={1}>
              <LogWeightCard entry={entry} unit={unit} todayKey={todayKey} saving={logWeight.isPending} onPickDate={() => setDatePickerOpen(true)} onSave={() => void save()} />
            </Reveal>

            {/* Trend */}
            <Reveal index={2}>
            <View style={{ padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised, gap: spacing.md }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
                    Trend
                  </Text>
                  {inRange.length >= 2 && (
                    <RangeChangePill
                      deltaKg={inRange[inRange.length - 1].weight - inRange[0].weight}
                      toward={towardGoal(inRange[0].weight, inRange[inRange.length - 1].weight, goalKg)}
                      range={range}
                      unit={unit}
                      color={deltaColor(inRange[0].weight, inRange[inRange.length - 1].weight, goalKg, fitnessGoal, colors)}
                    />
                  )}
                </View>
                <RangeToggle value={range} onChange={setRange} />
              </View>
              <WeightTrendChart entries={inRange} unit={unit} todayKey={todayKey} goalKg={goalKg} />
            </View>
            </Reveal>

            {/* Start / Change / Goal */}
            <Reveal index={3}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <StatCard
                label="Start"
                value={first ? formatValue(toDisplay(first.weight, unit)) : "–"}
                unit={first ? weightLabel(unit) : undefined}
                caption={first ? shortDate(first.date) : "No entries yet"}
              />
              <StatCard
                label="Change"
                value={first && latest && first !== latest ? signed(toDisplay(latest.weight - first.weight, unit)) : "–"}
                unit={first && latest && first !== latest ? weightLabel(unit) : undefined}
                valueColor={first && latest ? deltaColor(first.weight, latest.weight, goalKg, fitnessGoal, colors) : undefined}
                caption={changeCaption(first, latest, goalKg)}
              />
              <GoalCard goalKg={goalKg} latestKg={latest?.weight ?? null} unit={unit} onPress={() => setGoalOpen(true)} />
            </View>
            </Reveal>

            {/* History */}
            <Reveal index={4}>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm }}>
                <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
                  History
                </Text>
                <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
                  {history.length} {history.length === 1 ? "entry" : "entries"}
                </Text>
              </View>
              {history.length === 0 ? (
                <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>No entries yet.</Text>
              ) : (
                shown.map((item) => {
                  const idx = history.indexOf(item);
                  const older = history[idx + 1];
                  return (
                    <HistoryRow
                      key={item.id}
                      item={item}
                      diffKg={older ? item.weight - older.weight : null}
                      diffColor={older ? deltaColor(older.weight, item.weight, goalKg, fitnessGoal, colors) : colors.textSecondary}
                      unit={unit}
                      todayKey={todayKey}
                      onDelete={deleteEntry}
                      onEdit={editDay}
                    />
                  );
                })
              )}
              {history.length > HISTORY_PREVIEW && (
                <Button
                  title={showAll ? "Show less" : `Show all ${history.length} entries`}
                  variant="ghost"
                  onPress={() => setShowAll((v) => !v)}
                  fullWidth
                />
              )}
            </View>
            </Reveal>
          </>
        )}
      </ScrollView>

      <GoalSheet visible={goalOpen} onClose={() => setGoalOpen(false)} unit={unit} goalKg={goalKg} latestKg={latest?.weight ?? null} />

      {datePickerOpen && (
        <DateTimePicker
          value={entry.selectedDate}
          mode="date"
          firstDayOfWeek={FIRST_DAY_OF_WEEK}
          maximumDate={new Date()}
          onChange={onDatePicked}
        />
      )}
    </View>
  );
}

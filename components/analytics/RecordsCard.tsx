import { MaterialIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import type { ReachTarget } from "../../utils/analytics";
import { formatSet, prGain, type PREvent } from "../../utils/exerciseHistory";
import type { WeightUnit } from "../../utils/unitConversion";
import { parseLocalDate } from "../../utils/weekUtils";

const MAX_ROWS = 5;

export type RecordsCardProps = {
  records: PREvent[];
  reach: ReachTarget[];
  unit: WeightUnit;
  /** "this week", …; null for All ("all time"). */
  periodPhrase: string | null;
  onOpenExercise: (name: string) => void;
};

const KIND_LABEL: Record<PREvent["kind"], string> = { weight: "Heavier", reps: "More reps", strength: "Stronger set" };
const shortDate = (key: string) => parseLocalDate(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * New records in the period (amber, with what each one gained), then
 * "Within reach": the smallest next set that would be a record.
 */
export function RecordsCard({ records, reach, unit, periodPhrase, onOpenExercise }: RecordsCardProps) {
  const { colors } = useTheme();
  const count = records.length;
  const when = periodPhrase ?? "all time";

  return (
    <View style={{ backgroundColor: colors.raised, borderRadius: radius.xl, overflow: "hidden" }}>
      {/* Hero */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: count > 0 ? colors.surfaceContainerHigh : "transparent" }}>
        <View
          style={{
            width: size.iconBadge,
            height: size.iconBadge,
            borderRadius: radius.xl,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: count > 0 ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
            borderWidth: count > 0 ? 1 : 0,
            borderColor: colors.amber,
          }}
        >
          <MaterialIcons name="emoji-events" size={size.iconLg + spacing.sm} color={count > 0 ? colors.amber : colors.textSecondary} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]} accessibilityRole="header">
            Personal records
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
            <Text style={[typography.headlineLg, { color: count > 0 ? colors.amber : colors.text }]}>{count}</Text>
            <Text style={[typography.bodyMd, { flexShrink: 1, color: colors.text }]}>
              new {count === 1 ? "record" : "records"} {when}
            </Text>
          </View>
        </View>
      </View>

      {/* Records */}
      {records.slice(0, MAX_ROWS).map((r, i) => (
        <Row
          key={`${r.exercise}-${r.date}`}
          first={i === 0}
          onPress={() => onOpenExercise(r.exercise)}
          label={`${r.exercise}: ${formatSet(r.set, unit)}, ${KIND_LABEL[r.kind].toLowerCase()}, ${prGain(r.set, r.previous, r.kind, unit)}, ${shortDate(r.date)}`}
          icon={<MaterialIcons name="star" size={size.iconSm} color={colors.amber} />}
          title={r.exercise}
          subtitle={`${formatSet(r.set, unit)} · ${shortDate(r.date)}`}
          chip={prGain(r.set, r.previous, r.kind, unit)}
          chipColor={colors.amber}
        />
      ))}
      {count > MAX_ROWS && (
        <Text style={[typography.labelSm, { color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}>
          And {count - MAX_ROWS} more. Tap a lift below to see all its records.
        </Text>
      )}

      {/* Within reach */}
      {reach.length > 0 && (
        <View style={{ paddingTop: spacing.md, borderTopWidth: size.divider, borderTopColor: colors.surfaceContainerHigh }}>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xxs }}>
            <Text style={[typography.headlineSm, { color: colors.text }]}>Within reach</Text>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Your next session could set these</Text>
          </View>
          {reach.map((t, i) => (
            <Row
              key={t.exercise}
              first={i === 0}
              onPress={() => onOpenExercise(t.exercise)}
              label={`${t.exercise}: ${formatSet(t.target, unit)} would be a record. Last time ${formatSet(t.last, unit)}`}
              icon={<MaterialIcons name="flag" size={size.iconSm} color={colors.accent} />}
              title={t.exercise}
              subtitle={`Last: ${formatSet(t.last, unit)}`}
              chip={formatSet(t.target, unit) ?? ""}
              chipColor={colors.accent}
            />
          ))}
        </View>
      )}

      {count === 0 && reach.length === 0 && (
        <Text style={[typography.bodyMd, { color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
          Lift a little heavier, or do one more rep than last time, and it shows up here.
        </Text>
      )}
    </View>
  );
}

function Row({
  first,
  onPress,
  label,
  icon,
  title,
  subtitle,
  chip,
  chipColor,
}: {
  first: boolean;
  onPress: () => void;
  label: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  chip: string;
  chipColor: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens this exercise's progress"
      style={({ pressed }) => ({
        minHeight: size.exerciseRow,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        borderTopWidth: first ? 0 : size.divider,
        borderTopColor: colors.surfaceContainerHigh,
        backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
      })}
    >
      {icon}
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, borderColor: chipColor }}>
        <Text style={[typography.labelMd, { color: chipColor }]}>{chip}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={size.iconSm} color={colors.textSecondary} />
    </Pressable>
  );
}

export default RecordsCard;

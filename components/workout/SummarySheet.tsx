import { Text, View } from "react-native";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { doneSets, draftName, type WorkoutDraft } from "../../hooks/workoutDraft";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { weightLabel } from "../../utils/unitConversion";

export function SummarySheet({
  visible,
  draft,
  prCount,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  draft: WorkoutDraft;
  prCount: number;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!visible) return null;
  const logged = draft.exercises.filter((e) => doneSets(e).length > 0);
  const sets = logged.reduce((n, e) => n + doneSets(e).length, 0);
  const volume = logged.reduce((v, e) => v + doneSets(e).reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0), 0);
  const skipped = draft.exercises.length - logged.length;

  // No duration: it isn't stored, and logging after training would show ~1 min.
  const stats: [string, string][] = [
    ["Exercises", String(logged.length)],
    ["Sets", String(sets)],
    ["Volume", `${Math.round(volume).toLocaleString()} ${weightLabel(draft.unit)}`],
    ["PRs", String(prCount)],
  ];

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Finish workout?"
      subtitle={`${draftName(draft)}${skipped > 0 ? ` · ${skipped} ${skipped === 1 ? "exercise has" : "exercises have"} no completed sets and won't be saved` : ""}`}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {stats.map(([label, value]) => (
          <View key={label} style={{ flexGrow: 1, flexBasis: "40%", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.raised, gap: spacing.xxs }}>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[typography.headlineSm, { color: label === "PRs" && prCount > 0 ? colors.warning : colors.text }]}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: spacing.sm }}>
        <Button title="Save workout" onPress={onSave} loading={saving} disabled={saving} fullWidth haptic style={{ minHeight: size.ctaTall }} />
        <Button title="Keep logging" variant="ghost" onPress={onClose} disabled={saving} fullWidth />
      </View>
    </Sheet>
  );
}

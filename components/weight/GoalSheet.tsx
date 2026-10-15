import { useState } from "react";
import { Text, View } from "react-native";
import { useToast } from "../../providers/ToastContext";
import { useUpdateProfile } from "../../hooks/useProfile";
import { useTheme } from "../../theme/theme";
import { spacing, typography } from "../../theme/tokens";
import { formatValue, fromDisplay, maxFor, minFor, toDisplay } from "../../utils/bodyWeightRules";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { Stepper } from "../ui/Stepper";

const GOAL_STEP = 0.5;

export type GoalSheetProps = {
  visible: boolean;
  onClose: () => void;
  unit: WeightUnit;
  /** Current goal in kg, or null. */
  goalKg: number | null;
  /** Latest body weight in kg, to start the stepper near something real. */
  latestKg: number | null;
};

/** Set, change or remove the optional target weight (saved to the profile on the server). */
export function GoalSheet({ visible, onClose, unit, goalKg, latestKg }: GoalSheetProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const update = useUpdateProfile();
  const [value, setValue] = useState<number | null>(null);

  // Prefill each time it opens: the current goal, else the latest weight.
  const [wasOpen, setWasOpen] = useState(false);
  if (visible && !wasOpen) {
    setWasOpen(true);
    const start = goalKg ?? latestKg;
    setValue(start == null ? null : toDisplay(start, unit));
  } else if (!visible && wasOpen) {
    setWasOpen(false);
  }

  const save = async (targetWeight: number | null) => {
    try {
      const profile = await update.mutateAsync({ targetWeight });
      // An older server ignores the field; don't claim it was saved.
      if (targetWeight != null && profile?.targetWeight == null) {
        showToast({ type: "error", message: "Goal not saved", subtitle: "The server doesn't support goals yet." });
        return;
      }
      onClose();
      showToast({
        type: "success",
        message: targetWeight == null ? "Goal removed" : "Goal saved",
        subtitle: targetWeight == null ? undefined : `${formatValue(toDisplay(targetWeight, unit))} ${weightLabel(unit)}`,
      });
    } catch {
      showToast({ type: "error", message: "Couldn't save your goal", subtitle: "Check your connection and try again." });
    }
  };

  const valid = value != null && value >= minFor(unit) && value <= maxFor(unit);

  return (
    <Sheet
      visible={visible}
      onClose={update.isPending ? undefined : onClose}
      title={goalKg == null ? "Set a weight goal" : "Your weight goal"}
      subtitle="Optional. It adds a goal line to your trend and shows how far you have to go."
    >
      <Stepper
        label={`Target weight (${weightLabel(unit)})`}
        value={value}
        onChange={setValue}
        step={GOAL_STEP}
        min={minFor(unit)}
        max={maxFor(unit)}
        decimal
        accessibilityUnit={weightLabel(unit)}
      />
      {!valid && value != null && (
        <Text style={[typography.labelSm, { color: colors.danger }]}>{`Choose between ${minFor(unit)} and ${maxFor(unit)} ${weightLabel(unit)}`}</Text>
      )}
      <View style={{ gap: spacing.sm }}>
        <Button title="Save goal" onPress={() => valid && void save(fromDisplay(value!, unit))} disabled={!valid || update.isPending} loading={update.isPending} fullWidth />
        {goalKg != null && <Button title="Remove goal" variant="ghostDanger" onPress={() => void save(null)} disabled={update.isPending} fullWidth />}
      </View>
    </Sheet>
  );
}

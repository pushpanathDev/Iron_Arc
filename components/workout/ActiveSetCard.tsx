import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DEFAULT_REPS_MAX, DEFAULT_REPS_MIN, useDefaultReps } from "../../hooks/useDefaultReps";
import type { SetValues } from "../../hooks/workoutDraft";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { weightLabel, weightStep, type WeightUnit } from "../../utils/unitConversion";
import { usesPlates, weightHintFor } from "../../utils/weightEntry";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { PulsingDot } from "../ui/StatusIndicators";
import { Stepper } from "../ui/Stepper";
import { PlateSheet } from "./PlateSheet";
import type { MaterialIconName } from "../ui/iconName";

export type ActiveSetCardProps = {
  setNumber: number;
  editing: boolean;
  /** Same set number last time, e.g. "80 kg × 8". */
  lastTime: string | null;
  unit: WeightUnit;
  values: SetValues;
  onChange: (values: Partial<SetValues>) => void;
  onComplete: () => void;
  /** In progress: remove this (not yet done) set. */
  onRemove: () => void;
  /** Editing: delete the completed set. */
  onDelete: () => void;
  onCancelEdit: () => void;
  /** Exercise name: picks the weight hint, or the bar + plates helper for barbells. */
  exercise: string;
};

const MAX_WEIGHT = 9999;
const MAX_REPS = 999;

/** The set being logged (or edited): weight and reps steppers, then Complete / Save. */
export function ActiveSetCard({ setNumber, editing, lastTime, unit, values, onChange, onComplete, onRemove, onDelete, onCancelEdit, exercise }: ActiveSetCardProps) {
  const { colors } = useTheme();
  const [platesOpen, setPlatesOpen] = useState(false);
  const plates = usesPlates(exercise);
  const weightHint = plates ? null : weightHintFor(exercise);
  const ready = values.weight != null && values.reps != null && values.reps >= 1;

  return (
    <View style={{ backgroundColor: colors.surfaceContainerHighest, borderRadius: radius.lg, padding: spacing.md, paddingTop: spacing.xs, gap: spacing.md }}>
      <View style={{ minHeight: size.control, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <PulsingDot color={editing ? colors.warning : colors.accent} />
        <Text style={[typography.headlineSm, { flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} numberOfLines={1}>
          Set {setNumber} — {editing ? "Editing" : "In progress"}
        </Text>
        {lastTime && <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Last: {lastTime}</Text>}
        {!editing && (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove set ${setNumber}`}
            hitSlop={spacing.xs}
            style={({ pressed }) => ({
              width: size.control,
              height: size.control,
              marginRight: -spacing.sm,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
            })}
          >
            <MaterialIcons name="close" size={size.icon} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Stepper
          label={`Weight (${weightLabel(unit)})`}
          value={values.weight}
          onChange={(weight) => onChange({ weight })}
          step={weightStep(unit)}
          max={MAX_WEIGHT}
          decimal
          accessibilityUnit={weightLabel(unit)}
        />
        <Stepper label="Reps" value={values.reps} onChange={(reps) => onChange({ reps })} step={1} min={1} max={MAX_REPS} />
      </View>
      {/* Same two columns as the steppers, so the chip sits right under Reps. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: -spacing.xs }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {plates && (
            <SmallChip icon="fitness-center" label="Bar + plates" onPress={() => setPlatesOpen(true)} accessibilityLabel="Work out the weight from the bar and plates" />
          )}
          {weightHint && (
            <>
              <MaterialIcons name="info-outline" size={size.iconXs} color={colors.textSecondary} />
              <Text style={[typography.labelSm, { flex: 1, color: colors.textSecondary }]} numberOfLines={2}>
                {weightHint}
              </Text>
            </>
          )}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <DefaultRepsChip current={values.reps} onUse={(reps) => onChange({ reps })} />
        </View>
      </View>

      {plates && (
        <PlateSheet
          visible={platesOpen}
          exercise={exercise}
          unit={unit}
          current={values.weight}
          onUse={(weight) => {
            onChange({ weight });
            setPlatesOpen(false);
          }}
          onClose={() => setPlatesOpen(false)}
        />
      )}

      <Button
        title={editing ? "Save set" : "Complete set"}
        icon="checkmark"
        onPress={onComplete}
        disabled={!ready}
        fullWidth
        style={{ minHeight: size.ctaTall }}
        accessibilityHint={ready ? undefined : "Enter weight and reps first"}
      />
      {editing && (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title="Delete set" icon="trash-outline" variant="ghostDanger" onPress={onDelete} style={{ flex: 1 }} />
          <Button title="Cancel" variant="ghost" onPress={onCancelEdit} style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

/**
 * The user's go-to rep count as a small chip under Reps. Never filled in on
 * its own: tap it, then adjust with − / + (e.g. 15 → 13). Before a default
 * exists the same chip reads "Default reps" and opens the setter; once set,
 * the pencil changes it.
 */
function DefaultRepsChip({ current, onUse }: { current: number | null; onUse: (reps: number) => void }) {
  const { colors } = useTheme();
  const { defaultReps, setDefaultReps } = useDefaultReps();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);

  const openSheet = () => {
    setDraft(defaultReps ?? current ?? null);
    setOpen(true);
  };
  const applied = defaultReps != null && current === defaultReps;
  const valid = draft != null && draft >= DEFAULT_REPS_MIN && draft <= DEFAULT_REPS_MAX;
  const tint = applied ? colors.accent : colors.textSecondary;
  const slop = { top: spacing.sm, bottom: spacing.sm, left: spacing.xs, right: spacing.xs };

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        {defaultReps != null && (
          <Pressable
            onPress={openSheet}
            accessibilityRole="button"
            accessibilityLabel="Change default reps"
            hitSlop={slop}
            style={({ pressed }) => ({
              padding: spacing.xs,
              borderRadius: radius.full,
              backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
            })}
          >
            <MaterialIcons name="edit" size={size.iconXs} color={colors.textSecondary} />
          </Pressable>
        )}
        <Pressable
          onPress={defaultReps != null ? () => onUse(defaultReps) : openSheet}
          accessibilityRole="button"
          accessibilityLabel={defaultReps != null ? `Use ${defaultReps} reps` : "Set default reps"}
          accessibilityState={{ selected: applied }}
          hitSlop={slop}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: applied ? colors.accent : colors.border,
            backgroundColor: pressed ? colors.surfaceContainerHigh : applied ? colors.accentSubtle : "transparent",
          })}
        >
          <MaterialIcons name={defaultReps != null ? "flash-on" : "add"} size={size.iconXs} color={tint} />
          <Text style={[typography.labelMd, { color: applied ? colors.accent : colors.textSecondary }]}>
            {defaultReps != null ? `${defaultReps} reps` : "Default reps"}
          </Text>
        </Pressable>
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Default reps" subtitle="Shown as a chip under Reps. Tap it to fill the set, then adjust with − / +.">
        <View style={{ flexDirection: "row" }}>
          <Stepper label="Reps" value={draft} onChange={setDraft} step={1} min={DEFAULT_REPS_MIN} max={DEFAULT_REPS_MAX} />
        </View>
        <Button
          title="Save default"
          icon="checkmark"
          disabled={!valid}
          onPress={() => {
            if (!valid) return;
            setDefaultReps(draft);
            setOpen(false);
          }}
          fullWidth
        />
        {defaultReps != null && (
          <Button
            title="Remove default"
            variant="ghostDanger"
            onPress={() => {
              setDefaultReps(null);
              setOpen(false);
            }}
            fullWidth
          />
        )}
      </Sheet>
    </>
  );
}

/** Small outlined pill (same look as the default-reps chip). */
function SmallChip({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.xs, right: spacing.xs }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
      })}
    >
      <MaterialIcons name={icon} size={size.iconXs} color={colors.textSecondary} />
      <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

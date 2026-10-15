import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, ruler, size, spacing, typography } from "../../theme/tokens";
import { HeightRuler, type HeightUnit } from "../onboarding/HeightRuler";
import { SkeletonBlock } from "../ui/Skeleton";
import { TrainingDaysPicker } from "../training/TrainingDaysPicker";
import type { Weekday } from "../../data/trainingProfile";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { Stepper } from "../ui/Stepper";

export type Option<T> = { value: T; label: string; hint?: string };

/**
 * Pick one (saves on tap) or several (Save button). Every option row takes the
 * tap across its whole box.
 */
export function OptionsSheet<T extends string | number>({
  visible,
  title,
  subtitle,
  options,
  value,
  multiple,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: Option<T>[];
  value: T[];
  multiple?: boolean;
  saving: boolean;
  onSave: (value: T[]) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [picked, setPicked] = useState<T[]>(value);
  // Fresh from the saved value each time it opens.
  useEffect(() => {
    if (visible) setPicked(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={saving ? undefined : onClose} title={title} subtitle={subtitle}>
      <View style={{ borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceContainerHigh }}>
        {options.map((o, i) => {
          const on = picked.includes(o.value);
          return (
            <Pressable
              key={String(o.value)}
              disabled={saving}
              onPress={() => {
                if (multiple) setPicked((p) => (p.includes(o.value) ? p.filter((x) => x !== o.value) : [...p, o.value]));
                else onSave([o.value]);
              }}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityState={{ checked: on, disabled: saving }}
              accessibilityLabel={o.hint ? `${o.label}, ${o.hint}` : o.label}
              style={({ pressed }) => ({
                minHeight: size.exerciseRow,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                borderTopWidth: i === 0 ? 0 : size.divider,
                borderTopColor: colors.surfaceContainerHighest,
                backgroundColor: pressed ? colors.surfaceContainerHighest : "transparent",
              })}
            >
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text style={[typography.bodyMdMedium, { color: on ? colors.accent : colors.text }]}>{o.label}</Text>
                {o.hint ? <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{o.hint}</Text> : null}
              </View>
              <MaterialIcons
                name={multiple ? (on ? "check-box" : "check-box-outline-blank") : on ? "radio-button-checked" : "radio-button-unchecked"}
                size={size.iconLg}
                color={on ? colors.accent : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
      {multiple && <Button title="Save" icon="checkmark" onPress={() => onSave(picked)} loading={saving} disabled={saving} fullWidth />}
    </Sheet>
  );
}

/** Weekdays (ISO 1 = Monday); the count becomes the weekly goal. */
export function DaysSheet({
  visible,
  value,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  value: Weekday[];
  saving: boolean;
  onSave: (days: Weekday[]) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState<Weekday[]>(value);
  // Fresh from the saved value each time it opens.
  useEffect(() => {
    if (visible) setDays(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  return (
    <Sheet visible={visible} onClose={saving ? undefined : onClose} title="Training days" subtitle="Your weekly goal, reminders and AI plan follow these days.">
      <TrainingDaysPicker value={days} onChange={setDays} />
      <Button title="Save" icon="checkmark" onPress={() => onSave(days)} loading={saving} disabled={saving || days.length === 0} fullWidth />
    </Sheet>
  );
}

/** A whole number with − / + (height in cm, age). Clear removes it. */
export function NumberSheet({
  visible,
  title,
  subtitle,
  label,
  value,
  fallback,
  min,
  max,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  label: string;
  value: number | null;
  /** Starting point when nothing is saved yet. */
  fallback: number;
  min: number;
  max: number;
  saving: boolean;
  onSave: (value: number | null) => void;
  onClose: () => void;
}) {
  const [n, setN] = useState<number | null>(value ?? fallback);
  // Fresh from the saved value each time it opens.
  useEffect(() => {
    if (visible) setN(value ?? fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const valid = n != null && n >= min && n <= max;
  return (
    <Sheet visible={visible} onClose={saving ? undefined : onClose} title={title} subtitle={subtitle}>
      <View style={{ flexDirection: "row" }}>
        <Stepper label={label} value={n} onChange={setN} step={1} min={min} max={max} />
      </View>
      <Button title="Save" icon="checkmark" onPress={() => valid && onSave(Math.round(n!))} loading={saving} disabled={saving || !valid} fullWidth />
      {value != null && <Button title="Remove" variant="ghostDanger" onPress={() => onSave(null)} disabled={saving} fullWidth />}
    </Sheet>
  );
}

/** Height on the same ruler as onboarding (cm or ft-in); saved in cm. */
export function HeightSheet({
  visible,
  value,
  fallback,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  value: number | null;
  fallback: number;
  saving: boolean;
  onSave: (cm: number | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [cm, setCm] = useState(value ?? fallback);
  const [unit, setUnit] = useState<HeightUnit>("cm");
  // The ruler (150 ticks) mounts once the sheet is on screen; a matching placeholder shows until then.
  const [ready, setReady] = useState(false);
  // Fresh from the saved value each time it opens.
  useEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    setCm(value ?? fallback);
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={saving ? undefined : onClose} title="Height" subtitle="Scroll the ruler, then save.">
      <View style={{ flexDirection: "row", alignSelf: "center", padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }} accessibilityRole="radiogroup">
        {(["cm", "ft"] as const).map((u) => (
          <Pressable
            key={u}
            onPress={() => setUnit(u)}
            accessibilityRole="radio"
            accessibilityState={{ checked: unit === u }}
            accessibilityLabel={u === "cm" ? "Centimetres" : "Feet and inches"}
            style={{ minWidth: size.control + spacing.lg, minHeight: size.control - spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: unit === u ? colors.accent : "transparent" }}
          >
            <Text style={[typography.labelLg, { color: unit === u ? colors.onAccent : colors.textSecondary }]}>{u === "cm" ? "cm" : "ft-in"}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.lg, padding: spacing.md }}>
        {ready ? (
          <HeightRuler cm={cm} unit={unit} onChangeCm={setCm} />
        ) : (
          <View style={{ alignItems: "center", gap: spacing.md }} accessibilityLabel="Loading height ruler">
            <SkeletonBlock width={size.goalCard} height={typography.displayMd.lineHeight + spacing.sm * 2} radius="md" />
            <SkeletonBlock height={ruler.height} radius="md" />
          </View>
        )}
      </View>
      <Button title="Save" icon="checkmark" onPress={() => onSave(Math.round(cm))} loading={saving} disabled={saving || !ready} fullWidth />
      {value != null && <Button title="Remove" variant="ghostDanger" onPress={() => onSave(null)} disabled={saving} fullWidth />}
    </Sheet>
  );
}

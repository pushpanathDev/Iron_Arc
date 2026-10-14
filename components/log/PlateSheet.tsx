import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useBarWeights } from "../../hooks/useBarWeights";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { barTotal, PLATES, platesFor } from "../../utils/weightEntry";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { Stepper } from "../ui/Stepper";

export type PlateSheetProps = {
  visible: boolean;
  exercise: string;
  unit: WeightUnit;
  /** The set's current weight (display unit), to show how it's loaded. */
  current: number | null;
  onUse: (total: number) => void;
  onClose: () => void;
};

const BAR_STEP: Record<WeightUnit, number> = { kg: 0.5, lbs: 1 };
const BAR_MAX = 100;
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Work out a barbell weight: the bar (remembered per exercise) plus the
 * plates on each side. "Use" fills the set's weight with the total.
 */
export function PlateSheet({ visible, exercise, unit, current, onUse, onClose }: PlateSheetProps) {
  const { colors } = useTheme();
  const { barFor, saveBar } = useBarWeights();
  const [bar, setBar] = useState<number | null>(null);
  const [perSide, setPerSide] = useState<number[]>([]);
  const [barSaved, setBarSaved] = useState(false);

  // Fresh each time it opens: this exercise's bar, and the current weight split into plates.
  useEffect(() => {
    if (!visible) return;
    const b = barFor(exercise, unit);
    setBar(b.value);
    setBarSaved(b.saved);
    setPerSide(current != null && current > 0 ? (platesFor(current, b.value, unit) ?? []) : []);
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const label = weightLabel(unit);
  const total = bar != null ? barTotal(bar, perSide) : null;
  const sideSum = perSide.reduce((a, b) => a + b, 0);

  return (
    <Sheet visible={visible} onClose={onClose} title="Bar + plates" subtitle={exercise}>
      {/* Bar */}
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: "row" }}>
          <Stepper label={`Bar (${label})`} value={bar} onChange={setBar} step={BAR_STEP[unit]} min={0} max={BAR_MAX} decimal accessibilityUnit={label} />
        </View>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
          {barSaved ? "Your saved bar for this exercise." : `Typical bar: Olympic ${unit === "kg" ? "20 kg" : "45 lbs"}, EZ ${unit === "kg" ? "7–12 kg" : "15–25 lbs"}. Check yours.`}
        </Text>
      </View>

      {/* Plates */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>Add to each side</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {PLATES[unit].map((p) => (
            <Pressable
              key={p}
              onPress={() => setPerSide((s) => [...s, p].sort((a, b) => b - a))}
              accessibilityRole="button"
              accessibilityLabel={`Add a ${fmt(p)} ${label} plate to each side`}
              style={({ pressed }) => ({
                minWidth: size.control + spacing.lg,
                minHeight: size.control,
                paddingHorizontal: spacing.md,
                borderRadius: radius.lg,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
              })}
            >
              <Text style={[typography.labelLg, { color: colors.text }]}>+{fmt(p)}</Text>
            </Pressable>
          ))}
        </View>

        {/* On each side now: tap one to take it off */}
        <View style={{ minHeight: size.control, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs }}>
          <Text style={[typography.labelMd, { color: colors.textSecondary }]}>Each side:</Text>
          {perSide.length === 0 ? (
            <Text style={[typography.labelMd, { color: colors.textMuted }]}>empty bar</Text>
          ) : (
            perSide.map((p, i) => (
              <Pressable
                key={`${p}-${i}`}
                onPress={() => setPerSide((s) => s.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove a ${fmt(p)} ${label} plate from each side`}
                hitSlop={spacing.xs}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xxs,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: colors.accent,
                  backgroundColor: pressed ? colors.accentSubtle : "transparent",
                })}
              >
                <Text style={[typography.labelMd, { color: colors.accent }]}>{fmt(p)}</Text>
                <MaterialIcons name="close" size={size.iconXs} color={colors.accent} />
              </Pressable>
            ))
          )}
        </View>
      </View>

      {/* Total */}
      <View style={{ alignItems: "center", gap: spacing.xxs, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
        <Text style={[typography.headlineLg, { color: colors.text }]} accessibilityLiveRegion="polite">
          {total != null ? `${fmt(total)} ${label}` : "—"}
        </Text>
        {bar != null && (
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
            {fmt(bar)} bar{sideSum > 0 ? ` + 2 × ${fmt(sideSum)}` : ""}
          </Text>
        )}
      </View>

      <Button
        title={total != null ? `Use ${fmt(total)} ${label}` : "Use"}
        icon="checkmark"
        disabled={total == null || total <= 0}
        onPress={() => {
          if (bar == null || total == null) return;
          saveBar(exercise, bar, unit);
          onUse(total);
        }}
        fullWidth
      />
    </Sheet>
  );
}

export default PlateSheet;

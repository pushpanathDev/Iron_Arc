import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { motion, radius, size, spacing, typography } from "../../theme/tokens";

export type StepperProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  /** Allow decimals when typing (weights). */
  decimal?: boolean;
  accessibilityUnit?: string;
};

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const show = (v: number | null) => (v == null ? "" : String(Math.round(v * 100) / 100));

/** − value + control, 52 high. Hold a button to repeat; tap the number to type it. */
export function Stepper({ label, value, onChange, step, min = 0, max = 9999, decimal = false, accessibilityUnit }: StepperProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused]);

  const bump = useCallback(
    (dir: 1 | -1) => {
      const current = valueRef.current ?? (dir > 0 ? min - step : min);
      const next = Math.min(max, Math.max(min, roundTo(current + dir * step, step)));
      if (next !== valueRef.current) {
        valueRef.current = next;
        onChange(next);
        setText(show(next)); // keep the field in step even while it has focus
        Haptics.selectionAsync().catch(() => {});
      }
    },
    [max, min, onChange, step],
  );

  /**
   * Every keystroke updates the value, so tapping Save / Complete set while the
   * keyboard is still open uses what was typed (not the value from before).
   * Out-of-range numbers pass through while typing so the caller can show its
   * own message; leaving the field clamps them into range.
   */
  const onType = (t: string) => {
    setText(t);
    const cleaned = t.replace(",", ".").trim();
    if (cleaned === "") {
      onChange(null);
      return;
    }
    const n = Number(cleaned);
    if (Number.isFinite(n)) onChange(decimal ? Math.round(n * 100) / 100 : Math.round(n));
  };

  const commitText = () => {
    setFocused(false);
    const n = Number(text.replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(n)) {
      setText(show(valueRef.current));
      return;
    }
    const clamped = Math.min(max, Math.max(min, decimal ? n : Math.round(n)));
    onChange(clamped);
    setText(show(clamped));
  };

  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{label}</Text>
      <View
        style={{
          height: size.ctaTall,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: radius.lg,
          backgroundColor: colors.surfaceContainerHigh,
        }}
      >
        <RepeatButton icon="remove" onStep={() => bump(-1)} label={`Decrease ${label.toLowerCase()}`} />
        <TextInput
          value={text}
          onChangeText={onType}
          maxLength={7}
          onFocus={() => setFocused(true)}
          onBlur={commitText}
          onSubmitEditing={commitText}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          returnKeyType="done"
          selectTextOnFocus
          placeholder="–"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={`${label}${value != null ? `, ${show(value)}${accessibilityUnit ? ` ${accessibilityUnit}` : ""}` : ""}`}
          accessibilityHint="Type an exact value"
          style={[typography.headlineMd, { flex: 1, minWidth: 0, color: colors.text, textAlign: "center", paddingVertical: 0 }]}
        />
        <RepeatButton icon="add" onStep={() => bump(1)} label={`Increase ${label.toLowerCase()}`} />
      </View>
    </View>
  );
}

/** − / + button: steps once on press, then repeats faster while held. `filled` gives it its own surface. */
export function RepeatButton({ icon, onStep, label, filled }: { icon: "add" | "remove"; onStep: () => void; label: string; filled?: boolean }) {
  const { colors } = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = useRef(0);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const repeat = useCallback(
    (delay: number) => {
      timer.current = setTimeout(() => {
        stepRef.current();
        count.current++;
        // Speeds up the longer it's held, down to motion.repeatMs.
        repeat(Math.max(motion.repeatMs, motion.repeatDelayMs - count.current * 20));
      }, delay);
    },
    [],
  );

  useEffect(() => stop, [stop]);

  return (
    <Pressable
      onPressIn={() => {
        stop();
        count.current = 0;
        stepRef.current();
        repeat(motion.repeatDelayMs);
      }}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={spacing.xs}
      style={({ pressed }) => ({
        width: size.control,
        height: size.ctaTall,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceContainerHighest : filled ? colors.surfaceContainerHigh : "transparent",
      })}
    >
      <MaterialIcons name={icon} size={size.iconLg} color={colors.text} />
    </Pressable>
  );
}

export default Stepper;

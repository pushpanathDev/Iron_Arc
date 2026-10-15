import { useCallback, useEffect, useState } from "react";
import type { BodyWeight } from "../services/api";
import { motion } from "../theme/tokens";
import { formatValue, maxFor, parseWeight, stepWeight, toDisplay, weightError } from "../utils/bodyWeightRules";
import { formatDate } from "../utils/dates";
import type { WeightUnit } from "../utils/unitConversion";

/** Stepper start when there's no entry, no earlier entry and no profile weight. */
const FALLBACK_KG = 70;

/**
 * The weigh-in being entered on the Weight screen: which day, the value (in the
 * display unit) from the steppers or typing, and what the scale shows.
 * `history` is newest first.
 */
export function useWeightEntry(history: BodyWeight[], profileKg: number | null | undefined, unit: WeightUnit) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const logDate = formatDate(selectedDate);
  const existing = history.find((w) => w.date.slice(0, 10) === logDate);
  // Start from this day's entry, else the latest earlier one, else the profile weight.
  const earlier = history.find((w) => w.date.slice(0, 10) < logDate);
  const prefillKg = existing?.weight ?? earlier?.weight ?? profileKg ?? null;

  const [value, setValue] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [dialValue, setDialValue] = useState<number | null>(null);

  useEffect(() => {
    setValue(prefillKg == null ? null : toDisplay(prefillKg, unit));
    setTyping(false);
  }, [logDate, prefillKg, unit]);

  // The text mirrors the value except while the user is typing.
  useEffect(() => {
    if (!typing) setText(value == null ? "" : formatValue(value));
  }, [value, typing]);

  // The scale follows the steppers at once, and typed values once typing pauses
  // (so "7" on the way to "75" doesn't roll it down and back).
  useEffect(() => {
    if (!typing) {
      setDialValue(value);
      return;
    }
    const t = setTimeout(() => setDialValue(value), motion.dialTypeDebounceMs);
    return () => clearTimeout(t);
  }, [value, typing]);

  const fallback = toDisplay(prefillKg ?? FALLBACK_KG, unit);
  const step = useCallback(
    (dir: 1 | -1) => {
      setTyping(false);
      setValue((v) => stepWeight(v, dir, unit, fallback));
    },
    [unit, fallback],
  );

  const type = (t: string) => {
    setTyping(true);
    setText(t);
    setValue(parseWeight(t));
  };

  const error = weightError(value, unit);
  // While typing, "7" on the way to "75" isn't an error yet; over the maximum is.
  const showError = !!error && value != null && (!typing || value > maxFor(unit));

  return {
    selectedDate,
    setSelectedDate,
    logDate,
    existing,
    value,
    text,
    dialValue,
    step,
    type,
    stopTyping: () => setTyping(false),
    error,
    showError,
  };
}

export type WeightEntry = ReturnType<typeof useWeightEntry>;

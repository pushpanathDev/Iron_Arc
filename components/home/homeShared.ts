/* Small helpers shared by the Home cards. */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import type { Session } from "../../hooks/useWorkoutSummary";
import { motion } from "../../theme/tokens";
import { parseLocalDate, daysBetween } from "../../utils/dates";

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Dates within this many days show a weekday name instead of "12 Sep". */
const WEEKDAY_WINDOW = 6;

/** Counts up from 0 once, on first load; later changes jump straight to the value. */
export function useCountUp(target: number, ready: boolean) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const animated = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (animated.current || reduceMotion || target === 0) {
      animated.current = true;
      setValue(target);
      return;
    }
    animated.current = true;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / motion.countUpMs);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ready, reduceMotion]);

  return ready ? value : target;
}

export function sessionName(s: Session) {
  const main = s.categories.filter((c) => c !== "Other");
  if (main.length === 0) return "Workout";
  if (main.length <= 2) return main.join(" & ");
  return "Mixed session";
}

export function relativeDay(date: string, todayKey: string) {
  const diff = daysBetween(date, todayKey);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <= WEEKDAY_WINDOW) return parseLocalDate(date).toLocaleDateString(undefined, { weekday: "long" });
  return parseLocalDate(date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

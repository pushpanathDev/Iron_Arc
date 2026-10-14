import { useUnlockQueue } from "../../hooks/badgeUnlocks";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { BadgeSheet } from "./BadgeSheet";

/** Celebrates newly unlocked badges over any screen, one at a time ("Next · 1 more"). */
export function BadgeUnlockHost() {
  const { current, waiting, dismiss } = useUnlockQueue();
  const { unit } = useUnitPreference();
  return <BadgeSheet badge={current} unit={unit} primaryLabel={waiting > 0 ? `Next · ${waiting} more` : "Nice"} onClose={dismiss} />;
}

export default BadgeUnlockHost;

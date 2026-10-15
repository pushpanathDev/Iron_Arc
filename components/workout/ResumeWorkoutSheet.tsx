import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useAuth } from "../../providers/AuthContext";
import { clearDraft, doneSets, draftName, loadDraft, type WorkoutDraft } from "../../hooks/workoutDraft";
import { spacing } from "../../theme/tokens";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/** Home shows the prompt once per app launch; the Log picker every time it opens. */
let shownThisLaunch = false;

function describe(d: WorkoutDraft) {
  const sets = d.exercises.reduce((n, e) => n + doneSets(e).length, 0);
  const started = new Date(d.startedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  return `${draftName(d)} · ${sets} ${sets === 1 ? "set" : "sets"} done · started ${started}`;
}

export function ResumeWorkoutSheet({ from }: { from: "home" | "picker" }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);

  useEffect(() => {
    if (!user || (from === "home" && shownThisLaunch)) return;
    let cancelled = false;
    void loadDraft(user.uid).then((d) => {
      if (cancelled || !d || d.exercises.length === 0) return;
      shownThisLaunch = true;
      setDraft(d);
    });
    return () => {
      cancelled = true;
    };
  }, [user, from]);

  const resume = () => {
    setDraft(null);
    if (from === "picker") router.replace("/workout/session");
    else router.push("/workout/session");
  };

  const discard = () => {
    setDraft(null);
    void clearDraft(user?.uid);
  };

  return (
    <Sheet visible={!!draft} title="Resume workout?" subtitle={draft ? describe(draft) : undefined}>
      <View style={{ gap: spacing.sm }}>
        <Button title="Resume" onPress={resume} fullWidth haptic />
        <Button title="Discard" variant="secondary" onPress={discard} fullWidth />
      </View>
    </Sheet>
  );
}

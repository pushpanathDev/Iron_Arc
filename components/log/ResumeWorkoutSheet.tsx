import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { clearDraft, doneSets, draftName, loadDraft, type LogDraft } from "../../hooks/logSession";
import { spacing } from "../../theme/tokens";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/** Home shows the prompt once per app launch; the Log picker every time it opens. */
let shownThisLaunch = false;

function describe(d: LogDraft) {
  const sets = d.exercises.reduce((n, e) => n + doneSets(e).length, 0);
  const started = new Date(d.startedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  return `${draftName(d)} · ${sets} ${sets === 1 ? "set" : "sets"} done · started ${started}`;
}

export function ResumeWorkoutSheet({ from }: { from: "home" | "log" }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<LogDraft | null>(null);

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
    if (from === "log") router.replace("/log/session");
    else router.push("/log/session");
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

export default ResumeWorkoutSheet;

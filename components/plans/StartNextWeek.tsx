import { useState } from "react";
import { useRecalibratePlan } from "../../hooks/usePlan";
import { useToast } from "../../providers/ToastContext";
import type { Plan } from "../../services/api";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { aiErrorMessage } from "../../utils/aiErrors";
import { GeneratingOverlay } from "./GeneratingOverlay";

/**
 * "Start week N?" and, once confirmed, the AI's progress overlay. One flow
 * for every way in: the plan menu, the plan screen and Home's new-week card.
 */
export function StartNextWeek({ plan, visible, onClose }: { plan: Plan | null; visible: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const recalibrate = useRecalibratePlan();
  // The plan being moved on; kept while the overlay shows, even after the caller lets go.
  const [working, setWorking] = useState<Plan | null>(null);
  const next = (plan?.weekNumber || 1) + 1;

  return (
    <>
      <ConfirmDialog
        visible={visible && !!plan}
        icon="update"
        title={`Start week ${next}?`}
        message="The coach looks at what you logged in the last 7 days and sets up next week's sets and reps. Your training days stay the same, and the change is noted in the coach chat."
        confirmLabel={`Start week ${next}`}
        onCancel={onClose}
        onConfirm={() => {
          if (!plan) return;
          setWorking(plan);
          onClose();
          recalibrate.mutate(plan.id, {
            onSuccess: (p) => showToast({ type: "success", message: `Week ${p.weekNumber} is ready`, subtitle: "See what changed in the coach chat." }),
            onError: (e) => showToast({ type: "error", message: "Couldn't start next week", subtitle: aiErrorMessage(e) }),
            onSettled: () => setWorking(null),
          });
        }}
      />
      <GeneratingOverlay
        visible={!!working}
        title="Preparing next week…"
        inputs={["What you logged in the last 7 days", `This week of ${working?.name ?? ""}`]}
        onStopWaiting={() => setWorking(null)}
      />
    </>
  );
}

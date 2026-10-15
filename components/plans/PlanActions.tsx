import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useToast } from "../../providers/ToastContext";
import { useActivatePlan, useDeletePlan, useRecalibratePlan, useRenamePlan } from "../../hooks/usePlan";
import { ApiError, type Plan } from "../../services/api";
import { spacing } from "../../theme/tokens";
import { SettingsGroup, SettingsRow } from "../profile/Settings";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/TextField";
import { GeneratingOverlay } from "./GeneratingOverlay";

const NAME_MAX = 60;
const MODAL_SWAP_MS = 350;

/** Plain words for AI request failures (the server rate-limits generate, recalibrate, swap and chat). */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.kind === "network") return "Couldn't reach the server. Check your connection and try again.";
    if (e.kind === "timeout") return "The AI took too long. If a plan was made, it will appear in your list.";
    // The server's reason when it gives one ("Plan generation limit reached…").
    if (e.message && !/^request failed|^http \d+|internal server error|^error$/i.test(e.message)) return e.message;
    if (e.status === 429) return "You've reached the AI limit for now. Try again in a little while.";
    if (__DEV__) console.warn(`[AI] ${e.status} ${e.message}`);
    // The status helps tell a server failure (5xx) from anything else.
    return `Something went wrong (${e.status}). Please try again.`;
  }
  if (__DEV__) console.warn("[AI] request failed:", e);
  return "Something went wrong. Please try again.";
}

export type PlanActionsProps = {
  /** The plan whose menu is open (null = closed). */
  plan: Plan | null;
  onClose: () => void;
  /** After delete from the day view, leave the screen. */
  leaveOnDelete?: boolean;
};

/** ⋮ / ⚙ menu for a plan: rename, start next week, make active, delete. */
export function PlanActions({ plan, onClose, leaveOnDelete }: PlanActionsProps) {
  const { showToast } = useToast();
  const rename = useRenamePlan();
  const recalibrate = useRecalibratePlan();
  const activate = useActivatePlan();
  const remove = useDeletePlan();

  const [target, setTarget] = useState<Plan | null>(null);
  const [mode, setMode] = useState<"rename" | "recalibrate" | "delete" | null>(null);
  const [name, setName] = useState("");
  const [recalibrating, setRecalibrating] = useState(false);

  const choose = (m: "rename" | "recalibrate" | "delete") => {
    if (!plan) return;
    setTarget(plan);
    setName(plan.name);
    onClose();
    // Let the menu sheet finish closing first: a modal opened while another closes can be dropped.
    setTimeout(() => setMode(m), MODAL_SWAP_MS);
  };
  const done = () => {
    setMode(null);
    setTarget(null);
  };

  return (
    <>
      <Sheet visible={!!plan} onClose={onClose} title={plan?.name ?? ""}>
        <SettingsGroup>
          <SettingsRow icon="edit" label="Rename" kind="action" onPress={() => choose("rename")} />
          <SettingsRow
            icon="update"
            label="Start next week"
            detail={`Move to week ${(plan?.weekNumber || 1) + 1}, tuned to what you logged this week`}
            kind="action"
            onPress={() => choose("recalibrate")}
          />
          {plan && !plan.isActive ? (
            <SettingsRow
              icon="check-circle"
              label="Make active"
              detail="Home and reminders follow the active plan"
              kind="action"
              busy={activate.isPending}
              onPress={() =>
                activate.mutate(plan.id, {
                  onSuccess: () => {
                    showToast({ type: "success", message: `${plan.name} is now active` });
                    onClose();
                  },
                  onError: (e) => showToast({ type: "error", message: "Couldn't make it active", subtitle: aiErrorMessage(e) }),
                })
              }
            />
          ) : null}
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow icon="delete-outline" label="Delete plan" tone="danger" kind="action" onPress={() => choose("delete")} />
        </SettingsGroup>
      </Sheet>

      {/* Rename */}
      <Sheet visible={mode === "rename"} onClose={rename.isPending ? undefined : done} title="Rename plan">
        <TextField label="Plan name" value={name} onChangeText={setName} maxLength={NAME_MAX} autoFocus returnKeyType="done" />
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Save"
            icon="checkmark"
            loading={rename.isPending}
            disabled={!name.trim() || name.trim() === target?.name || rename.isPending}
            onPress={() =>
              target &&
              rename.mutate(
                { planId: target.id, name: name.trim() },
                {
                  onSuccess: () => {
                    showToast({ type: "success", message: "Plan renamed" });
                    done();
                  },
                  onError: (e) => showToast({ type: "error", message: "Couldn't rename", subtitle: aiErrorMessage(e) }),
                },
              )
            }
            fullWidth
          />
        </View>
      </Sheet>

      {/* Recalibrate */}
      <ConfirmDialog
        visible={mode === "recalibrate"}
        icon="update"
        title={`Start week ${(target?.weekNumber || 1) + 1}?`}
        message="The coach looks at what you logged in the last 7 days and tunes next week's sets and reps. Your training days stay the same, and the change is noted in the coach chat."
        confirmLabel="Start next week"
        onCancel={done}
        onConfirm={() => {
          if (!target) return;
          setMode(null);
          setRecalibrating(true);
          recalibrate.mutate(target.id, {
            onSuccess: (p) => showToast({ type: "success", message: `Week ${p.weekNumber} is ready`, subtitle: "See what changed in the coach chat." }),
            onError: (e) => showToast({ type: "error", message: "Couldn't start next week", subtitle: aiErrorMessage(e) }),
            onSettled: () => {
              setRecalibrating(false);
              setTarget(null);
            },
          });
        }}
      />
      <GeneratingOverlay
        visible={recalibrating}
        title="Preparing next week…"
        inputs={["What you logged in the last 7 days", `This week of ${target?.name ?? ""}`]}
        onStopWaiting={() => setRecalibrating(false)}
      />

      {/* Delete */}
      <ConfirmDialog
        visible={mode === "delete"}
        destructive
        title="Delete this plan?"
        message={`"${target?.name ?? ""}" and its coach chat are removed. Your logged workouts stay.`}
        confirmLabel="Delete plan"
        busy={remove.isPending}
        onCancel={done}
        onConfirm={() =>
          target &&
          remove.mutate(target.id, {
            onSuccess: () => {
              showToast({ type: "success", message: "Plan deleted" });
              done();
              if (leaveOnDelete) router.back();
            },
            onError: (e) => showToast({ type: "error", message: "Couldn't delete", subtitle: aiErrorMessage(e) }),
          })
        }
      />
    </>
  );
}

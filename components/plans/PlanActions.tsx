import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useToast } from "../../providers/ToastContext";
import { useActivatePlan, useDeletePlan, useRenamePlan } from "../../hooks/usePlan";
import type { Plan } from "../../services/api";
import { aiErrorMessage } from "../../utils/aiErrors";
import { motion, spacing } from "../../theme/tokens";
import { SettingsGroup, SettingsRow } from "../profile/Settings";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/TextField";
import { planLength } from "../../utils/planCalendar";
import { StartNextWeek } from "./StartNextWeek";

const NAME_MAX = 60;

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
  const activate = useActivatePlan();
  const remove = useDeletePlan();

  const [target, setTarget] = useState<Plan | null>(null);
  const [mode, setMode] = useState<"rename" | "recalibrate" | "delete" | null>(null);
  const [name, setName] = useState("");
  const hasNextWeek = !!plan && (plan.weekNumber || 1) < planLength(plan.planData);

  const choose = (m: "rename" | "recalibrate" | "delete") => {
    if (!plan) return;
    setTarget(plan);
    setName(plan.name);
    onClose();
    // Let the menu sheet finish closing first: a modal opened while another closes can be dropped.
    setTimeout(() => setMode(m), motion.modalSwapMs);
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
          {hasNextWeek ? (
            <SettingsRow
              icon="update"
              label="Start next week"
              detail={`Move to week ${(plan?.weekNumber || 1) + 1}, tuned to what you logged this week`}
              kind="action"
              onPress={() => choose("recalibrate")}
            />
          ) : null}
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

      {/* Next week */}
      <StartNextWeek plan={target} visible={mode === "recalibrate"} onClose={done} />

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

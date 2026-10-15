import { useState } from "react";
import { useToast } from "../providers/ToastContext";
import { userApi, type User } from "../services/api";
import { createPageLogger } from "../utils/logger";
import { useUpdateProfile } from "./useProfile";

const log = createPageLogger("Profile");

export type ProfileField = "name" | "days" | "experience" | "session" | "equipment" | "avoid" | "goal" | "height" | "age";
export type ProfileUpdate = Parameters<typeof userApi.updateProfile>[0];

/** Every updated field came back with the value sent (lists compared in any order). */
function keptAll(updates: ProfileUpdate, saved: User | undefined) {
  if (!saved) return false;
  return Object.entries(updates).every(([k, v]) => {
    const got = (saved as unknown as Record<string, unknown>)[k];
    if (Array.isArray(v)) return Array.isArray(got) && got.length === v.length && v.every((x) => (got as unknown[]).includes(x));
    return (got ?? null) === (v ?? null);
  });
}

/** Which profile field is being edited, and saving one field at a time (instant save, small toast). */
export function useProfileEditing() {
  const updateProfile = useUpdateProfile();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<ProfileField | null>(null);
  const [saving, setSaving] = useState<ProfileField | null>(null);

  const save = async (field: ProfileField, updates: ProfileUpdate, label: string) => {
    setSaving(field);
    try {
      const saved = await updateProfile.mutateAsync(updates);
      // Only say "saved" if the server really kept it (an outdated server drops fields it doesn't know).
      if (!keptAll(updates, saved)) {
        log.warn(`Server didn't keep ${Object.keys(updates).join(", ")}`);
        showToast({ type: "error", message: `${label} wasn't saved`, subtitle: "The server didn't keep this change. It may need updating; try again later." });
        return false;
      }
      showToast({ type: "success", message: `${label} saved` });
      setEditing(null);
      return true;
    } catch (e) {
      log.error(`Failed to save ${label}: ${e}`);
      showToast({ type: "error", message: `Couldn't save ${label.toLowerCase()}`, subtitle: "Check your connection and try again." });
      return false;
    } finally {
      setSaving(null);
    }
  };

  return { editing, edit: setEditing, close: () => setEditing(null), saving, save };
}

export type ProfileEditing = ReturnType<typeof useProfileEditing>;

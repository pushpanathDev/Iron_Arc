import { GOALS, type FitnessGoal } from "../../data/fitnessGoals";
import { AVOID_OPTIONS, EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, SESSION_OPTIONS, type AvoidArea, type Equipment, type ExperienceLevel, type SessionMinutes, type Weekday } from "../../data/trainingProfile";
import type { ProfileEditing } from "../../hooks/useProfileEditing";
import type { User } from "../../services/api";
import { DaysSheet, HeightSheet, NumberSheet, OptionsSheet } from "./EditSheets";

const HEIGHT_FALLBACK_CM = 170;
const AGE = { min: 13, max: 100, fallback: 25 };

/** The Profile edit sheets; each saves its own field. */
export function ProfileEditSheets({ profile, editing: e }: { profile: User; editing: ProfileEditing }) {
  const open = (field: NonNullable<ProfileEditing["editing"]>) => e.editing === field;
  const busy = (field: NonNullable<ProfileEditing["saving"]>) => e.saving === field;
  return (
    <>
      <DaysSheet
        visible={open("days")}
        value={(profile.trainingDays ?? []) as Weekday[]}
        saving={busy("days")}
        onSave={(d) => void e.save("days", { trainingDays: d }, "Training days")}
        onClose={e.close}
      />
      <OptionsSheet<FitnessGoal>
        visible={open("goal")}
        title="Fitness goal"
        subtitle="Shapes your AI plan's reps, sets and exercise choice."
        options={GOALS.map((g) => ({ value: g.id, label: g.title, hint: g.description }))}
        value={profile.fitnessGoal ? [profile.fitnessGoal as FitnessGoal] : []}
        saving={busy("goal")}
        onSave={([v]) => void e.save("goal", { fitnessGoal: v }, "Fitness goal")}
        onClose={e.close}
      />
      <OptionsSheet<ExperienceLevel>
        visible={open("experience")}
        title="Experience"
        options={EXPERIENCE_OPTIONS}
        value={profile.experienceLevel ? [profile.experienceLevel] : []}
        saving={busy("experience")}
        onSave={([v]) => void e.save("experience", { experienceLevel: v }, "Experience")}
        onClose={e.close}
      />
      <OptionsSheet<SessionMinutes>
        visible={open("session")}
        title="Session length"
        subtitle="How long a usual workout takes you."
        options={SESSION_OPTIONS}
        value={profile.sessionMinutes ? [profile.sessionMinutes] : []}
        saving={busy("session")}
        onSave={([v]) => void e.save("session", { sessionMinutes: v }, "Session length")}
        onClose={e.close}
      />
      <OptionsSheet<Equipment>
        visible={open("equipment")}
        title="Equipment"
        options={EQUIPMENT_OPTIONS}
        value={profile.equipment ? [profile.equipment] : []}
        saving={busy("equipment")}
        onSave={([v]) => void e.save("equipment", { equipment: v }, "Equipment")}
        onClose={e.close}
      />
      <OptionsSheet<AvoidArea>
        visible={open("avoid")}
        title="Go easy on"
        subtitle="Your plan avoids exercises that load these areas heavily. Leave all off if none."
        options={AVOID_OPTIONS}
        value={(profile.avoidAreas ?? []) as AvoidArea[]}
        multiple
        saving={busy("avoid")}
        onSave={(v) => void e.save("avoid", { avoidAreas: v }, "Areas")}
        onClose={e.close}
      />
      <HeightSheet
        visible={open("height")}
        value={profile.height ?? null}
        fallback={HEIGHT_FALLBACK_CM}
        saving={busy("height")}
        onSave={(v) => void e.save("height", { height: v }, "Height")}
        onClose={e.close}
      />
      <NumberSheet
        visible={open("age")}
        title="Age"
        subtitle="Helps your AI plan pick sensible volume and recovery."
        label="Age"
        value={profile.age ?? null}
        fallback={AGE.fallback}
        min={AGE.min}
        max={AGE.max}
        saving={busy("age")}
        onSave={(v) => void e.save("age", { age: v }, "Age")}
        onClose={e.close}
      />
    </>
  );
}

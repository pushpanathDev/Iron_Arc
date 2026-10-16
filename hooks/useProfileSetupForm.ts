import { useState } from "react";
import { DEFAULT_SESSION_MINUTES, DEFAULT_TRAINING_DAYS, type AvoidArea, type Equipment, type ExperienceLevel, type SessionMinutes, type Weekday } from "../data/trainingProfile";
import { GOALS, type FitnessGoal } from "../data/fitnessGoals";
import type { User } from "../services/api";
import type { HeightUnit } from "../utils/height";
import { kgToLbs, toKg, type WeightUnit } from "../utils/unitConversion";

export type SetupField = "name" | "age" | "weight" | "goal" | "experience" | "days" | "equipment" | "target";
export const STEP_FIELDS: Record<1 | 2, SetupField[]> = {
  1: ["name", "age", "weight"],
  2: ["goal", "experience", "days", "equipment", "target"],
};

export type ProfileSetupResult = {
  name: string;
  age: number;
  fitnessGoal: FitnessGoal;
  heightCm: number;
  weightKg: number | null;
  /** Number of training days (mirrors trainingDays.length). */
  weeklyGoal: number;
  experienceLevel: ExperienceLevel;
  equipment: Equipment;
  sessionMinutes: SessionMinutes;
  trainingDays: Weekday[];
  avoidAreas: AvoidArea[];
  targetWeightKg: number | null;
};

const DEFAULT_HEIGHT_CM = 170;
const AGE = { min: 13, max: 100 };
const WEIGHT_KG = { min: 20, max: 300 };
/** Target weight is offered only where it means something. */
const TARGET_GOALS: FitnessGoal[] = ["weight-loss", "muscle"];

const knownGoal = (goal: string | null | undefined) => GOALS.find((g) => g.id === goal)?.id ?? null;
/** A saved kg value as text in the user's unit (one decimal at most). */
const weightText = (kg: number | null | undefined, unit: WeightUnit) => (kg == null ? "" : String(Math.round((unit === "kg" ? kg : kgToLbs(kg)) * 10) / 10));

/**
 * The profile setup answers, their checks and the final result. Editing a field
 * clears its error. Weights are typed in the user's unit and saved in kg.
 *
 * Starts from whatever is already saved (someone sent back to onboarding only
 * fills the gaps). Body weight stays empty: entering it adds a weight log entry.
 */
export function useProfileSetupForm(initialName: string, weightUnit: WeightUnit, saved?: User | null) {
  const [name, setName] = useState(saved?.displayName?.trim() || initialName);
  const [age, setAge] = useState(saved?.age != null ? String(saved.age) : "");
  const [heightCm, setHeightCm] = useState(saved?.height ?? DEFAULT_HEIGHT_CM);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState<FitnessGoal | null>(knownGoal(saved?.fitnessGoal));
  const [experience, setExperience] = useState<ExperienceLevel | null>(saved?.experienceLevel ?? null);
  const [days, setDays] = useState<Weekday[]>(saved?.trainingDays?.length ? (saved.trainingDays as Weekday[]) : DEFAULT_TRAINING_DAYS);
  const [session, setSession] = useState<SessionMinutes>(saved?.sessionMinutes ?? DEFAULT_SESSION_MINUTES);
  const [equipment, setEquipment] = useState<Equipment | null>(saved?.equipment ?? null);
  const [target, setTarget] = useState(weightText(saved?.targetWeight, weightUnit));
  const [avoid, setAvoid] = useState<AvoidArea[]>(saved?.avoidAreas ?? []);
  const [errors, setErrors] = useState<Partial<Record<SetupField, string>>>({});

  const clearError = (field: SetupField) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  /** A setter that also clears that field's error. */
  const edit =
    <T,>(set: (v: T) => void, field: SetupField) =>
    (v: T) => {
      set(v);
      clearError(field);
    };

  const showTarget = !!goal && TARGET_GOALS.includes(goal);
  const parseKg = (text: string) => toKg(Number(text.replace(",", ".")), weightUnit);
  const weightRangeError =
    weightUnit === "kg"
      ? `Enter a weight from ${WEIGHT_KG.min} to ${WEIGHT_KG.max} kg.`
      : `Enter a weight from ${Math.ceil(kgToLbs(WEIGHT_KG.min))} to ${Math.floor(kgToLbs(WEIGHT_KG.max))} lbs.`;
  const badWeight = (text: string) => {
    const kg = parseKg(text);
    return !Number.isFinite(kg) || kg < WEIGHT_KG.min || kg > WEIGHT_KG.max;
  };

  const validate = (step: 1 | 2) => {
    const next: Partial<Record<SetupField, string>> = {};
    if (step === 1) {
      if (!name.trim()) next.name = "Enter your name.";
      const ageNum = Number(age);
      if (!age.trim() || !Number.isInteger(ageNum) || ageNum < AGE.min || ageNum > AGE.max) next.age = `Enter an age from ${AGE.min} to ${AGE.max}.`;
      if (weight.trim() && badWeight(weight)) next.weight = weightRangeError;
    } else {
      if (!goal) next.goal = "Choose a goal.";
      if (!experience) next.experience = "Choose your experience.";
      if (days.length === 0) next.days = "Pick at least one training day.";
      if (!equipment) next.equipment = "Choose your equipment.";
      if (showTarget && target.trim() && badWeight(target)) next.target = weightRangeError;
    }
    return next;
  };

  /** The answers to save; only call after step 2 validates. */
  const result = (): ProfileSetupResult => ({
    name: name.trim(),
    age: Number(age),
    fitnessGoal: goal!,
    heightCm,
    weightKg: weight.trim() ? Math.round(parseKg(weight) * 10) / 10 : null,
    weeklyGoal: days.length,
    experienceLevel: experience!,
    equipment: equipment!,
    sessionMinutes: session,
    trainingDays: days,
    avoidAreas: avoid,
    targetWeightKg: showTarget && target.trim() ? Math.round(parseKg(target) * 10) / 10 : null,
  });

  return {
    weightUnit,
    name,
    setName: edit(setName, "name"),
    age,
    setAge: edit((t: string) => setAge(t.replace(/[^0-9]/g, "")), "age"),
    heightCm,
    setHeightCm,
    heightUnit,
    setHeightUnit,
    weight,
    setWeight: edit((t: string) => setWeight(t.replace(/[^0-9.,]/g, "")), "weight"),
    goal,
    setGoal: edit(setGoal, "goal"),
    experience,
    setExperience: edit(setExperience, "experience"),
    days,
    setDays: edit(setDays, "days"),
    session,
    setSession,
    equipment,
    setEquipment: edit(setEquipment, "equipment"),
    target,
    setTarget: edit((t: string) => setTarget(t.replace(/[^0-9.,]/g, "")), "target"),
    avoid,
    setAvoid,
    showTarget,
    errors,
    setErrors,
    validate,
    result,
  };
}

export type ProfileSetupForm = ReturnType<typeof useProfileSetupForm>;

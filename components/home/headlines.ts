/*
 * Home's cycling headline: a greeting, then a push that fits the moment.
 * Each line picks its wording by date, so it holds all day and changes the
 * next. Kept to ~26 characters: the headline is one line that shrinks to 80%.
 */

export interface HeadlineInput {
  firstName: string;
  trainedToday: boolean;
  week: { daysTrained: number; goal: number | null; met: boolean; remaining: number };
  /** Muscle group to train next, when there's no active plan. */
  suggestion: string | null;
  /** Weeks in a row the goal was met. */
  streak: number;
}

/** The same choice all day, a different one tomorrow. */
function pick(options: string[], now: Date, salt: number): string {
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  return options[(day + salt) % options.length];
}

function greeting(name: string, now: Date): string {
  const hour = now.getHours();
  const n = name ? `, ${name}` : "";
  if (hour < 12) return pick([`Good morning${n}`, `Rise and shine${n}`], now, 0);
  if (hour < 17) return pick([`Good afternoon${n}`, `Let's go${n}!`], now, 0);
  return pick([`Good evening${n}`, `Welcome back${n}`], now, 0);
}

function today(trained: boolean, now: Date): string {
  if (trained) return pick(["Crushed it today!", "Another one in the bank!", "You showed up today!", "Today's work done!"], now, 1);
  const hour = now.getHours();
  if (hour < 12) return pick(["Let's make today count!", "Strong day ahead!"], now, 1);
  if (hour < 17) return pick(["Time to get after it!", "Your session is waiting"], now, 1);
  if (hour < 22) return pick(["Still time to train today", "Finish the day strong!"], now, 1);
  return "Rest up. Go again tomorrow";
}

function weekLine({ daysTrained, goal, met, remaining }: HeadlineInput["week"]): string | null {
  if (!goal) return null;
  if (daysTrained > goal) return "Above and beyond this week";
  if (met) return "Week goal smashed!";
  if (daysTrained === 0) return "New week, fresh start!";
  if (remaining === 1) return "One more day to your goal!";
  return `${daysTrained} of ${goal} down, ${remaining} to go!`;
}

export function homeHeadlines(input: HeadlineInput, now = new Date()): string[] {
  return [
    greeting(input.firstName, now),
    today(input.trainedToday, now),
    weekLine(input.week),
    input.suggestion ? `${input.suggestion} day is calling!` : null,
    input.streak >= 1 ? `${input.streak}-week streak. Keep going!` : null,
  ].filter((m): m is string => !!m);
}

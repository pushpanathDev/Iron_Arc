/*
 * "Open this day" handoff from the plan coach back to the day view (the day
 * view is already on the stack, so it reads the request when it regains focus).
 */
let requested: { planId: string; day: number } | null = null;

/** Ask the day view of `planId` to show `day` (0 = Monday) next time it's focused. */
export function requestPlanDay(planId: string, day: number) {
  requested = { planId, day };
}

/** The requested day for this plan, once (null when none). */
export function takePlanDayRequest(planId: string): number | null {
  if (!requested || requested.planId !== planId) return null;
  const { day } = requested;
  requested = null;
  return day;
}

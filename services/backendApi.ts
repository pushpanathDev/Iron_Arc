import { auth } from "../firebase/config";

const DEFAULT_BASE_URL = __DEV__
  ? "http://localhost:3000"
  : "https://iron-arc-backend.onrender.com";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BASE_URL;

type BackendSuccess<T> = {
  success: true;
  data: T;
};

type BackendFailure = {
  success: false;
  message?: string;
};

type BackendResponse<T> = BackendSuccess<T> | BackendFailure;

/**
 * Gets a fresh Firebase ID token for the current user.
 * getIdToken(true) forces a refresh if the token is about to expire.
 */
async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return await user.getIdToken(true);
}

/**
 * Helper to make authenticated requests to the Iron Arc backend.
 */
async function authenticatedFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getIdToken();

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  let data: BackendResponse<T> | null = null;
  try {
    data = (await res.json()) as BackendResponse<T>;
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }

  if (!res.ok || !data.success) {
    const message = !data.success && data.message ? data.message : undefined;
    throw new Error(message || `Request failed (${res.status})`);
  }

  return data.data;
}

/**
 * Generate a new personalised workout plan.
 * Calls POST /api/plan/generate
 */
export async function generateWorkoutPlan() {
  return authenticatedFetch("/api/plan/generate", { method: "POST" });
}

/**
 * Recalibrate the current active plan based on recent performance.
 * Calls POST /api/plan/recalibrate
 */
export async function recalibrateWeeklyPlan() {
  return authenticatedFetch("/api/plan/recalibrate", { method: "POST" });
}

/**
 * Substitute a specific exercise in the plan.
 * Calls POST /api/plan/substitute
 *
 * @param exerciseId - the exercise ID to replace
 * @param reason - why the user wants a substitute (e.g. "injury", "no_equipment")
 */
export async function substituteExercise(exerciseId: string, reason: string) {
  return authenticatedFetch("/api/plan/substitute", {
    method: "POST",
    body: JSON.stringify({ exerciseId, reason }),
  });
}

/**
 * Check if the backend server is healthy.
 * Calls GET /api/health (no auth required)
 */
export async function checkBackendHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  return await res.json();
}

import { auth } from "./firebase";
import { formatDate } from "../utils/dates";

const DEFAULT_BASE_URL = __DEV__
  ? "http://10.0.2.2:3000"
  : "https://iron-arc-backend-v2.onrender.com";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BASE_URL;

// Types
export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  authProvider: string | null;
  height: number | null;
  weight: number | null;
  age: number | null;
  fitnessGoal: string | null;
  weeklyGoal: number;
  /** Optional target body weight in kg (null = no goal set). Older servers omit it. */
  targetWeight?: number | null;
  /** Training profile (asked once at onboarding). Older servers omit these. */
  experienceLevel?: "beginner" | "intermediate" | "advanced" | null;
  equipment?: "full_gym" | "dumbbells" | "bodyweight" | null;
  sessionMinutes?: 30 | 45 | 60 | 90 | null;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  trainingDays?: number[];
  avoidAreas?: ("knees" | "lower_back" | "shoulders" | "wrists")[];
  activePlan: unknown | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AchievementTier = "bronze" | "silver" | "gold";

/** A catalog badge merged with the user's progress (GET /api/achievements). */
export interface Achievement {
  key: string;
  title: string;
  description: string;
  tier: AchievementTier;
  category: string;
  targetValue: number;
  triggerEvents: string[];
  /** Current value toward targetValue (equals targetValue once unlocked). */
  progress: number;
  /** ISO timestamp, or null while locked. */
  unlockedAt: string | null;
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  setNumber: number;
  reps: number;
  weight: number;
}

export interface Workout {
  id: string;
  userId: string;
  date: string;
  exercise: string;
  category: string;
  notes: string | null;
  sets: WorkoutSet[];
  createdAt: string;
  updatedAt: string;
}

export interface BodyWeight {
  id: string;
  userId: string;
  date: string;
  weekStart: string | null;
  weight: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomExercise {
  id: string;
  userId: string;
  category: string;
  name: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  workouts?: T[];
  weights?: T[];
}

// Date Helpers
function toDateStr(value: string): string {
  return value.split("T")[0];
}

function normalizeWorkout(w: Workout): Workout {
  return { ...w, date: toDateStr(w.date) };
}

function normalizeWeight(w: BodyWeight): BodyWeight {
  return {
    ...w,
    date: toDateStr(w.date),
    weekStart: w.weekStart ? toDateStr(w.weekStart) : null,
  };
}

// Core HTTP Client
async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return await user.getIdToken(false);
}

export type ApiErrorKind = "network" | "timeout" | "http";

export class ApiError extends Error {
  status: number;
  code?: string;
  kind: ApiErrorKind;
  errors?: { field: string; message: string }[];

  constructor(
    message: string,
    status: number,
    code?: string,
    errors?: { field: string; message: string }[],
    kind: ApiErrorKind = "http",
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.kind = kind;
    this.errors = errors;
  }
}

/**
 * Public health check (no auth). Resolves true when the server answers OK
 * within the timeout; false on timeout, network error or a bad response.
 */
export async function checkServerHealth(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function isNetworkApiError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.kind === "network" || error.kind === "timeout");
}

const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const FIRST_REQUEST_TIMEOUT_MS = 20_000;
let hasCompletedRequest = false;

/** Performs the request and returns the full JSON envelope ({ success, data, ... }). */
async function requestEnvelope(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = hasCompletedRequest ? DEFAULT_REQUEST_TIMEOUT_MS : FIRST_REQUEST_TIMEOUT_MS,
): Promise<any> {
  const token = await getIdToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    hasCompletedRequest = true;
    if (__DEV__ && options.method === "DELETE") console.log(`[API] DELETE ${endpoint} → HTTP ${res.status}`);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new ApiError(
      timedOut ? "The server took too long to respond." : "Unable to reach the server.",
      0,
      undefined,
      undefined,
      timedOut ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timeout);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    if (__DEV__ && endpoint.includes("/chat")) console.log(`[Coach] HTTP ${res.status} from ${endpoint}: response was not JSON`);
    throw new ApiError(`Request failed (${res.status})`, res.status);
  }
  if (__DEV__ && endpoint.includes("/chat")) {
    console.log(`[Coach] HTTP ${res.status} · success=${data?.success} · ${data?.success ? "reply received" : `server says: "${data?.message}"`}`);
  }

  if (!res.ok || !data.success) {
    throw new ApiError(
      data.message || `Request failed (${res.status})`,
      res.status,
      data.code,
      data.errors
    );
  }

  return data;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs?: number,
): Promise<T> {
  const data = await requestEnvelope(endpoint, options, timeoutMs);
  return data.data !== undefined ? data.data : data;
}

/** Result of a save that can unlock achievements. */
export interface WithUnlocks<T> {
  data: T;
  /** Badge keys earned by this request (empty when none). */
  newlyUnlocked: string[];
}

async function requestWithUnlocks<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs?: number,
): Promise<WithUnlocks<T>> {
  const body = await requestEnvelope(endpoint, options, timeoutMs);
  return {
    data: (body.data !== undefined ? body.data : body) as T,
    newlyUnlocked: Array.isArray(body.newlyUnlocked) ? body.newlyUnlocked : [],
  };
}

// Pagination
const LIST_ALL_PAGE_SIZE = 500;

/**
 * Fetch every row of a paginated list: page 1 first, then any remaining
 * pages in parallel. The server caps a page at 1000 rows, so a single
 * request can never return a user's whole history.
 */
async function fetchAllPages<T>(
  endpoint: string,
  field: "workouts" | "weights",
): Promise<T[]> {
  const pageUrl = (page: number) => `${endpoint}?page=${page}&limit=${LIST_ALL_PAGE_SIZE}`;

  const first = await request<PaginatedResponse<T>>(pageUrl(1));
  const totalPages = first.totalPages ?? 1;
  if (totalPages <= 1) return first[field] ?? [];

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      request<PaginatedResponse<T>>(pageUrl(i + 2)),
    ),
  );
  return [first, ...rest].flatMap((page) => page[field] ?? []);
}

// User / Profile
export const userApi = {
  sync: () => request<User>("/api/user/sync", { method: "POST" }),

  getProfile: () => request<User>("/api/user/profile"),

  // Body weight isn't here: it follows the weight log (weightApi.log).
  updateProfile: (data: Partial<Pick<User, "displayName" | "avatarUrl" | "authProvider" | "height" | "age" | "fitnessGoal" | "weeklyGoal" | "targetWeight" | "experienceLevel" | "equipment" | "sessionMinutes" | "trainingDays" | "avoidAreas">>) =>
    request<User>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteAccount: () =>
    request<{ message: string }>("/api/user/account", { method: "DELETE" }),
};

// Workouts
export const workoutApi = {
  create: async (data: {
    date: string;
    exercise: string;
    category: string;
    notes?: string;
    sets: { reps: number; weight?: number }[];
  }): Promise<WithUnlocks<Workout>> => {
    const res = await requestWithUnlocks<Workout>("/api/workouts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { ...res, data: normalizeWorkout(res.data) };
  },

  /**
   * POST /api/workouts/batch: a whole session in one transaction (all saved
   * or none). Entries are the single-create shape without the date.
   */
  createBatch: async (data: {
    date: string;
    entries: { exercise: string; category: string; notes?: string; sets: { reps: number; weight?: number }[] }[];
  }): Promise<WithUnlocks<Workout[]>> => {
    const res = await requestWithUnlocks<Workout[]>("/api/workouts/batch", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { ...res, data: res.data.map(normalizeWorkout) };
  },

  getById: async (id: string): Promise<Workout> => {
    const w = await request<Workout>(`/api/workouts/${id}`);
    return normalizeWorkout(w);
  },

  update: async (
    id: string,
    data: Partial<{
      date: string;
      exercise: string;
      category: string;
      notes: string | null;
      sets: { reps: number; weight?: number }[];
    }>
  ): Promise<WithUnlocks<Workout>> => {
    const res = await requestWithUnlocks<Workout>(`/api/workouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { ...res, data: normalizeWorkout(res.data) };
  },

  delete: (id: string) =>
    requestWithUnlocks<{ message: string }>(`/api/workouts/${id}`, { method: "DELETE" }),

  listAll: async (): Promise<Workout[]> => {
    const rows = await fetchAllPages<Workout>("/api/workouts", "workouts");
    return rows.map(normalizeWorkout);
  },
};

// Body Weights
export const weightApi = {
  log: async (data: { date: string; weight: number; weekStart?: string }): Promise<WithUnlocks<BodyWeight>> => {
    const res = await requestWithUnlocks<BodyWeight>("/api/weights", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { ...res, data: normalizeWeight(res.data) };
  },

  getLatest: async (): Promise<BodyWeight> => {
    const w = await request<BodyWeight>("/api/weights/latest");
    return normalizeWeight(w);
  },

  delete: (id: string) =>
    requestWithUnlocks<{ message: string }>(`/api/weights/${id}`, { method: "DELETE" }),

  listAll: async (): Promise<BodyWeight[]> => {
    const rows = await fetchAllPages<BodyWeight>("/api/weights", "weights");
    return rows.map(normalizeWeight);
  },
};

// Custom Exercises
export const exerciseApi = {
  create: (data: { category: string; name: string }) =>
    request<CustomExercise>("/api/exercises", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  list: (category?: string) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    return request<CustomExercise[]>(`/api/exercises${qs}`);
  },

  delete: (id: string) =>
    request<{ message: string }>(`/api/exercises/${id}`, { method: "DELETE" }),
};

// AI Plans
export interface PlanCriteriaPayload {
  sessionDuration?: number;
  equipment?: string;
  experienceLevel?: string;
  splitPreference?: string;
  progressionStyle?: string;
  priorityMuscles?: string[];
  intensity?: string;
  restDayLayout?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Set on the coach's entries that changed the plan (chat replies, swaps, next week). */
  planUpdated?: boolean;
  /** What changed, in plain words; dayIndex 0 = Monday. */
  changes?: { dayIndex: number; text: string }[];
  /** "swap" or "nextWeek" for changes made outside the chat. */
  kind?: "swap" | "nextWeek";
}

export interface PlanChatResponse {
  message: string;
  planUpdated: boolean;
  chatHistory: ChatMessage[];
  planData: unknown;
}

export interface Plan {
  id: string;
  userId: string;
  name: string;
  criteria: PlanCriteriaPayload | null;
  /** The plan itself; the coach chat is inside it, as _chatHistory. */
  planData: unknown;
  isActive: boolean;
  weekNumber: number;
  createdAt: string;
  updatedAt: string;
}

// AI-backed endpoints: the server calls Groq with up to 3 attempts × 30 s,
// so the default 12 s client timeout aborts requests the server completes.
const AI_REQUEST_TIMEOUT_MS = 120_000;

// Full multi-plan API
export const plansApi = {
  list: () =>
    request<Plan[]>("/api/plans"),

  get: (id: string) =>
    request<Plan>(`/api/plans/${id}`),

  generate: (criteria?: PlanCriteriaPayload) =>
    requestWithUnlocks<Plan>(
      "/api/plans/generate",
      {
        method: "POST",
        body: criteria ? JSON.stringify({ criteria }) : undefined,
      },
      AI_REQUEST_TIMEOUT_MS,
    ),

  recalibrate: (planId: string) =>
    request<Plan>(`/api/plans/${planId}/recalibrate`, { method: "POST" }, AI_REQUEST_TIMEOUT_MS),

  substitute: (planId: string, exerciseId: string, reason?: string) =>
    request<Plan>(
      `/api/plans/${planId}/substitute`,
      {
        method: "POST",
        body: JSON.stringify({ exerciseId, reason: reason || "user_request" }),
      },
      AI_REQUEST_TIMEOUT_MS,
    ),

  rename: (planId: string, name: string) =>
    request<Plan>(`/api/plans/${planId}/name`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  activate: (planId: string) =>
    request<Plan>(`/api/plans/${planId}/activate`, { method: "PATCH" }),

  delete: (planId: string) =>
    request<void>(`/api/plans/${planId}`, { method: "DELETE" }),

  chat: (planId: string, message: string) =>
    request<PlanChatResponse>(
      `/api/plans/${planId}/chat`,
      {
        method: "POST",
        // Today's date on the phone, so the coach knows where in the week you are.
        body: JSON.stringify({ message, today: formatDate(new Date()) }),
      },
      AI_REQUEST_TIMEOUT_MS,
    ),
};

// Achievements
export const achievementApi = {
  // Read-only: the client never submits badge keys; the server decides.
  list: () => request<Achievement[]>("/api/achievements"),
};

// Health Check
export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  return res.json();
}


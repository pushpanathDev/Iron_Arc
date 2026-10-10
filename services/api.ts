import { auth } from "../firebase/config";

const DEFAULT_BASE_URL = __DEV__
  ? "http://10.0.2.2:3000"
  : "https://iron-arc-backend.onrender.com";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BASE_URL;

// ─── Types ─────────────────────────────────────────────────────────────

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

/** GET /api/workouts/stats — server aggregates over the full history. */
export interface WorkoutStats {
  /** Distinct calendar dates with at least one workout. */
  totalWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  /** Total reps × weight, in kg. */
  totalVolume: number;
  personalRecords: { exerciseName: string; maxWeight: number; date: string }[];
  distinctExercises: number;
  /** Canonical groups trained: Chest, Back, Shoulders, Arms, Legs, Core. */
  muscleGroupsCovered: string[];
}

/** GET /api/weights/stats — weights in kg, dates as YYYY-MM-DD. */
export interface WeightStats {
  latestWeight: number | null;
  latestDate: string | null;
  firstWeight: number | null;
  firstDate: string | null;
  totalEntries: number;
  distinctDays: number;
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

// ─── Date Helpers ──────────────────────────────────────────────────────

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

// ─── Core HTTP Client ──────────────────────────────────────────────────

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
    throw new ApiError(`Request failed (${res.status})`, res.status);
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

// ─── Pagination ────────────────────────────────────────────────────────

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

// ─── User / Profile ────────────────────────────────────────────────────

export const userApi = {
  sync: () => request<User>("/api/user/sync", { method: "POST" }),

  getProfile: () => request<User>("/api/user/profile"),

  updateProfile: (data: Partial<Pick<User, "displayName" | "avatarUrl" | "height" | "weight" | "age" | "fitnessGoal" | "weeklyGoal">>) =>
    request<User>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteAccount: () =>
    request<{ message: string }>("/api/user/account", { method: "DELETE" }),
};

// ─── Workouts ──────────────────────────────────────────────────────────

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

  list: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Workout>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.category) query.set("category", params.category);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    const qs = query.toString();
    const result = await request<PaginatedResponse<Workout>>(
      `/api/workouts${qs ? `?${qs}` : ""}`
    );
    return {
      ...result,
      workouts: result.workouts?.map(normalizeWorkout),
    };
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

  stats: () => request<WorkoutStats>("/api/workouts/stats"),
};

// ─── Body Weights ──────────────────────────────────────────────────────

export const weightApi = {
  log: async (data: { date: string; weight: number; weekStart?: string }): Promise<WithUnlocks<BodyWeight>> => {
    const res = await requestWithUnlocks<BodyWeight>("/api/weights", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { ...res, data: normalizeWeight(res.data) };
  },

  list: async (params?: { page?: number; limit?: number; startDate?: string; endDate?: string }): Promise<PaginatedResponse<BodyWeight>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    const qs = query.toString();
    const result = await request<PaginatedResponse<BodyWeight>>(
      `/api/weights${qs ? `?${qs}` : ""}`
    );
    return {
      ...result,
      weights: result.weights?.map(normalizeWeight),
    };
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

  stats: () => request<WeightStats>("/api/weights/stats"),
};

// ─── Custom Exercises ──────────────────────────────────────────────────

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

// ─── AI Plans ──────────────────────────────────────────────────────────

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
  planData: unknown;
  chatHistory: ChatMessage[] | null;
  isActive: boolean;
  weekNumber: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Legacy single-plan API (kept for backwards compat with older hooks)
export const planApi = {
  generate: (criteria?: PlanCriteriaPayload) =>
    request<Plan>("/api/plans/generate", {
      method: "POST",
      body: criteria ? JSON.stringify({ criteria }) : undefined,
    }),

  recalibrate: () =>
    request<Plan>("/api/plans/recalibrate", { method: "POST" }),

  substitute: (exerciseId: string, reason?: string) =>
    request<unknown>("/api/plans/substitute", {
      method: "POST",
      body: JSON.stringify({ exerciseId, reason: reason || "user_request" }),
    }),
};

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
        body: JSON.stringify({ message }),
      },
      AI_REQUEST_TIMEOUT_MS,
    ),
};

// ─── Achievements ──────────────────────────────────────────────────────

export const achievementApi = {
  // Read-only: the client never submits badge keys; the server decides.
  list: () => request<Achievement[]>("/api/achievements"),
};

// ─── Health Check ──────────────────────────────────────────────────────

export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  return res.json();
}


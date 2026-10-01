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

export interface ApiAchievement {
  id: string;
  userId: string;
  badgeKey: string;
  unlockedAt: string;
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

class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];

  constructor(
    message: string,
    status: number,
    errors?: { field: string; message: string }[]
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
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
      data.errors
    );
  }

  return data.data !== undefined ? data.data : data;
}

// ─── User / Profile ────────────────────────────────────────────────────

export const userApi = {
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
  }): Promise<Workout> => {
    const w = await request<Workout>("/api/workouts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return normalizeWorkout(w);
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
  ): Promise<Workout> => {
    const w = await request<Workout>(`/api/workouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return normalizeWorkout(w);
  },

  delete: (id: string) =>
    request<{ message: string }>(`/api/workouts/${id}`, { method: "DELETE" }),

  listAll: async (): Promise<Workout[]> => {
    const result = await request<PaginatedResponse<Workout>>("/api/workouts?limit=1000");
    return (result.workouts ?? []).map(normalizeWorkout);
  },
};

// ─── Body Weights ──────────────────────────────────────────────────────

export const weightApi = {
  log: async (data: { date: string; weight: number; weekStart?: string }): Promise<BodyWeight> => {
    const w = await request<BodyWeight>("/api/weights", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return normalizeWeight(w);
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
    request<{ message: string }>(`/api/weights/${id}`, { method: "DELETE" }),

  listAll: async (): Promise<BodyWeight[]> => {
    const result = await request<PaginatedResponse<BodyWeight>>("/api/weights?limit=1000");
    return (result.weights ?? []).map(normalizeWeight);
  },
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

// Full multi-plan API
export const plansApi = {
  list: () =>
    request<Plan[]>("/api/plans"),

  get: (id: string) =>
    request<Plan>(`/api/plans/${id}`),

  generate: (criteria?: PlanCriteriaPayload) =>
    request<Plan>("/api/plans/generate", {
      method: "POST",
      body: criteria ? JSON.stringify({ criteria }) : undefined,
    }),

  recalibrate: (planId: string) =>
    request<Plan>(`/api/plans/${planId}/recalibrate`, { method: "POST" }),

  substitute: (planId: string, exerciseId: string, reason?: string) =>
    request<Plan>(`/api/plans/${planId}/substitute`, {
      method: "POST",
      body: JSON.stringify({ exerciseId, reason: reason || "user_request" }),
    }),

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
    request<PlanChatResponse>(`/api/plans/${planId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

// ─── Achievements ──────────────────────────────────────────────────────

export const achievementApi = {
  list: () => request<ApiAchievement[]>("/api/achievements"),

  unlock: (badgeKey: string) =>
    request<ApiAchievement>("/api/achievements/unlock", {
      method: "POST",
      body: JSON.stringify({ badgeKey }),
    }),

  sync: (badgeKeys: string[]) =>
    request<{ created: number; total: number }>("/api/achievements/sync", {
      method: "POST",
      body: JSON.stringify({ badgeKeys }),
    }),
};

// ─── Health Check ──────────────────────────────────────────────────────

export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  return res.json();
}

export { ApiError };

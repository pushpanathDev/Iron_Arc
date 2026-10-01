// Mock for services/api — used in tests that import from "../services/api"
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

export const workoutApi = {
  listAll: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

export const weightApi = {
  listAll: jest.fn(),
  list: jest.fn(),
  getLatest: jest.fn(),
  log: jest.fn(),
  delete: jest.fn(),
};

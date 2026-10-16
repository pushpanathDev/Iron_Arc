import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { checkServerHealth, isNetworkApiError } from "../services/api";

/*
 * One source of truth for "can we talk to the server?".
 *   online       network up and the health check answered
 *   offline      no network (NetInfo)
 *   waking       network up, server hasn't answered yet (Render free tier sleeps)
 *   unreachable  no answer for GIVE_UP_MS; keeps retrying in the background
 */
export type ConnectionState = "online" | "offline" | "waking" | "unreachable";
export type ServerSimulation = "none" | "slow" | "down";

const HEALTH_TIMEOUT_MS = 20_000;
const WAKING_AFTER_MS = 3_000;
const GIVE_UP_MS = 60_000;
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000];
const SIMULATED_SLOW_MS = 20_000;
const SIMULATED_DOWN_MS = 1_500;
const SIMULATION_KEY = "@dev_simulate_server";

type ConnectionValue = {
  state: ConnectionState;
  /** Network is up (NetInfo). */
  networkUp: boolean;
  /** The health check has answered since the last failure. */
  serverReachable: boolean;
  /** When the current run of failed/slow checks started (for "waking" timers). */
  waitingSince: number | null;
  /** A health check is in flight. */
  checking: boolean;
  /** Most recent successful fetch of any cached query (epoch ms). */
  lastSyncedAt: number | null;
  /** A profile is in the persisted cache, so Home can render saved data. */
  hasCachedData: boolean;
  retry: () => void;
  simulation: ServerSimulation;
  setSimulation: (s: ServerSimulation) => void;
};

const ConnectionContext = createContext<ConnectionValue | null>(null);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [networkUp, setNetworkUp] = useState(true);
  const [serverReachable, setServerReachable] = useState(false);
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [simulation, setSimulationState] = useState<ServerSimulation>("none");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [hasCachedData, setHasCachedData] = useState(false);

  const attemptRef = useRef(0);
  const inFlightRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationRef = useRef<ServerSimulation>("none");
  const reachableRef = useRef(false);
  const networkUpRef = useRef(true);

  const runHealthCheck = useCallback(async () => {
    const sim = simulationRef.current;
    if (__DEV__ && sim === "down") {
      await sleep(SIMULATED_DOWN_MS);
      return false;
    }
    if (__DEV__ && sim === "slow") await sleep(SIMULATED_SLOW_MS);
    return checkServerHealth(HEALTH_TIMEOUT_MS);
  }, []);

  const markReachable = useCallback(
    (reachable: boolean) => {
      const wasReachable = reachableRef.current;
      reachableRef.current = reachable;
      setServerReachable(reachable);
      if (reachable) {
        attemptRef.current = 0;
        setWaitingSince(null);
        // Back online: refresh what's on screen so saved data is replaced.
        if (!wasReachable) void queryClient.invalidateQueries();
      } else {
        setWaitingSince((since) => since ?? Date.now());
      }
    },
    [queryClient],
  );

  const probe = useCallback(async () => {
    if (inFlightRef.current || !networkUpRef.current) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    inFlightRef.current = true;
    setChecking(true);
    if (!reachableRef.current) setWaitingSince((since) => since ?? Date.now());

    const ok = await runHealthCheck();
    inFlightRef.current = false;
    setChecking(false);
    markReachable(ok);

    if (!ok && networkUpRef.current) {
      const delay = BACKOFF_MS[Math.min(attemptRef.current, BACKOFF_MS.length - 1)];
      attemptRef.current += 1;
      retryTimerRef.current = setTimeout(() => void probe(), delay);
    }
  }, [runHealthCheck, markReachable]);

  const retry = useCallback(() => {
    attemptRef.current = 0;
    void probe();
  }, [probe]);

  // Dev simulation survives restarts so cold-start screens can be tested.
  useEffect(() => {
    if (!__DEV__) {
      void probe();
      return;
    }
    AsyncStorage.getItem(SIMULATION_KEY)
      .then((v) => {
        if (v === "slow" || v === "down") {
          simulationRef.current = v;
          setSimulationState(v);
        }
      })
      .finally(() => void probe());
  }, [probe]);

  const setSimulation = useCallback(
    (s: ServerSimulation) => {
      simulationRef.current = s;
      setSimulationState(s);
      AsyncStorage.setItem(SIMULATION_KEY, s).catch(() => {});
      reachableRef.current = false;
      setServerReachable(false);
      setWaitingSince(null);
      attemptRef.current = 0;
      void probe();
    },
    [probe],
  );

  // Network changes: go offline immediately; on reconnect, check right away.
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        const up = s.isConnected !== false;
        const cameBack = up && !networkUpRef.current;
        networkUpRef.current = up;
        setNetworkUp(up);
        if (!up && retryTimerRef.current) clearTimeout(retryTimerRef.current);
        if (cameBack) {
          attemptRef.current = 0;
          void probe();
        }
      }),
    [probe],
  );

  // Back in the foreground: re-check unless we know we're fine.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && !reachableRef.current) {
        attemptRef.current = 0;
        void probe();
      }
    });
    return () => sub.remove();
  }, [probe]);

  // Learn from real traffic: a network failure mid-session starts probing,
  // a success confirms the server. Also tracks lastSyncedAt / cached data.
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const recompute = () => {
      let latest = 0;
      for (const q of cache.getAll()) latest = Math.max(latest, q.state.dataUpdatedAt);
      setLastSyncedAt(latest > 0 ? latest : null);
      setHasCachedData(queryClient.getQueryData(["profile"]) != null);
    };
    recompute();
    return cache.subscribe((event) => {
      if (event.type !== "updated") return;
      const action = event.action;
      if (action.type === "success") {
        if (!reachableRef.current && simulationRef.current === "none") markReachable(true);
        recompute();
      } else if (action.type === "error" && isNetworkApiError(action.error) && reachableRef.current) {
        markReachable(false);
        attemptRef.current = 0;
        void probe();
      }
    });
  }, [queryClient, markReachable, probe]);

  // Tick while waiting so "waking" turns into "unreachable" on time.
  useEffect(() => {
    if (waitingSince == null) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [waitingSince]);

  const state: ConnectionState = useMemo(() => {
    if (!networkUp) return "offline";
    if (serverReachable || waitingSince == null) return "online";
    const waited = now - waitingSince;
    if (waited >= GIVE_UP_MS) return "unreachable";
    if (waited >= WAKING_AFTER_MS) return "waking";
    return "online";
  }, [networkUp, serverReachable, waitingSince, now]);

  const value = useMemo<ConnectionValue>(
    () => ({
      state,
      networkUp,
      serverReachable,
      waitingSince,
      checking,
      lastSyncedAt,
      hasCachedData,
      retry,
      simulation,
      setSimulation,
    }),
    [state, networkUp, serverReachable, waitingSince, checking, lastSyncedAt, hasCachedData, retry, simulation, setSimulation],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionValue {
  const value = useContext(ConnectionContext);
  if (!value) throw new Error("useConnection must be used inside ConnectionProvider");
  return value;
}

/** "just now", "14 min ago", "3 h ago", "2 d ago". */
export function formatRelativeTime(epochMs: number, nowMs = Date.now()): string {
  const s = Math.max(0, Math.round((nowMs - epochMs) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

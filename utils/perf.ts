/*
 * Interaction timings for the Log flow. Logs "[Perf] <label>: N ms" in dev
 * builds, and in preview/release builds when EXPO_PUBLIC_PERF_LOG=1 (read with
 * `adb logcat | grep Perf`). Off and free in normal release builds.
 */
const ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PERF_LOG === "1";
const starts = new Map<string, number>();

export function perfStart(label: string) {
  if (ENABLED) starts.set(label, performance.now());
}

/** Logs a split (time so far) without ending the measurement, e.g. "screen mounted". */
export function perfMark(label: string, step: string) {
  if (!ENABLED) return;
  const t0 = starts.get(label);
  if (t0 != null) console.log(`[Perf] ${label} · ${step}: ${Math.round(performance.now() - t0)} ms`);
}

/** Ends the measurement once the next frame has been drawn. */
export function perfEndAfterFrame(label: string) {
  if (!ENABLED) return;
  const t0 = starts.get(label);
  if (t0 == null) return;
  starts.delete(label);
  requestAnimationFrame(() => {
    console.log(`[Perf] ${label}: ${Math.round(performance.now() - t0)} ms`);
  });
}

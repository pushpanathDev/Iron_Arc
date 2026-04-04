import { useCallback, useEffect, useRef } from "react";

/**
 * Hook for handling long press with continuous callback while pressed
 * Perfect for increment/decrement buttons
 *
 * Features:
 * - Recursive timeout instead of setInterval (safer, more controllable)
 * - Progressive acceleration: starts slow, gradually speeds up
 * - Only one timer running at a time (prevents stacking)
 * - Automatic cleanup on unmount
 * - Stops immediately on release
 *
 * @param callback - Function to call repeatedly while pressed
 * @param initialDelay - Delay before starting repeat (ms) - default 300ms
 * @param repeatInterval - Minimum interval between repeats (ms) - default 80ms
 */
export function useLongPress(
  callback: () => void,
  initialDelay: number = 300,
  repeatInterval: number = 80,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPressingRef = useRef(false);
  const pressCountRef = useRef(0);

  const scheduleNext = useCallback(
    (delay: number) => {
      // Guard: ensure only one timer runs at a time
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        // Guard: check if still pressing before executing
        if (!isPressingRef.current) {
          timerRef.current = null;
          return;
        }

        callback();
        pressCountRef.current++;

        // Progressive acceleration: gradually reduce delay
        // Reduces by 3ms per increment, floors at repeatInterval
        const accelerationFactor = Math.max(
          0,
          initialDelay - pressCountRef.current * 3,
        );
        const nextDelay = Math.max(repeatInterval, accelerationFactor);

        scheduleNext(nextDelay);
      }, delay);
    },
    [callback, initialDelay, repeatInterval],
  );

  const start = useCallback(() => {
    // Guard: prevent stacking multiple presses
    if (isPressingRef.current) {
      return;
    }

    isPressingRef.current = true;
    pressCountRef.current = 0;

    // Call immediately on first press
    callback();
    pressCountRef.current++;

    // Schedule first repeat after initialDelay
    scheduleNext(initialDelay);
  }, [callback, scheduleNext, initialDelay]);

  const stop = useCallback(() => {
    isPressingRef.current = false;

    // Immediately clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    pressCountRef.current = 0;
  }, []);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return {
    onPressIn: start,
    onPressOut: stop,
    onLongPress: () => {}, // Required for Android to register long press intent
  };
}

/**
 * Returns pressable props for a long-press button
 * Usage: <Pressable {...longPressProps} style={...}>
 */
export function useLongPressButton(
  callback: () => void,
  options?: { initialDelay?: number; repeatInterval?: number },
) {
  const { initialDelay = 400, repeatInterval = 80 } = options || {};
  const { onPressIn, onPressOut } = useLongPress(
    callback,
    initialDelay,
    repeatInterval,
  );

  return {
    onPressIn,
    onPressOut,
    // Prevent default onPress from firing after long press
    onPress: () => {},
  };
}

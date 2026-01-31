import { useCallback, useRef } from "react";

/**
 * Hook for handling long press with continuous callback while pressed
 * Perfect for increment/decrement buttons
 *
 * @param callback - Function to call repeatedly while pressed
 * @param initialDelay - Delay before starting repeat (ms) - default 400ms
 * @param repeatInterval - Interval between repeats (ms) - default 80ms
 */
export function useLongPress(
  callback: () => void,
  initialDelay: number = 400,
  repeatInterval: number = 80,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    // Call immediately on first press
    callback();

    // Start repeating after initial delay
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        callback();
      }, repeatInterval);
    }, initialDelay);
  }, [callback, initialDelay, repeatInterval]);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    onPressIn: start,
    onPressOut: stop,
    // Also stop on leave (if finger moves off button)
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

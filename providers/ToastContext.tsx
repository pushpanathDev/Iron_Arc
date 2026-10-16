import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Toast, type ToastConfig } from "../components/ui/Toast";

interface ToastContextType {
  showToast: (config: ToastConfig) => void;
  /** Drop errors that a retry has made out of date (they stay up until dismissed otherwise). */
  clearErrors: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  clearErrors: () => {},
});

type QueuedToast = ToastConfig & { id: number };

/**
 * One toast visible at a time; the rest wait in a queue. An undo toast jumps
 * the queue (replacing what's showing) so its window can't expire unseen.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedToast[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((config: ToastConfig) => {
    const toast = { ...config, id: nextId.current++ };
    setQueue((q) => (config.type === "undo" ? [toast, ...q.slice(1)] : [...q, toast]));
  }, []);

  const dismiss = useCallback((id: number) => {
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setQueue((q) => q.filter((t) => t.type !== "error"));
  }, []);

  const current = queue[0];

  return (
    <ToastContext.Provider value={{ showToast, clearErrors }}>
      {children}
      {current && <Toast key={current.id} {...current} onDismiss={() => dismiss(current.id)} />}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

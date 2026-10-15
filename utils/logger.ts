/** Console logger tagged with the screen name, e.g. "[Profile] Saved name". Handled failures go to warn. */
export function createPageLogger(page: string) {
  const line = (op: string, details?: string) => `[${page}] ${op}${details ? `: ${details}` : ""}`;
  return {
    info: (op: string, details?: string) => console.log(line(op, details)),
    success: (op: string, details?: string) => console.log(line(op, details)),
    warn: (op: string, details?: string) => console.warn(line(op, details)),
    error: (op: string, details?: string, data?: unknown) => console.warn(line(op, details), data ?? ""),
  };
}

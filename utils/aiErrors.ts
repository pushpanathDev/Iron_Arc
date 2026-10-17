import { ApiError } from "../services/api";

/** Plain words for AI request failures (the server rate-limits generate, recalibrate, swap and chat). */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.kind === "network") return "Couldn't reach the server. Check your connection and try again.";
    if (e.kind === "timeout") return "The AI took too long. If a plan was made, it will appear in your list.";
    // The server's reason when it gives one ("Plan generation limit reached…").
    if (e.message && !/^request failed|^http \d+|internal server error|^error$/i.test(e.message)) return e.message;
    if (e.status === 429) return "You've reached the AI limit for now. Try again in a little while.";
    if (__DEV__) console.warn(`[AI] ${e.status} ${e.message}`);
    // The status helps tell a server failure (5xx) from anything else.
    return `Something went wrong (${e.status}). Please try again.`;
  }
  if (__DEV__) console.warn("[AI] request failed:", e);
  return "Something went wrong. Please try again.";
}

/* ======================================================
   STRUCTURED LOGGING SYSTEM
   
   Provides consistent logging across all pages with:
   - Timestamps
   - Log levels (info, warn, error)
   - Context (page name, operation)
   - Batch logging for startup state
   ====================================================== */

export enum LogLevel {
  INFO = "ℹ️",
  SUCCESS = "✅",
  WARNING = "⚠️",
  ERROR = "❌",
  DEBUG = "🔍",
  SYNC = "☁️",
  DB = "💾",
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  page?: string;
  operation: string;
  details?: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  log(
    level: LogLevel,
    operation: string,
    details?: string,
    data?: any,
    page?: string,
  ) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      operation,
      details,
      data,
      page,
    };

    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Format output
    const pageLabel = page ? `[${page}]` : "";
    const message = `${level} ${pageLabel} ${operation}`;

    if (details) {
      console.log(`${message} - ${details}`);
    } else {
      console.log(message);
    }

    if (data) {
      console.log(data);
    }
  }

  // Convenience methods
  info(op: string, details?: string, page?: string) {
    this.log(LogLevel.INFO, op, details, undefined, page);
  }

  success(op: string, details?: string, page?: string) {
    this.log(LogLevel.SUCCESS, op, details, undefined, page);
  }

  warn(op: string, details?: string, page?: string) {
    this.log(LogLevel.WARNING, op, details, undefined, page);
  }

  error(op: string, details?: string, data?: any, page?: string) {
    this.log(LogLevel.ERROR, op, details, data, page);
  }

  debug(op: string, data?: any, page?: string) {
    this.log(LogLevel.DEBUG, op, "", data, page);
  }

  sync(op: string, details?: string) {
    this.log(LogLevel.SYNC, op, details);
  }

  db(op: string, details?: string) {
    this.log(LogLevel.DB, op, details);
  }

  // Get all logs
  getLogs(): LogEntry[] {
    return this.logs;
  }

  // Clear logs
  clear() {
    this.logs = [];
  }

  // Export logs as JSON (for debugging)
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Print recent logs table
  table() {
    console.table(
      this.logs.map((l) => ({
        time: new Date(l.timestamp).toLocaleTimeString(),
        level: l.level,
        page: l.page || "-",
        operation: l.operation,
        details: l.details || "-",
      })),
    );
  }
}

export const logger = new Logger();

/* ======================================================
   PAGE-SPECIFIC LOGGERS
   ====================================================== */

export function createPageLogger(pageName: string) {
  return {
    info: (op: string, details?: string) => logger.info(op, details, pageName),
    success: (op: string, details?: string) =>
      logger.success(op, details, pageName),
    warn: (op: string, details?: string) => logger.warn(op, details, pageName),
    error: (op: string, details?: string, data?: any) =>
      logger.error(op, details, data, pageName),
    debug: (op: string, data?: any) => logger.debug(op, data, pageName),
  };
}

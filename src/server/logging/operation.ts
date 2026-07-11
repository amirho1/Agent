import { performance } from "node:perf_hooks";
import type { Logger } from "pino";
import { getRequestLogger } from "./context";
import { sanitizeForLogging } from "./redaction";

export type OperationLogDetails = Record<string, unknown>;

export async function withLoggedOperation<T>(
  operation: string,
  details: OperationLogDetails,
  callback: (logger: Logger) => Promise<T>,
): Promise<T> {
  const logger = getRequestLogger();
  const startedAt = performance.now();
  const safeDetails = sanitizeForLogging(details);

  logger.info(
    {
      event: "operation.started",
      operation,
      ...safeDetails,
    },
    `${operation} started`,
  );

  try {
    const result = await callback(logger);
    logger.info(
      {
        event: "operation.completed",
        operation,
        durationMs: getDurationMs(startedAt),
        ...safeDetails,
      },
      `${operation} completed`,
    );
    return result;
  } catch (error) {
    logger.error(
      {
        event: "operation.failed",
        operation,
        durationMs: getDurationMs(startedAt),
        ...safeDetails,
        err: error,
      },
      `${operation} failed`,
    );
    throw error;
  }
}

export function logOperationEvent(
  operation: string,
  event: string,
  details: OperationLogDetails = {},
): void {
  getRequestLogger().info(
    {
      event,
      operation,
      ...sanitizeForLogging(details),
    },
    event,
  );
}

export function logOperationError(
  operation: string,
  event: string,
  error: unknown,
  details: OperationLogDetails = {},
): void {
  getRequestLogger().error(
    {
      event,
      operation,
      ...sanitizeForLogging(details),
      err: error,
    },
    event,
  );
}

export function getDurationMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

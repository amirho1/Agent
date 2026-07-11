import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "pino";
import { getLoggingSystem } from "./logger";

export type RequestLogContext = {
  requestId: string;
  correlationId: string;
  userId: string | null;
  organizationId: string | null;
  routeName: string;
  routeParams: Record<string, string>;
  logger: Logger;
};

const requestContextStorage = new AsyncLocalStorage<RequestLogContext>();

export function runWithRequestContext<T>(
  context: RequestLogContext,
  operation: () => Promise<T>,
): Promise<T> {
  return requestContextStorage.run(context, operation);
}

export function getRequestContext(): RequestLogContext | undefined {
  return requestContextStorage.getStore();
}

export function getRequestLogger(): Logger {
  return getRequestContext()?.logger ?? getLoggingSystem().appLogger;
}

export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}

export function getCorrelationId(): string | undefined {
  return getRequestContext()?.correlationId;
}

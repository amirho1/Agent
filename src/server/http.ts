import { performance } from "node:perf_hooks";
import { getCorrelationId, getRequestId, getRequestLogger } from "./logging";
import {
  headersToRecord,
  sanitizeForLogging,
  sanitizeHeaders,
} from "./logging/redaction";

export type FetchJsonOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  targetService?: string;
  logResponseBody?: boolean;
  retryAttempts?: number;
};

/**
 * Fetch JSON and throw a readable error when the response fails.
 * @param url - Request URL.
 * @param options - Fetch options.
 * @returns Parsed JSON body.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const logger = getRequestLogger();
  const startedAt = performance.now();
  const method = options.method ?? "GET";
  const requestId = getRequestId() ?? crypto.randomUUID();
  const correlationId = getCorrelationId() ?? requestId;
  const hasBody = options.body !== undefined;
  const targetService = options.targetService ?? inferTargetService(url);
  const headers = {
    ...(hasBody ? { "content-type": "application/json" } : {}),
    ...headersToRecord(options.headers),
    "x-request-id": requestId,
    "x-correlation-id": correlationId,
  };
  const requestPayload = sanitizeForLogging(options.body);
  let failureLogged = false;

  logger.info(
    {
      event: "outbound_http.started",
      requestId,
      correlationId,
      outboundRequest: {
        targetService,
        url,
        method,
        headers: sanitizeHeaders(headers),
        payload: requestPayload,
        retryAttempts: options.retryAttempts ?? 0,
      },
    },
    "outbound HTTP request started",
  );

  const response = await fetch(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  }).catch((error) => {
    failureLogged = true;
    logger.error(
      {
        event: "outbound_http.failed",
        requestId,
        correlationId,
        outboundRequest: {
          targetService,
          url,
          method,
          headers: sanitizeHeaders(headers),
          payload: requestPayload,
          retryAttempts: options.retryAttempts ?? 0,
        },
        latencyMs: getDurationMs(startedAt),
        err: error,
      },
      "outbound HTTP request failed",
    );
    throw error;
  });

  const responseText = await response.text();
  const responseBody = parseResponseBody(
    responseText,
    response.headers.get("content-type") ?? "",
  );
  const responseLog = {
    targetService,
    url,
    method,
    requestHeaders: sanitizeHeaders(headers),
    payload: requestPayload,
    statusCode: response.status,
    body:
      options.logResponseBody === false
        ? undefined
        : sanitizeForLogging(responseBody),
    latencyMs: getDurationMs(startedAt),
    retryAttempts: options.retryAttempts ?? 0,
  };

  if (!response.ok) {
    const error = new Error(readErrorMessage(response.status, responseBody));
    failureLogged = true;
    logger.error(
      {
        event: "outbound_http.failed",
        requestId,
        correlationId,
        outboundRequest: responseLog,
        err: error,
      },
      "outbound HTTP request failed",
    );
    throw error;
  }

  try {
    const parsed = parseJsonResponse<T>(responseText);
    logger.info(
      {
        event: "outbound_http.completed",
        requestId,
        correlationId,
        outboundRequest: responseLog,
      },
      "outbound HTTP request completed",
    );
    return parsed;
  } catch (error) {
    if (!failureLogged) {
      logger.error(
        {
          event: "outbound_http.failed",
          requestId,
          correlationId,
          outboundRequest: responseLog,
          err: error,
        },
        "outbound HTTP response parsing failed",
      );
    }
    throw error;
  }
}

function parseJsonResponse<T>(responseText: string): T {
  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

function parseResponseBody(responseText: string, contentType: string): unknown {
  if (!responseText) {
    return null;
  }

  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      return JSON.parse(responseText);
    } catch {
      return responseText;
    }
  }

  return responseText;
}

function readErrorMessage(status: number, responseBody: unknown): string {
  const fallback = `Request failed with ${status}`;

  if (
    responseBody &&
    typeof responseBody === "object" &&
    !Array.isArray(responseBody)
  ) {
    const body = responseBody as { error?: unknown; message?: unknown };
    return typeof body.error === "string"
      ? body.error
      : typeof body.message === "string"
        ? body.message
        : fallback;
  }

  return fallback;
}

function inferTargetService(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function getDurationMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

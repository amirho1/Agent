import { performance } from "node:perf_hooks";
import { NextResponse } from "next/server";
import { getRequestLogger, runWithRequestContext } from "./context";
import { getLoggingSystem } from "./logger";
import { getDurationMs } from "./operation";
import { sanitizeForLogging } from "./redaction";

type RouteParams = Record<string, string>;

type RouteContext<TParams extends RouteParams> = {
  params?: Promise<TParams> | TParams;
};

type RouteHandler<TParams extends RouteParams> = (
  request: Request,
  context: { params: Promise<TParams> },
) => Response | Promise<Response>;

export function withApiLogging<TParams extends RouteParams = RouteParams>(
  routeName: string,
  handler: RouteHandler<TParams>,
): RouteHandler<TParams> {
  return async function loggedRouteHandler(request, context) {
    const startedAt = performance.now();
    const logging = getLoggingSystem();
    const url = new URL(request.url);
    const requestId =
      getHeader(request, "x-request-id") ??
      getHeader(request, "x-correlation-id") ??
      crypto.randomUUID();
    const correlationId = getHeader(request, "x-correlation-id") ?? requestId;
    const routeParams = await resolveRouteParams(context);
    const userId = getHeader(request, "x-user-id");
    const organizationId = getHeader(request, "x-organization-id");
    const requestBody = await readRequestBodyForLog(request);
    const requestContext = {
      requestId,
      correlationId,
      userId,
      organizationId,
      routeName,
      routeParams,
      logger: logging.appLogger.child({
        requestId,
        correlationId,
        userId,
        organizationId,
        routeName,
      }),
    };

    return runWithRequestContext(requestContext, async () => {
      let response: Response;

      try {
        getRequestLogger().info(
          {
            event: "http.request.received",
            request: {
              method: request.method,
              url: url.pathname,
              query: queryParamsToObject(url.searchParams),
              routeParams,
              body: requestBody,
              ip: getClientIp(request),
              userAgent: getHeader(request, "user-agent"),
            },
          },
          "incoming HTTP request received",
        );

        response = await handler(request, {
          params: Promise.resolve(routeParams as TParams),
        });
      } catch (error) {
        getRequestLogger().error(
          {
            event: "http.request.unhandled_error",
            routeName,
            err: error,
          },
          "unhandled API route error",
        );
        response = NextResponse.json(
          { error: getErrorMessage(error, "Request failed.") },
          { status: 500 },
        );
      }

      response.headers.set("x-request-id", requestId);
      logging.accessLogger.info(
        {
          event: "http.request.completed",
          requestId,
          correlationId,
          userId,
          organizationId,
          method: request.method,
          url: url.pathname,
          query: queryParamsToObject(url.searchParams),
          routeParams,
          body: requestBody,
          ip: getClientIp(request),
          userAgent: getHeader(request, "user-agent"),
          statusCode: response.status,
          responseTimeMs: getDurationMs(startedAt),
        },
        "incoming HTTP request completed",
      );

      return response;
    });
  };
}

export function routeErrorResponse(
  error: unknown,
  fallbackMessage: string,
  status = 400,
): NextResponse {
  getRequestLogger().error(
    {
      event: "http.request.error",
      statusCode: status,
      err: error,
    },
    fallbackMessage,
  );

  return NextResponse.json(
    { error: getErrorMessage(error, fallbackMessage) },
    { status },
  );
}

export async function readRequestBodyForLog(
  request: Request,
): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length");
  if (!contentType && !contentLength) {
    return undefined;
  }

  try {
    const clone = request.clone();

    if (contentType.includes("multipart/form-data")) {
      const formData = await clone.formData();
      return sanitizeForLogging(formDataToObject(formData));
    }

    if (
      contentType.includes("application/json") ||
      contentType.includes("+json")
    ) {
      return sanitizeForLogging(await clone.json());
    }

    const text = await clone.text();
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return sanitizeForLogging(queryParamsToObject(new URLSearchParams(text)));
    }

    return sanitizeForLogging(text);
  } catch (error) {
    return {
      unreadable: true,
      error: getErrorMessage(error, "Request body could not be logged."),
    };
  }
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

async function resolveRouteParams<TParams extends RouteParams>(
  context: RouteContext<TParams> | undefined,
): Promise<TParams> {
  return ((await context?.params) ?? {}) as TParams;
}

function getHeader(request: Request, name: string): string | null {
  return request.headers.get(name);
}

function getClientIp(request: Request): string | null {
  const forwardedFor = getHeader(request, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return getHeader(request, "x-real-ip");
}

function queryParamsToObject(
  params: URLSearchParams,
): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};

  for (const [key, value] of params.entries()) {
    const existing = output[key];
    if (existing === undefined) {
      output[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      output[key] = [existing, value];
    }
  }

  return output;
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    const entry =
      typeof value === "string"
        ? value
        : {
            fileName: value.name,
            contentType: value.type || null,
            size: value.size,
          };
    const existing = output[key];
    if (existing === undefined) {
      output[key] = entry;
    } else if (Array.isArray(existing)) {
      existing.push(entry);
    } else {
      output[key] = [existing, entry];
    }
  }

  return output;
}

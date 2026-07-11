export const REDACTED_VALUE = "[REDACTED]";

const SENSITIVE_KEY_PATTERN =
  /(?:authorization|cookie|set-cookie|password|passwd|token|jwt|api[-_]?key|secret|credential|session)/i;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(password|token|jwt|api[-_]?key|secret)=([^&\s]+)/gi;

export const pinoRedactionPaths = [
  "authorization",
  "Authorization",
  "cookie",
  "Cookie",
  "headers.authorization",
  "headers.Authorization",
  "headers.cookie",
  "headers.Cookie",
  "headers.set-cookie",
  "headers.Set-Cookie",
  "headers.exchange-authorization",
  "headers.Exchange-Authorization",
  "request.headers.authorization",
  "request.headers.Authorization",
  "request.headers.cookie",
  "request.headers.Cookie",
  "request.headers.exchange-authorization",
  "request.headers.Exchange-Authorization",
  "response.headers.set-cookie",
  "body.password",
  "body.token",
  "body.apiKey",
  "body.api_key",
  "*.password",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.secret",
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function sanitizeForLogging<T>(value: T): T {
  return sanitizeValue(value, new WeakSet()) as T;
}

export function sanitizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const normalized = headersToRecord(headers);

  return Object.fromEntries(
    Object.entries(normalized).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? REDACTED_VALUE : redactSecretStrings(value),
    ]),
  );
}

export function headersToRecord(
  headers: HeadersInit | undefined,
): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, value]));
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(value)]),
  );
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactSecretStrings(value);
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URLSearchParams) {
    return sanitizeValue(Object.fromEntries(value.entries()), seen);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof File !== "undefined" && value instanceof File) {
    return {
      fileName: value.name,
      contentType: value.type || null,
      size: value.size,
    };
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? REDACTED_VALUE : sanitizeValue(item, seen),
    ]),
  );
}

function redactSecretStrings(value: string): string {
  return value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(JWT_PATTERN, REDACTED_VALUE)
    .replace(SECRET_ASSIGNMENT_PATTERN, (_match, key: string) => {
      return `${key}=${REDACTED_VALUE}`;
    });
}

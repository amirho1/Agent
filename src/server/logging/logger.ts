import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";
import pinoHttp, { type HttpLogger } from "pino-http";
import pretty from "pino-pretty";
import {
  createStream,
  type Generator,
  type RotatingFileStream,
} from "rotating-file-stream";
import { pinoRedactionPaths } from "./redaction";

export type LogKind = "app" | "access" | "error";

export type LoggingSystem = {
  appLogger: Logger;
  accessLogger: Logger;
  errorLogger: Logger;
  nodeHttpLogger: HttpLogger;
  logDir: string;
  streams: Record<LogKind, RotatingFileStream>;
};

export type CreateLoggingSystemOptions = {
  logDir?: string;
  nodeEnv?: string;
  level?: string;
  serviceName?: string;
  enableConsole?: boolean;
  prettyConsole?: boolean;
};

const globalForLogging = globalThis as unknown as {
  agentLoggingSystem?: LoggingSystem;
};

export function getLoggingSystem(): LoggingSystem {
  if (!globalForLogging.agentLoggingSystem) {
    globalForLogging.agentLoggingSystem = createLoggingSystem();
  }

  return globalForLogging.agentLoggingSystem;
}

export function resetLoggingSystemForTests(): void {
  globalForLogging.agentLoggingSystem = undefined;
}

export function setLoggingSystemForTests(system: LoggingSystem): void {
  globalForLogging.agentLoggingSystem = system;
}

export function createLoggingSystem(
  options: CreateLoggingSystemOptions = {},
): LoggingSystem {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const logDir = resolve(options.logDir ?? getDefaultLogDir(nodeEnv));
  mkdirSync(logDir, { recursive: true });

  const streams = {
    app: createDailyLogStream("app", logDir),
    access: createDailyLogStream("access", logDir),
    error: createDailyLogStream("error", logDir),
  };

  const loggerOptions = createLoggerOptions({
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    serviceName: options.serviceName ?? process.env.LOG_SERVICE_NAME ?? "agent",
  });
  const enableConsole = options.enableConsole ?? nodeEnv !== "test";
  const prettyConsole = options.prettyConsole ?? nodeEnv !== "production";

  const appLogger = pino(
    loggerOptions,
    pino.multistream([
      { stream: streams.app },
      { level: "error", stream: streams.error },
      ...createConsoleEntries(enableConsole, prettyConsole),
    ]),
  );
  const accessLogger = pino(
    loggerOptions,
    pino.multistream([
      { stream: streams.access },
      ...createConsoleEntries(enableConsole, prettyConsole),
    ]),
  );
  const errorLogger = pino(
    loggerOptions,
    pino.multistream([
      { level: "error", stream: streams.error },
      ...createConsoleEntries(enableConsole, prettyConsole),
    ]),
  );

  const nodeHttpLogger = pinoHttp({
    logger: accessLogger,
    autoLogging: true,
    genReqId(request) {
      return (
        request.headers["x-request-id"] ??
        request.headers["x-correlation-id"] ??
        crypto.randomUUID()
      );
    },
    customAttributeKeys: {
      reqId: "requestId",
      responseTime: "responseTimeMs",
    },
  });

  return {
    appLogger,
    accessLogger,
    errorLogger,
    nodeHttpLogger,
    logDir,
    streams,
  };
}

export function getDefaultLogDir(nodeEnv?: string): string {
  if (process.env.LOG_DIR?.trim()) {
    return process.env.LOG_DIR.trim();
  }

  return nodeEnv === "production" ? "/logs" : join(process.cwd(), "logs");
}

export function dailyLogFileName(kind: LogKind, date = new Date()): string {
  return `${kind}-${formatDate(date)}.log`;
}

export function createDailyLogStream(
  kind: LogKind,
  logDir: string,
): RotatingFileStream {
  const generator = ((time: number | Date | null | undefined) => {
    return dailyLogFileName(kind, coerceDate(time));
  }) as Generator;

  return createStream(generator, {
    path: logDir,
    interval: "1d",
    intervalBoundary: true,
    immutable: true,
    encoding: "utf8",
  });
}

export async function closeLoggingSystem(system: LoggingSystem): Promise<void> {
  await Promise.all(
    Object.values(system.streams).map(
      (stream) =>
        new Promise<void>((resolveClose) => {
          stream.end(resolveClose);
        }),
    ),
  );
}

function createLoggerOptions(input: {
  level: string;
  serviceName: string;
}): LoggerOptions {
  return {
    level: input.level,
    base: {
      service: input.serviceName,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: pinoRedactionPaths,
      censor: "[REDACTED]",
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  };
}

function createConsoleEntries(
  enableConsole: boolean,
  prettyConsole: boolean,
): Array<{ stream: DestinationStream }> {
  if (!enableConsole) {
    return [];
  }

  if (prettyConsole) {
    return [
      {
        stream: pretty({
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        }) as DestinationStream,
      },
    ];
  }

  return [{ stream: process.stdout }];
}

function coerceDate(time: number | Date | null | undefined): Date {
  if (time instanceof Date) {
    return time;
  }

  if (typeof time === "number") {
    return new Date(time);
  }

  return new Date();
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

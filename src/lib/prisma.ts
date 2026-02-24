import { Prisma, PrismaClient } from "@prisma/client";

const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 250;

const isSlowQueryLoggingEnabled = () => {
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  const raw = process.env.PERF_LOGGING_ENABLED;
  if (!raw) {
    return true;
  }

  return /^(1|true|yes)$/i.test(raw);
};

const readSlowQueryThreshold = () => {
  const raw = Number.parseInt(process.env.PRISMA_SLOW_QUERY_THRESHOLD_MS ?? "", 10);
  if (Number.isNaN(raw) || raw <= 0) {
    return DEFAULT_SLOW_QUERY_THRESHOLD_MS;
  }
  return raw;
};

const normalizeQuery = (value: string) => value.replace(/\s+/g, " ").trim();

const hashValue = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(16);
};

const createPrismaClient = () => {
  const queryLoggingEnabled = isSlowQueryLoggingEnabled();
  const client = new PrismaClient(
    queryLoggingEnabled
      ? {
          log: [{ emit: "event", level: "query" }],
        }
      : undefined
  );

  if (queryLoggingEnabled) {
    const thresholdMs = readSlowQueryThreshold();
    client.$on("query", (event: Prisma.QueryEvent) => {
      if (event.duration < thresholdMs) {
        return;
      }

      const normalizedQuery = normalizeQuery(event.query);
      const tableMatch = normalizedQuery.match(
        /\b(?:from|into|update)\s+"?([a-z0-9_]+)"?/i
      );

      console.info(
        "[server-perf]",
        JSON.stringify({
          phase: "db.slow_query",
          route: "/server/prisma",
          duration_ms: event.duration,
          success: true,
          meta: {
            threshold_ms: thresholdMs,
            query_hash: hashValue(normalizedQuery),
            table: tableMatch ? tableMatch[1] : null,
            target: event.target,
          },
        })
      );
    });
  }

  return client;
};

declare global {
  var prisma: undefined | ReturnType<typeof createPrismaClient>;
}

const prisma = globalThis.prisma ?? createPrismaClient();

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

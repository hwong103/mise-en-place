import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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

const readCloudflareD1Binding = (): ConstructorParameters<typeof PrismaD1>[0] | undefined => {
  try {
    const { env } = getCloudflareContext();
    return (env as Record<string, unknown>).DB as ConstructorParameters<typeof PrismaD1>[0] | undefined;
  } catch {
    return undefined;
  }
};

const createPrismaClient = () => {
  const queryLoggingEnabled = isSlowQueryLoggingEnabled();
  const d1Binding = readCloudflareD1Binding();
  const adapter = d1Binding ? new PrismaD1(d1Binding) : undefined;
  const options: Record<string, unknown> = queryLoggingEnabled
    ? {
        log: [{ emit: "event", level: "query" }],
      }
    : {};

  if (adapter) {
    options.adapter = adapter;
  }

  const client = new PrismaClient(options as ConstructorParameters<typeof PrismaClient>[0]);

  if (queryLoggingEnabled) {
    const thresholdMs = readSlowQueryThreshold();
    (client as PrismaClient & { $on: (eventType: string, callback: (event: Prisma.QueryEvent) => void) => void }).$on(
      "query",
      (event: Prisma.QueryEvent) => {
      if (event.duration < thresholdMs) {
        return;
      }

      const normalizedQuery = normalizeQuery(event.query);
      const tableMatch = normalizedQuery.match(
        /\b(?:from|into|update)\s+"?(?:([a-z0-9_]+)"?\.)?"?([a-z0-9_]+)"?/i
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
            schema: tableMatch ? tableMatch[1] ?? null : null,
            table: tableMatch ? tableMatch[2] : null,
            target: event.target,
          },
        })
      );
      }
    );
  }

  return client;
};

declare global {
  var prisma: undefined | PrismaClient;
}

let productionPrisma: PrismaClient | undefined;

export const getPrismaClient = () => {
  if (process.env.NODE_ENV === "production") {
    productionPrisma ??= createPrismaClient();
    return productionPrisma;
  }

  globalThis.prisma ??= createPrismaClient();
  return globalThis.prisma;
};

const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;

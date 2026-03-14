import { getCloudflareContext } from "@opennextjs/cloudflare";

export type D1Value = string | number | ArrayBuffer | null;

export type D1QueryResult<T = Record<string, unknown>> = {
  results?: T[];
  success?: boolean;
  meta?: Record<string, unknown>;
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1QueryResult<T>>;
  run(): Promise<D1QueryResult>;
  raw<T = unknown[]>(): Promise<T[]>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = D1QueryResult>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(query: string): Promise<D1QueryResult>;
};

export const getD1Database = (): D1Database => {
  try {
    const { env } = getCloudflareContext();
    const db = (env as Record<string, unknown>).DB;
    if (db && typeof db === "object") {
      return db as D1Database;
    }
  } catch {
    // Ignore outside Cloudflare runtime.
  }

  throw new Error("Cloudflare D1 binding `DB` is not available in this runtime.");
};

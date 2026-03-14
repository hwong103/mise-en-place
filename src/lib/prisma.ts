/* eslint-disable @typescript-eslint/no-explicit-any */

import { getD1Database } from "@/lib/d1";
import type { D1Database, D1PreparedStatement } from "@/lib/d1";
import type {
  Household,
  HouseholdMember,
  JsonValue,
  MealPlan,
  Recipe,
  ShoppingListItem,
  User,
  Wine,
} from "@/lib/db-types";

type AppModelMap = {
  household: Household;
  householdMember: HouseholdMember;
  mealPlan: MealPlan;
  recipe: Recipe;
  shoppingListItem: ShoppingListItem;
  user: User;
  wine: Wine;
};

type ModelName = keyof AppModelMap;
type RowRecord = Record<string, unknown>;
type FieldKind = "string" | "int" | "float" | "bool" | "date" | "json";
type QueryArgs = {
  where?: Record<string, unknown>;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  take?: number;
  skip?: number;
};
type WriteArgs = QueryArgs & {
  data?: Record<string, unknown>;
};
type AppModelDelegate = {
  findMany(args?: QueryArgs): Promise<any[]>;
  findFirst(args?: QueryArgs): Promise<any | null>;
  findUnique(args?: QueryArgs): Promise<any | null>;
  create(args: WriteArgs): Promise<any>;
  update(args: WriteArgs & { where: Record<string, unknown> }): Promise<any>;
  updateMany(args: WriteArgs & { where: Record<string, unknown> }): Promise<{ count: number }>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  upsert(args: {
    where: Record<string, unknown>;
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }): Promise<any>;
  createMany(args: { data: Array<Record<string, unknown>> }): Promise<{ count: number }>;
};
type PrismaFacade = Record<ModelName, AppModelDelegate> & {
  $transaction<T>(input: Array<Promise<unknown>> | ((tx: any) => Promise<T>)): Promise<T | unknown[]>;
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 250;

const modelConfigs: {
  [K in ModelName]: {
    table: string;
    fields: Record<keyof AppModelMap[K] & string, FieldKind>;
    defaults: Partial<AppModelMap[K]>;
    hasUpdatedAt?: boolean;
    hasCreatedAt?: boolean;
  };
} = {
  household: {
    table: "Household",
    fields: {
      id: "string",
      name: "string",
      createdAt: "date",
      updatedAt: "date",
      shareTokenHash: "string",
      shareTokenVersion: "int",
      claimedByUserId: "string",
      claimedAt: "date",
    },
    defaults: {
      shareTokenHash: null,
      shareTokenVersion: 1,
      claimedByUserId: null,
      claimedAt: null,
    },
    hasCreatedAt: true,
    hasUpdatedAt: true,
  },
  user: {
    table: "User",
    fields: {
      id: "string",
      email: "string",
      name: "string",
      avatarUrl: "string",
      createdAt: "date",
      authProviderUserId: "string",
      betterAuthUserId: "string",
    },
    defaults: {
      name: null,
      avatarUrl: null,
      authProviderUserId: null,
      betterAuthUserId: null,
    },
    hasCreatedAt: true,
  },
  householdMember: {
    table: "HouseholdMember",
    fields: {
      id: "string",
      userId: "string",
      householdId: "string",
      role: "string",
      joinedAt: "date",
    },
    defaults: {
      role: "MEMBER",
    },
    hasCreatedAt: false,
  },
  recipe: {
    table: "Recipe",
    fields: {
      id: "string",
      householdId: "string",
      title: "string",
      description: "string",
      imageUrl: "string",
      sourceUrl: "string",
      servings: "int",
      prepTime: "int",
      cookTime: "int",
      ingredients: "json",
      instructions: "json",
      notes: "json",
      prepGroups: "json",
      tags: "json",
      createdAt: "date",
      updatedAt: "date",
      videoUrl: "string",
      ingredientCount: "int",
      cookCount: "int",
    },
    defaults: {
      description: null,
      imageUrl: null,
      sourceUrl: null,
      servings: null,
      prepTime: null,
      cookTime: null,
      ingredients: [],
      instructions: [],
      notes: null,
      prepGroups: [],
      tags: [],
      videoUrl: null,
      ingredientCount: 0,
      cookCount: 0,
    },
    hasCreatedAt: true,
    hasUpdatedAt: true,
  },
  mealPlan: {
    table: "MealPlan",
    fields: {
      id: "string",
      householdId: "string",
      recipeId: "string",
      date: "date",
      mealType: "string",
      servings: "int",
      cooked: "bool",
      cookedAt: "date",
    },
    defaults: {
      mealType: "DINNER",
      servings: 2,
      cooked: false,
      cookedAt: null,
    },
  },
  shoppingListItem: {
    table: "ShoppingListItem",
    fields: {
      id: "string",
      householdId: "string",
      weekStart: "date",
      line: "string",
      lineNormalized: "string",
      category: "string",
      manual: "bool",
      checked: "bool",
      createdAt: "date",
      updatedAt: "date",
      location: "string",
    },
    defaults: {
      manual: false,
      checked: false,
      location: "Woolies",
    },
    hasCreatedAt: true,
    hasUpdatedAt: true,
  },
  wine: {
    table: "Wine",
    fields: {
      id: "string",
      householdId: "string",
      name: "string",
      producer: "string",
      vintage: "int",
      grapes: "json",
      region: "string",
      country: "string",
      type: "string",
      rating: "int",
      tastingNotes: "string",
      triedAt: "date",
      locationName: "string",
      locationAddress: "string",
      locationLat: "float",
      locationLng: "float",
      imageUrl: "string",
      danMurphysProductId: "string",
      danMurphysUrl: "string",
      danMurphysPrice: "float",
      danMurphysSource: "string",
      danMurphysPriceAt: "date",
      stockists: "json",
      createdAt: "date",
      updatedAt: "date",
    },
    defaults: {
      producer: null,
      vintage: null,
      grapes: [],
      region: null,
      country: null,
      type: "RED",
      rating: null,
      tastingNotes: null,
      triedAt: null,
      locationName: null,
      locationAddress: null,
      locationLat: null,
      locationLng: null,
      imageUrl: null,
      danMurphysProductId: null,
      danMurphysUrl: null,
      danMurphysPrice: null,
      danMurphysSource: null,
      danMurphysPriceAt: null,
      stockists: null,
    },
    hasCreatedAt: true,
    hasUpdatedAt: true,
  },
};

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

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

const createId = () => `cf_${crypto.randomUUID().replace(/-/g, "")}`;

const toStorageValue = (kind: FieldKind, value: unknown) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  switch (kind) {
    case "bool":
      return value ? 1 : 0;
    case "date":
      return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
    case "json":
      return JSON.stringify(value);
    case "int":
      return Math.trunc(Number(value));
    case "float":
      return Number(value);
    default:
      return value;
  }
};

const fromStorageValue = (kind: FieldKind, value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  switch (kind) {
    case "bool":
      return value === true || value === 1 || value === "1";
    case "date":
      return new Date(String(value));
    case "json":
      if (typeof value === "string") {
        try {
          return JSON.parse(value) as JsonValue;
        } catch {
          return null;
        }
      }
      return value as JsonValue;
    case "int":
    case "float":
      return Number(value);
    default:
      return value;
  }
};

const normalizeWhere = (model: ModelName, where: Record<string, unknown> | undefined) => {
  if (!where) {
    return undefined;
  }

  if (model === "shoppingListItem" && "householdId_weekStart_lineNormalized_category_manual" in where) {
    return where.householdId_weekStart_lineNormalized_category_manual as Record<string, unknown>;
  }

  if (model === "householdMember" && "userId_householdId" in where) {
    return where.userId_householdId as Record<string, unknown>;
  }

  return where;
};

const buildWhereClause = (
  model: ModelName,
  where: Record<string, unknown> | undefined,
  params: unknown[]
): string => {
  const normalizedWhere = normalizeWhere(model, where);
  if (!normalizedWhere || Object.keys(normalizedWhere).length === 0) {
    return "";
  }

  const clauses: string[] = [];

  for (const [key, rawValue] of Object.entries(normalizedWhere)) {
    if (key === "OR" && Array.isArray(rawValue)) {
      const orParts = rawValue
        .map((entry) => buildWhereClause(model, entry as Record<string, unknown>, params))
        .filter(Boolean)
        .map((entry) => entry.replace(/^WHERE\s+/i, ""));
      if (orParts.length > 0) {
        clauses.push(`(${orParts.join(" OR ")})`);
      }
      continue;
    }

    if (key === "AND" && Array.isArray(rawValue)) {
      const andParts = rawValue
        .map((entry) => buildWhereClause(model, entry as Record<string, unknown>, params))
        .filter(Boolean)
        .map((entry) => entry.replace(/^WHERE\s+/i, ""));
      if (andParts.length > 0) {
        clauses.push(`(${andParts.join(" AND ")})`);
      }
      continue;
    }

    const kind = modelConfigs[model].fields[key as keyof typeof modelConfigs[typeof model]["fields"]];
    if (!kind) {
      continue;
    }

    const column = quoteIdentifier(key);
    if (rawValue === null) {
      clauses.push(`${column} IS NULL`);
      continue;
    }

    if (isPlainObject(rawValue)) {
      for (const [operator, operand] of Object.entries(rawValue)) {
        if (operator === "in" && Array.isArray(operand) && operand.length > 0) {
          const placeholders = operand.map(() => "?").join(", ");
          clauses.push(`${column} IN (${placeholders})`);
          operand.forEach((value) => params.push(toStorageValue(kind, value)));
          continue;
        }

        if (operator === "startsWith") {
          clauses.push(`${column} LIKE ?`);
          params.push(`${String(operand)}%`);
          continue;
        }

        const comparison =
          operator === "gt"
            ? ">"
            : operator === "gte"
              ? ">="
              : operator === "lt"
                ? "<"
                : operator === "lte"
                  ? "<="
                  : operator === "not"
                    ? "<>"
                    : operator === "equals"
                      ? "="
                      : null;

        if (!comparison) {
          continue;
        }

        clauses.push(`${column} ${comparison} ?`);
        params.push(toStorageValue(kind, operand));
      }
      continue;
    }

    clauses.push(`${column} = ?`);
    params.push(toStorageValue(kind, rawValue));
  }

  if (clauses.length === 0) {
    return "";
  }

  return `WHERE ${clauses.join(" AND ")}`;
};

const buildOrderByClause = (orderBy: QueryArgs["orderBy"]) => {
  if (!orderBy) {
    return "";
  }

  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  const parts = entries.flatMap((entry) =>
    Object.entries(entry).map(([field, direction]) => `${quoteIdentifier(field)} ${String(direction).toUpperCase()}`)
  );

  return parts.length > 0 ? `ORDER BY ${parts.join(", ")}` : "";
};

const rowToModel = <K extends ModelName>(model: K, row: RowRecord): AppModelMap[K] => {
  const config = modelConfigs[model];
  const converted: Record<string, unknown> = {};

  for (const [field, kind] of Object.entries(config.fields)) {
    converted[field] = fromStorageValue(kind, row[field]);
  }

  return converted as AppModelMap[K];
};

const scalarFields = <K extends ModelName>(model: K) => Object.keys(modelConfigs[model].fields);

const scalarClone = <K extends ModelName>(model: K, row: AppModelMap[K] & RowRecord) => {
  const clone: Record<string, unknown> = {};
  for (const field of scalarFields(model)) {
    clone[field] = row[field];
  }
  return clone;
};

const projectModel = <K extends ModelName>(
  model: K,
  row: (AppModelMap[K] & RowRecord) | null,
  args?: QueryArgs
): unknown => {
  if (!row) {
    return null;
  }

  if (args?.select) {
    const projected: Record<string, unknown> = {};
    for (const [field, selector] of Object.entries(args.select)) {
      if (selector === true) {
        projected[field] = row[field];
        continue;
      }

      const nestedSelector = selector as QueryArgs;
      const nestedValue = row[field];
      if (Array.isArray(nestedValue)) {
        projected[field] = nestedValue.map((entry) =>
          projectRelation(field, entry as RowRecord, nestedSelector)
        );
      } else {
        projected[field] = projectRelation(field, nestedValue as RowRecord | null, nestedSelector);
      }
    }
    return projected;
  }

  if (args?.include) {
    const projected = scalarClone(model, row);
    for (const [field, selector] of Object.entries(args.include)) {
      const nestedSelector = selector === true ? undefined : (selector as QueryArgs);
      const nestedValue = row[field];
      if (Array.isArray(nestedValue)) {
        projected[field] = nestedValue.map((entry) =>
          projectRelation(field, entry as RowRecord, nestedSelector)
        );
      } else {
        projected[field] = projectRelation(field, nestedValue as RowRecord | null, nestedSelector);
      }
    }
    return projected;
  }

  return row;
};

const projectRelation = (relation: string, row: RowRecord | null, args?: QueryArgs) => {
  const model =
    relation === "recipe"
      ? "recipe"
      : relation === "household"
        ? "household"
        : relation === "user" || relation === "claimedBy"
          ? "user"
          : relation === "members"
            ? "householdMember"
            : null;

  if (!model || !row) {
    return row;
  }

  return projectModel(model, row as AppModelMap[typeof model] & RowRecord, args);
};

const toSqlTemplate = (strings: TemplateStringsArray, values: unknown[]) => {
  let sql = "";
  const params: unknown[] = [];

  strings.forEach((part, index) => {
    sql += part;
    if (index < values.length) {
      sql += "?";
      params.push(values[index] instanceof Date ? values[index].toISOString() : values[index]);
    }
  });

  return { sql, params };
};

const executeAll = async <T extends RowRecord>(db: D1Database, sql: string, params: unknown[] = []) => {
  const startedAt = Date.now();
  const statement = db.prepare(sql).bind(...params);
  const result = await statement.all<T>();
  logSlowQuery(sql, Date.now() - startedAt);
  return result.results ?? [];
};

const executeRun = async (db: D1Database, sql: string, params: unknown[] = []) => {
  const startedAt = Date.now();
  const statement = db.prepare(sql).bind(...params);
  const result = await statement.run();
  logSlowQuery(sql, Date.now() - startedAt);
  return result;
};

const executeFirst = async <T extends RowRecord>(db: D1Database, sql: string, params: unknown[] = []) => {
  const rows = await executeAll<T>(db, sql, params);
  return rows[0] ?? null;
};

const logSlowQuery = (query: string, durationMs: number) => {
  if (!isSlowQueryLoggingEnabled()) {
    return;
  }

  const thresholdMs = readSlowQueryThreshold();
  if (durationMs < thresholdMs) {
    return;
  }

  const normalizedQuery = normalizeQuery(query);
  const tableMatch = normalizedQuery.match(/\b(?:from|into|update)\s+"?([a-z0-9_]+)"?/i);
  console.info(
    "[server-perf]",
    JSON.stringify({
      phase: "db.slow_query",
      route: "/server/prisma",
      duration_ms: durationMs,
      success: true,
      meta: {
        threshold_ms: thresholdMs,
        query_hash: hashValue(normalizedQuery),
        table: tableMatch ? tableMatch[1] : null,
      },
    })
  );
};

const prepareCreateRecord = <K extends ModelName>(model: K, data: Record<string, unknown> | undefined) => {
  const config = modelConfigs[model];
  const now = new Date();
  const record: Record<string, unknown> = {
    ...config.defaults,
    ...(config.hasCreatedAt ? { createdAt: now } : {}),
    ...(config.hasUpdatedAt ? { updatedAt: now } : {}),
    ...(model === "householdMember" ? { joinedAt: now } : {}),
  };

  for (const [field, value] of Object.entries(data ?? {})) {
    if (value !== undefined) {
      record[field] = value;
    }
  }

  if (!record.id) {
    record.id = createId();
  }

  return record;
};

const buildInsertStatement = <K extends ModelName>(model: K, data: Record<string, unknown>) => {
  const config = modelConfigs[model];
  const fields = Object.entries(data).filter(([, value]) => value !== undefined);
  const columns = fields.map(([field]) => quoteIdentifier(field)).join(", ");
  const placeholders = fields.map(() => "?").join(", ");
  const params = fields.map(([field, value]) =>
    toStorageValue(config.fields[field as keyof typeof config.fields], value)
  );
  return {
    sql: `INSERT INTO ${quoteIdentifier(config.table)} (${columns}) VALUES (${placeholders})`,
    params,
  };
};

const buildUpdateStatement = <K extends ModelName>(
  model: K,
  data: Record<string, unknown> | undefined,
  where: Record<string, unknown>
) => {
  const config = modelConfigs[model];
  const params: unknown[] = [];
  const setClauses: string[] = [];
  const payload = { ...(data ?? {}) };

  if (config.hasUpdatedAt && payload.updatedAt === undefined) {
    payload.updatedAt = new Date();
  }

  for (const [field, rawValue] of Object.entries(payload)) {
    if (rawValue === undefined) {
      continue;
    }

    const kind = config.fields[field as keyof typeof config.fields];
    if (!kind) {
      continue;
    }

    if (isPlainObject(rawValue) && "increment" in rawValue) {
      setClauses.push(`${quoteIdentifier(field)} = COALESCE(${quoteIdentifier(field)}, 0) + ?`);
      params.push(Number(rawValue.increment));
      continue;
    }

    if (isPlainObject(rawValue) && "decrement" in rawValue) {
      setClauses.push(`${quoteIdentifier(field)} = COALESCE(${quoteIdentifier(field)}, 0) - ?`);
      params.push(Number(rawValue.decrement));
      continue;
    }

    setClauses.push(`${quoteIdentifier(field)} = ?`);
    params.push(toStorageValue(kind, rawValue));
  }

  const whereClause = buildWhereClause(model, where, params);
  return {
    sql: `UPDATE ${quoteIdentifier(config.table)} SET ${setClauses.join(", ")} ${whereClause}`.trim(),
    params,
  };
};

const buildSelectStatement = <K extends ModelName>(model: K, args?: QueryArgs, forceLimit?: number) => {
  const params: unknown[] = [];
  const whereClause = buildWhereClause(model, args?.where as Record<string, unknown> | undefined, params);
  const orderByClause = buildOrderByClause(args?.orderBy);
  const limit = forceLimit ?? args?.take;
  const offset = args?.skip;
  const pieces = [
    `SELECT * FROM ${quoteIdentifier(modelConfigs[model].table)}`,
    whereClause,
    orderByClause,
    limit !== undefined ? `LIMIT ${limit}` : "",
    offset !== undefined ? `OFFSET ${offset}` : "",
  ].filter(Boolean);
  return {
    sql: pieces.join(" "),
    params,
  };
};

const enrichRows = async <K extends ModelName>(
  model: K,
  rows: Array<AppModelMap[K] & RowRecord>,
  args?: QueryArgs
) => {
  if (rows.length === 0) {
    return rows;
  }

  if (model === "mealPlan") {
    const needsRecipe = Boolean(args?.include?.recipe || args?.select?.recipe);
    if (needsRecipe) {
      const recipeIds = [...new Set(rows.map((row) => row.recipeId))];
      const recipes = (await delegates.recipe.findMany({
        where: { id: { in: recipeIds } },
      })) as Array<Recipe & RowRecord>;
      const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
      rows.forEach((row) => {
        row.recipe = recipeMap.get(String(row.recipeId)) ?? null;
      });
    }
  }

  if (model === "householdMember") {
    const needsHousehold = Boolean(args?.include?.household || args?.select?.household);
    const needsUser = Boolean(args?.include?.user || args?.select?.user);

    if (needsHousehold) {
      const householdIds = [...new Set(rows.map((row) => row.householdId))];
      const households = (await delegates.household.findMany({
        where: { id: { in: householdIds } },
      })) as Array<Household & RowRecord>;
      const householdMap = new Map(households.map((household) => [household.id, household]));
      rows.forEach((row) => {
        row.household = householdMap.get(String(row.householdId)) ?? null;
      });
    }

    if (needsUser) {
      const userIds = [...new Set(rows.map((row) => row.userId))];
      const users = (await delegates.user.findMany({
        where: { id: { in: userIds } },
      })) as Array<User & RowRecord>;
      const userMap = new Map(users.map((user) => [user.id, user]));
      rows.forEach((row) => {
        row.user = userMap.get(String(row.userId)) ?? null;
      });
    }
  }

  if (model === "household") {
    const needsClaimedBy = Boolean(args?.include?.claimedBy || args?.select?.claimedBy);
    const membersArgs =
      (args?.include?.members as QueryArgs | true | undefined) ??
      (args?.select?.members as QueryArgs | true | undefined);

    if (needsClaimedBy) {
      const userIds = [...new Set(rows.map((row) => row.claimedByUserId).filter(Boolean) as string[])];
      if (userIds.length > 0) {
        const users = (await delegates.user.findMany({
          where: { id: { in: userIds } },
        })) as Array<User & RowRecord>;
        const userMap = new Map(users.map((user) => [user.id, user]));
        rows.forEach((row) => {
          row.claimedBy = row.claimedByUserId ? userMap.get(String(row.claimedByUserId)) ?? null : null;
        });
      } else {
        rows.forEach((row) => {
          row.claimedBy = null;
        });
      }
    }

    if (membersArgs) {
      const householdIds = rows.map((row) => row.id);
      const members = (await delegates.householdMember.findMany({
        where: { householdId: { in: householdIds } },
        ...(membersArgs === true ? {} : membersArgs),
      })) as Array<HouseholdMember & RowRecord>;
      const memberGroups = new Map<string, Array<HouseholdMember & RowRecord>>();
      members.forEach((member) => {
        const current = memberGroups.get(String(member.householdId)) ?? [];
        current.push(member);
        memberGroups.set(String(member.householdId), current);
      });
      rows.forEach((row) => {
        row.members = memberGroups.get(String(row.id)) ?? [];
      });
    }
  }

  return rows;
};

const createModelDelegate = <K extends ModelName>(model: K): AppModelDelegate => {
  const dbGetter = () => getD1Database();

  return {
    async findMany(args: QueryArgs = {}) {
      const statement = buildSelectStatement(model, args);
      const rows = await executeAll<RowRecord>(dbGetter(), statement.sql, statement.params);
      const parsed = rows.map((row) => rowToModel(model, row) as AppModelMap[K] & RowRecord);
      const enriched = await enrichRows(model, parsed, args);
      return enriched.map((row) => projectModel(model, row, args));
    },

    async findFirst(args: QueryArgs = {}) {
      const statement = buildSelectStatement(model, args, 1);
      const row = await executeFirst<RowRecord>(dbGetter(), statement.sql, statement.params);
      if (!row) {
        return null;
      }
      const parsed = rowToModel(model, row) as AppModelMap[K] & RowRecord;
      const [enriched] = await enrichRows(model, [parsed], args);
      return projectModel(model, enriched ?? null, args);
    },

    async findUnique(args: QueryArgs = {}) {
      return this.findFirst(args);
    },

    async create(args: WriteArgs) {
      const record = prepareCreateRecord(model, args.data);
      const insert = buildInsertStatement(model, record);
      await executeRun(dbGetter(), insert.sql, insert.params);
      return this.findUnique({
        where: { id: record.id },
        select: args.select,
        include: args.include,
      });
    },

    async update(args: WriteArgs & { where: Record<string, unknown> }) {
      const statement = buildUpdateStatement(model, args.data, args.where);
      await executeRun(dbGetter(), statement.sql, statement.params);

      const normalizedWhere = normalizeWhere(model, args.where);
      const fallbackId = isPlainObject(normalizedWhere) && typeof normalizedWhere.id === "string" ? normalizedWhere.id : undefined;

      return this.findFirst({
        where: fallbackId ? { id: fallbackId } : args.where,
        select: args.select,
        include: args.include,
      });
    },

    async updateMany(args: WriteArgs & { where: Record<string, unknown> }) {
      const statement = buildUpdateStatement(model, args.data, args.where);
      const result = await executeRun(dbGetter(), statement.sql, statement.params);
      return { count: Number(result.meta?.changes ?? 0) };
    },

    async deleteMany(args: { where: Record<string, unknown> }) {
      const params: unknown[] = [];
      const whereClause = buildWhereClause(model, args.where, params);
      const sql = `DELETE FROM ${quoteIdentifier(modelConfigs[model].table)} ${whereClause}`.trim();
      const result = await executeRun(dbGetter(), sql, params);
      return { count: Number(result.meta?.changes ?? 0) };
    },

    async upsert(args: {
      where: Record<string, unknown>;
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) {
      const existing = await this.findFirst({ where: args.where });
      if (existing && isPlainObject(existing) && typeof existing.id === "string") {
        await this.update({
          where: { id: existing.id },
          data: args.update,
        });
        return this.findFirst({ where: { id: existing.id } });
      }

      return this.create({ data: args.create });
    },

    async createMany(args: { data: Array<Record<string, unknown>> }) {
      const db = dbGetter();
      const statements: D1PreparedStatement[] = [];

      args.data.forEach((entry) => {
        const record = prepareCreateRecord(model, entry);
        const insert = buildInsertStatement(model, record);
        statements.push(db.prepare(insert.sql).bind(...insert.params));
      });

      if (statements.length > 0) {
        await db.batch(statements);
      }

      return { count: statements.length };
    },
  };
};

const delegates: Record<ModelName, AppModelDelegate> = {
  household: createModelDelegate("household"),
  householdMember: createModelDelegate("householdMember"),
  mealPlan: createModelDelegate("mealPlan"),
  recipe: createModelDelegate("recipe"),
  shoppingListItem: createModelDelegate("shoppingListItem"),
  user: createModelDelegate("user"),
  wine: createModelDelegate("wine"),
};

const prisma: PrismaFacade = {
  ...delegates,
  async $transaction<T>(
    input:
      | Array<Promise<unknown>>
      | ((tx: typeof prisma) => Promise<T>)
  ): Promise<T | unknown[]> {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }

    return input(prisma);
  },
  async $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) {
    const { sql, params } = toSqlTemplate(strings, values);
    return executeAll<T & RowRecord>(getD1Database(), sql, params) as Promise<T>;
  },
};

export default prisma;

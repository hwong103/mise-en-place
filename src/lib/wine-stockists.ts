const hasStockistsText = (value: unknown) =>
    typeof value === "string" && value.toLowerCase().includes("stockists");

let wineStockistsColumnAvailable: boolean | null = null;
let wineStockistsCheckedAtMs: number | null = null;
const STOCKISTS_CACHE_TTL_MS = 60_000;

const parseDbBoolean = (value: unknown) =>
    value === true
    || value === 1
    || value === "1"
    || value === "t"
    || value === "true";

const readErrorLike = (error: unknown) => {
    if (!error || typeof error !== "object") return undefined;
    return error as {
        code?: unknown;
        message?: unknown;
        meta?: { column?: unknown };
        cause?: unknown;
    };
};

export const isMissingStockistsColumnError = (error: unknown) => {
    let current: unknown = error;
    let depth = 0;

    while (current && depth < 4) {
        const record = readErrorLike(current);
        if (!record) return false;
        if (
            record.code === "P2022"
            || hasStockistsText(record.message)
            || hasStockistsText(record.meta?.column)
        ) {
            return true;
        }
        current = record.cause;
        depth += 1;
    }

    return false;
};

export const markWineStockistsColumnMissing = () => {
    wineStockistsColumnAvailable = false;
    wineStockistsCheckedAtMs = Date.now();
};

export const hasWineStockistsColumn = async (
    queryFn: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>
) => {
    if (wineStockistsColumnAvailable === true) return true;
    if (
        wineStockistsColumnAvailable === false
        && wineStockistsCheckedAtMs !== null
        && (Date.now() - wineStockistsCheckedAtMs) < STOCKISTS_CACHE_TTL_MS
    ) {
        return false;
    }
    try {
        const rows = await queryFn<Array<{ exists: boolean | string | number }>>`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND lower(table_name) = lower('Wine')
                  AND lower(column_name) = lower('stockists')
            ) AS "exists"
        `;
        wineStockistsColumnAvailable = parseDbBoolean(rows?.[0]?.exists);
        wineStockistsCheckedAtMs = Date.now();
        return wineStockistsColumnAvailable;
    } catch {
        wineStockistsColumnAvailable = false;
        wineStockistsCheckedAtMs = Date.now();
        return false;
    }
};

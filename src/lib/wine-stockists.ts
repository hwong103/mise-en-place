const hasStockistsText = (value: unknown) =>
    typeof value === "string" && value.toLowerCase().includes("stockists");

let wineStockistsColumnAvailable: boolean | null = null;

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
};

export const hasWineStockistsColumn = async (
    queryFn: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>
) => {
    if (wineStockistsColumnAvailable !== null) return wineStockistsColumnAvailable;
    try {
        const rows = await queryFn<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'Wine'
                  AND column_name = 'stockists'
            ) AS "exists"
        `;
        wineStockistsColumnAvailable = Boolean(rows?.[0]?.exists);
        return wineStockistsColumnAvailable;
    } catch {
        wineStockistsColumnAvailable = false;
        return false;
    }
};

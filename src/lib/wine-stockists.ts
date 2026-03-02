const hasStockistsText = (value: unknown) =>
    typeof value === "string" && value.toLowerCase().includes("stockists");

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

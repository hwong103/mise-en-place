const hasStockistsText = (value: unknown) =>
    typeof value === "string" && value.toLowerCase().includes("stockists");

export const isMissingStockistsColumnError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const record = error as { code?: unknown; message?: unknown; meta?: { column?: unknown } };
    return (
        record.code === "P2022"
        || hasStockistsText(record.message)
        || hasStockistsText(record.meta?.column)
    );
};

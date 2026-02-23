type ServerPerfLog = {
  phase: string;
  route: string;
  startedAt: number;
  success: boolean;
  householdId?: string | null;
  meta?: Record<string, unknown>;
};

const isPerfLoggingEnabled = () => {
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  const raw = process.env.PERF_LOGGING_ENABLED;
  if (!raw) {
    return true;
  }

  return /^(1|true|yes)$/i.test(raw);
};

const hashValue = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(16);
};

export const logServerPerf = ({
  phase,
  route,
  startedAt,
  success,
  householdId,
  meta,
}: ServerPerfLog) => {
  if (!isPerfLoggingEnabled()) {
    return;
  }

  const payload = {
    phase,
    route,
    duration_ms: Math.max(0, Date.now() - startedAt),
    household_id_hash: householdId ? hashValue(householdId) : null,
    success,
    ...(meta ? { meta } : {}),
  };

  console.info("[server-perf]", JSON.stringify(payload));
};
